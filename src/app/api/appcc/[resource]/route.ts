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
  /** Columna de fecha real para los filtros ?from=/?to= — solo se aplican si
   *  está definida, ya que no todas las tablas APPCC tienen `recorded_at`
   *  (fix: antes se asumía esa columna para las 8, y solo 2 la tienen). */
  dateColumn?: string;
  /** Columna+dirección del ORDER BY cuando no se pasa ?order= — antes se
   *  asumía `created_at DESC` para las 8 tablas, pero monitoring/fridge/
   *  cleaning/traceability no tienen esa columna y el SELECT crasheaba. */
  defaultSort: string;
}

const HANDLERS: Record<string, Handler> = {
  plans: {
    table: 'haccp_plans', alias: 'hp',
    select: 'hp.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = hp.event_id',
    allowedSortColumns: ['created_at', 'updated_at', 'plan_type', 'status'],
    allowedColumns: ['event_id', 'plan_type', 'version', 'approved_by', 'approval_date', 'valid_until', 'status'],
    allowedFilters: ['event_id', 'eventId', 'status'],
    defaultSort: 'created_at DESC',
    // Sin recorded_at real: solo created_at/updated_at, ninguno es el
    // "cuándo ocurrió" que ?from=/?to= esperan — se omite el filtro de fecha.
  },
  limits: {
    table: 'haccp_critical_limits', alias: 'hcl',
    select: 'hcl.*, hp.plan_type as plan_type',
    join: 'LEFT JOIN haccp_plans hp ON hp.id = hcl.plan_id',
    allowedSortColumns: ['created_at', 'parameter', 'name'],
    allowedColumns: ['plan_id', 'parameter', 'name', 'description', 'min_value', 'max_value', 'unit', 'corrective_action', 'frequency'],
    // Sin columna status: haccp_critical_limits no la tiene (fix — el
    // filtro previo la incluía y crasheaba con "column does not exist").
    allowedFilters: ['plan_id', 'planId'],
    defaultSort: 'created_at DESC',
  },
  monitoring: {
    table: 'haccp_monitoring', alias: 'hm',
    select: 'hm.*, hcl.name as limit_name',
    join: 'LEFT JOIN haccp_critical_limits hcl ON hcl.id = hm.limit_id',
    allowedSortColumns: ['recorded_at', 'value', 'status'],
    allowedColumns: ['limit_id', 'recorded_at', 'recorded_by', 'value', 'unit', 'status', 'notes', 'is_corrected', 'corrected_at', 'corrected_by'],
    allowedFilters: ['limit_id', 'limitId', 'status'],
    dateColumn: 'recorded_at',
    defaultSort: 'recorded_at DESC',
  },
  // Antes 'temperatures' → tabla 'temperature_log' (no existe; la real es
  // fridge_temperature_log) y ningún componente llamaba a ese nombre —
  // HACCPPanel.tsx siempre ha llamado a /api/appcc/fridge. Corregido.
  fridge: {
    table: 'fridge_temperature_log', alias: 'ftl',
    select: 'ftl.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = ftl.event_id',
    allowedSortColumns: ['recorded_at', 'fridge_name', 'temperature'],
    allowedColumns: ['event_id', 'fridge_name', 'fridge_type', 'temperature', 'target_min', 'target_max', 'status', 'recorded_by', 'notes'],
    allowedFilters: ['event_id', 'eventId', 'fridge_name', 'fridgeName', 'status'],
    dateColumn: 'recorded_at',
    defaultSort: 'recorded_at DESC',
  },
  cleaning: {
    table: 'cleaning_log', alias: 'cl',
    select: 'cl.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = cl.event_id',
    // Sin created_at real: cleaning_log solo tiene performed_at (fix — el
    // allowlist previo incluía 'created_at', columna inexistente).
    allowedSortColumns: ['performed_at', 'area'],
    allowedColumns: ['event_id', 'area', 'schedule', 'performed_at', 'performed_by', 'verified_by', 'verified_at', 'products_used', 'notes', 'checklist'],
    // Sin columna status: cleaning_log no la tiene.
    allowedFilters: ['event_id', 'eventId'],
    dateColumn: 'performed_at',
    defaultSort: 'performed_at DESC',
  },
  suppliers: {
    table: 'supplier_approval', alias: 'sa',
    select: 'sa.*, p.name as provider_name, p.category as provider_category',
    join: 'LEFT JOIN providers p ON p.id = sa.provider_id',
    allowedSortColumns: ['created_at', 'expires_at', 'status'],
    allowedColumns: ['provider_id', 'approved_at', 'expires_at', 'approved_by', 'criteria_met', 'status', 'document_url', 'notes'],
    allowedFilters: ['provider_id', 'providerId', 'status'],
    defaultSort: 'created_at DESC',
  },
  traceability: {
    table: 'traceability_log', alias: 'tl',
    select: 'tl.*, i.name as ingredient_name, r.name as recipe_name, e.client_name as event_name',
    join: 'LEFT JOIN ingredients i ON i.id = tl.ingredient_id LEFT JOIN recipes r ON r.id = tl.recipe_id LEFT JOIN events e ON e.id = tl.event_id',
    allowedSortColumns: ['used_at', 'quantity_used'],
    allowedColumns: ['event_id', 'ingredient_id', 'recipe_id', 'lot_number', 'receiving_id', 'quantity_used', 'unit', 'used_at', 'used_by', 'guest_served', 'is_critical', 'notes'],
    // Sin columna status: traceability_log no la tiene.
    allowedFilters: ['event_id', 'eventId', 'ingredient_id', 'ingredientId'],
    dateColumn: 'used_at',
    defaultSort: 'used_at DESC',
  },
  calibration: {
    table: 'haccp_equipment_calibration', alias: 'hec',
    select: 'hec.*, eq.name as equipment_name, eq.category as equipment_category',
    join: 'LEFT JOIN equipment eq ON eq.id = hec.equipment_id',
    allowedSortColumns: ['created_at', 'calibration_date', 'next_calibration'],
    allowedColumns: ['equipment_id', 'calibration_date', 'calibrated_by', 'result', 'next_calibration', 'certificate_url', 'notes'],
    // Sin columna status: haccp_equipment_calibration usa `result` (pass/fail/adjusted), no status.
    allowedFilters: ['equipment_id', 'equipmentId'],
    dateColumn: 'calibration_date',
    defaultSort: 'created_at DESC',
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

  // Date range filters solo se aplican si el recurso tiene una columna de
  // fecha real declarada (no todas las tablas APPCC tienen recorded_at).
  if (h.dateColumn) {
    const f = sp.get('from');
    if (f) { filters.push(`${alias}.${h.dateColumn} >= $${idx}`); params.push(f); idx++; }

    const t = sp.get('to');
    if (t) { filters.push(`${alias}.${h.dateColumn} <= $${idx}`); params.push(t); idx++; }
  }

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
  let orderBy = `${h.alias}.${h.defaultSort}`;
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
  // Fix: la tabla real es fridge_temperature_log (no temperature_log), los
  // status son ingleses ('ok'|'warning'|'critical', no 'pendiente'/'critico'),
  // supplier_approval usa expires_at (no expiry_date) y no existe una tabla
  // corrective_actions — se elimina esa métrica en vez de fingir un 0 fijo.
  const results = await Promise.allSettled([
    query(`SELECT COUNT(*)::int AS total FROM haccp_plans`),
    query(`SELECT COUNT(*)::int AS pending FROM haccp_monitoring WHERE status = 'warning'`),
    query(`SELECT COUNT(*)::int AS critical FROM fridge_temperature_log WHERE status = 'critical'`),
    query(`SELECT COUNT(*)::int AS expired FROM supplier_approval WHERE expires_at < NOW()`),
    query(`SELECT COUNT(*)::int AS needs_cal FROM haccp_equipment_calibration WHERE next_calibration < NOW()`),
  ]);

  const [plans, monitoring, temps, suppliers, calibration] = results.map(r =>
    r.status === 'fulfilled' ? r.value.rows?.[0] || {} : {}
  );

  return NextResponse.json({ success: true, data: {
    totalPlans: plans.total || 0,
    pendingMonitoring: monitoring.pending || 0,
    criticalTemps: temps.critical || 0,
    expiredDocuments: suppliers.expired || 0,
    pendingCalibration: calibration.needs_cal || 0,
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