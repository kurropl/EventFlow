/**
 * /api/appcc/[resource] — APPCC CRUD unificado con seguridad
 *
 * Cada recurso expone GET (lista con filtros seguros por allowlist)
 * y POST (crear con columnas permitidas por allowlist).
 *
 * Seguridad:
 *  - ORDER BY: solo columnas explicitadas en ALLOWED_SORT_COLUMNS por recurso
 *  - LIMIT: parseado a entero con tope máximo 500
 *  - INSERT: solo columnas en ALLOWED_COLUMNS por recurso, rechazo 422 si sobra alguna
 *  - Filtros (GET): solo los definidos en ALLOWED_FILTERS por recurso, ignorando el resto
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

interface Handler {
  table: string;
  alias: string;
  select: string;
  join?: string;
  allowedSortColumns: string[];
  allowedColumns: string[];
  allowedFilters: string[];
}

const HANDLERS: Record<string, Handler> = {
  plans: {
    table: 'haccp_plans', alias: 'hp',
    select: 'hp.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = hp.event_id',
    allowedSortColumns: ['created_at', 'updated_at', 'name', 'status'],
    allowedColumns: ['event_id', 'name', 'description', 'objective', 'responsible', 'status', 'review_date', 'notes'],
    allowedFilters: ['event_id', 'eventId', 'status'],
  },
  limits: {
    table: 'haccp_critical_limits', alias: 'hcl',
    select: 'hcl.*, hp.name as plan_name',
    join: 'LEFT JOIN haccp_plans hp ON hp.id = hcl.plan_id',
    allowedSortColumns: ['created_at', 'updated_at', 'parameter', 'limit_value'],
    allowedColumns: ['plan_id', 'parameter', 'limit_value', 'unit', 'tolerance', 'corrective_action', 'monitoring_frequency'],
    allowedFilters: ['plan_id', 'planId', 'status'],
  },
  monitoring: {
    table: 'haccp_monitoring', alias: 'hm',
    select: 'hm.*, hp.name as plan_name, e.client_name as event_name',
    join: 'LEFT JOIN haccp_plans hp ON hp.id = hm.plan_id LEFT JOIN events e ON e.id = hm.event_id',
    allowedSortColumns: ['recorded_at', 'created_at', 'value', 'status'],
    allowedColumns: ['plan_id', 'event_id', 'limit_id', 'recorded_at', 'value', 'unit', 'status', 'recorded_by', 'notes', 'corrective_action'],
    allowedFilters: ['event_id', 'eventId', 'plan_id', 'planId', 'limit_id', 'limitId', 'status'],
  },
  temperatures: {
    table: 'temperature_log', alias: 'tl',
    select: 'tl.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = tl.event_id',
    allowedSortColumns: ['recorded_at', 'created_at', 'fridge_name', 'temperature'],
    allowedColumns: ['event_id', 'fridge_name', 'temperature', 'ambient_temp', 'unit', 'status', 'recorded_by', 'notes', 'corrective_action'],
    allowedFilters: ['event_id', 'eventId', 'fridge_name', 'fridgeName', 'status'],
  },
  cleaning: {
    table: 'cleaning_log', alias: 'cl',
    select: 'cl.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = cl.event_id',
    allowedSortColumns: ['created_at', 'performed_at', 'area'],
    allowedColumns: ['event_id', 'area', 'task', 'performed_by', 'performed_at', 'verified_by', 'status', 'notes'],
    allowedFilters: ['event_id', 'eventId', 'status'],
  },
  suppliers: {
    table: 'supplier_approval', alias: 'sa',
    select: 'sa.*, p.name as provider_name, p.category as provider_category',
    join: 'LEFT JOIN providers p ON p.id = sa.provider_id',
    allowedSortColumns: ['created_at', 'expiry_date', 'status'],
    allowedColumns: ['provider_id', 'document_type', 'document_url', 'expiry_date', 'status', 'notes', 'approved_by'],
    allowedFilters: ['provider_id', 'providerId', 'status'],
  },
  traceability: {
    table: 'traceability_log', alias: 'tl',
    select: 'tl.*, i.name as ingredient_name, r.name as recipe_name, e.client_name as event_name',
    join: 'LEFT JOIN ingredients i ON i.id = tl.ingredient_id LEFT JOIN recipes r ON r.id = tl.recipe_id LEFT JOIN events e ON e.id = tl.event_id',
    allowedSortColumns: ['created_at', 'used_at', 'quantity'],
    allowedColumns: ['event_id', 'ingredient_id', 'recipe_id', 'used_at', 'quantity', 'unit', 'batch', 'notes'],
    allowedFilters: ['event_id', 'eventId', 'ingredient_id', 'ingredientId', 'status'],
  },
  calibration: {
    table: 'haccp_equipment_calibration', alias: 'hec',
    select: 'hec.*, eq.name as equipment_name, eq.category as equipment_category',
    join: 'LEFT JOIN equipment eq ON eq.id = hec.equipment_id',
    allowedSortColumns: ['created_at', 'calibration_date', 'next_calibration'],
    allowedColumns: ['equipment_id', 'calibration_date', 'next_calibration', 'standard_used', 'result', 'calibrated_by', 'notes'],
    allowedFilters: ['equipment_id', 'equipmentId', 'status'],
  },
};

function getResource(pathname: string): string | null {
  const segments = pathname.replace(/^\/api\/appcc\/?/, '').split('/');
  return segments[0] || null;
}

function buildFilters(sp: URLSearchParams, h: Handler): { where: string; params: string[] } {
  const filters: string[] = [];
  const params: string[] = [];
  let idx = 1;

  const alias = h.alias;

  // Only process filters declared in allowedFilters
  for (const filterKey of h.allowedFilters) {
    const value = sp.get(filterKey);
    if (!value) continue;

    // Map camelCase keys to snake_case column names
    let column: string;
    switch (filterKey) {
      case 'eventId': column = 'event_id'; break;
      case 'planId': column = 'plan_id'; break;
      case 'limitId': column = 'limit_id'; break;
      case 'limit_id': column = 'limit_id'; break;
      case 'ingredientId': column = 'ingredient_id'; break;
      case 'ingredient_id': column = 'ingredient_id'; break;
      case 'fridgeName': column = 'fridge_name'; break;
      case 'fridge_name': column = 'fridge_name'; break;
      case 'providerId': column = 'provider_id'; break;
      case 'provider_id': column = 'provider_id'; break;
      case 'equipmentId': column = 'equipment_id'; break;
      case 'equipment_id': column = 'equipment_id'; break;
      default: column = filterKey; break;
    }

    filters.push(`${alias}.${column} = $${idx}`);
    params.push(value);
    idx++;
  }

  // Date range filters are generic enough to apply to any resource with recorded_at/created_at
  const f = sp.get('from');
  if (f) { filters.push(`${alias}.recorded_at >= $${idx}`); params.push(f); idx++; }

  const t = sp.get('to');
  if (t) { filters.push(`${alias}.recorded_at <= $${idx}`); params.push(t); idx++; }

  return {
    where: filters.length ? 'WHERE ' + filters.join(' AND ') : '',
    params,
  };
}

async function handleGet(resource: string, sp: URLSearchParams): Promise<NextResponse> {
  if (resource === 'dashboard') return handleDashboard();
  const h = HANDLERS[resource];
  if (!h) return NextResponse.json({ success: false, error: 'Unknown resource' }, { status: 400 });

  const { where, params } = buildFilters(sp, h);

  // Safe LIMIT: parse to int, clamp to max 500
  const rawLimit = sp.get('limit');
  let limit = 100;
  if (rawLimit) {
    const parsed = parseInt(rawLimit, 10);
    if (isNaN(parsed) || parsed < 1) {
      return NextResponse.json({ success: false, error: 'Invalid limit parameter' }, { status: 400 });
    }
    limit = Math.min(parsed, 500);
  }

  // Safe ORDER BY: allowlist only
  const rawOrder = sp.get('order');
  let orderBy = h.alias + '.created_at DESC';
  if (rawOrder) {
    // Parse "column DIR" format
    const parts = rawOrder.split(/\s+/);
    const col = parts[0].replace(`${h.alias}.`, '');
    const dir = parts[1]?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    if (h.allowedSortColumns.includes(col)) {
      orderBy = `${h.alias}.${col} ${dir}`;
    } else {
      return NextResponse.json({ success: false, error: `Invalid sort column '${col}' for resource '${resource}'` }, { status: 400 });
    }
  }

  const result = await query(
    `SELECT ${h.select} FROM ${h.table} ${h.alias} ${h.join || ''} ${where} ORDER BY ${orderBy} LIMIT ${limit}`,
    params
  );
  return NextResponse.json({ success: true, data: result.rows || [] });
}

async function handlePost(resource: string, body: any): Promise<NextResponse> {
  const h = HANDLERS[resource];
  if (!h) return NextResponse.json({ success: false, error: 'Unknown resource' }, { status: 400 });

  // Filter to only allowed columns
  const fields = Object.keys(body).filter(k => h.allowedColumns.includes(k));
  if (fields.length === 0) return NextResponse.json({ success: false, error: 'No valid fields provided' }, { status: 400 });

  // Reject any keys not in allowedColumns
  const unknownKeys = Object.keys(body).filter(k => !h.allowedColumns.includes(k) && !k.startsWith('_'));
  if (unknownKeys.length > 0) {
    return NextResponse.json({
      success: false,
      error: `Unknown fields not allowed: ${unknownKeys.join(', ')}`,
    }, { status: 422 });
  }

  const cols = fields.join(', ');
  const placeholders = fields.map((_, i) => '$' + (i + 1)).join(', ');
  const values = fields.map((f: string) => body[f]);

  const result = await query(
    `INSERT INTO ${h.table} (${cols}) VALUES (${placeholders}) RETURNING *`,
    values
  );

  return NextResponse.json({ success: true, data: result.rows?.[0] || null }, { status: 201 });
}

async function handleDashboard(): Promise<NextResponse> {
  const results = await Promise.allSettled([
    query(`SELECT COUNT(*)::int AS total FROM haccp_plans`),
    query(`SELECT COUNT(*)::int AS pending FROM haccp_monitoring WHERE status = 'pendiente'`),
    query(`SELECT COUNT(*)::int AS critical FROM temperature_log WHERE status = 'critico'`),
    query(`SELECT COUNT(*)::int AS expired FROM supplier_approval WHERE expiry_date < NOW()`),
    query(`SELECT COUNT(*)::int AS needs_cal FROM haccp_equipment_calibration WHERE next_calibration < NOW()`),
    query(`SELECT COUNT(*)::int AS non_compliant FROM corrective_actions WHERE status != 'resuelto'`),
  ]);

  const [plans, monitoring, temps, suppliers, calibration, actions] = results.map(r =>
    r.status === 'fulfilled' ? r.value.rows?.[0] || {} : {}
  );

  return NextResponse.json({ success: true, data: {
    totalPlans: plans.total || 0,
    pendingMonitoring: monitoring.pending || 0,
    criticalTemps: temps.critical || 0,
    expiredDocuments: suppliers.expired || 0,
    pendingCalibration: calibration.needs_cal || 0,
    openCorrectiveActions: actions.non_compliant || 0,
  }});
}

export async function GET(req: NextRequest) {
  try {
    const resource = getResource(req.nextUrl.pathname);
    if (!resource) return NextResponse.json({ success: false, error: 'Resource required' }, { status: 400 });
    return await handleGet(resource, req.nextUrl.searchParams);
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const resource = getResource(req.nextUrl.pathname);
    if (!resource) return NextResponse.json({ success: false, error: 'Resource required' }, { status: 400 });
    const body = await req.json();
    return await handlePost(resource, body);
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}