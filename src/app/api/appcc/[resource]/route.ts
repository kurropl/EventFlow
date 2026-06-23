/**
 * EventFlow — APPCC API
 * 
 * Rutas bajo /api/appcc:
 *   GET    /api/appcc/dashboard      — Resumen APPCC del día
 *   GET    /api/appcc/plans          — Planes APPCC
 *   POST   /api/appcc/plans          — Crear plan
 *   GET    /api/appcc/limits         — Límites críticos
 *   POST   /api/appcc/limits         — Crear límite
 *   GET    /api/appcc/monitoring     — Lecturas de monitorización
 *   POST   /api/appcc/monitoring     — Registrar lectura
 *   GET    /api/appcc/fridge         — Temperaturas neveras
 *   POST   /api/appcc/fridge         — Registrar temp nevera
 *   GET    /api/appcc/cleaning       — Registro limpieza
 *   POST   /api/appcc/cleaning       — Registrar limpieza
 *   GET    /api/appcc/suppliers      — Proveedores homologados
 *   POST   /api/appcc/suppliers      — Homologar proveedor
 *   GET    /api/appcc/traceability   — Trazabilidad lotes
 *   POST   /api/appcc/traceability   — Registrar uso lote
 *   GET    /api/appcc/calibration    — Calibraciones equipo
 *   POST   /api/appcc/calibration    — Registrar calibración
 */

import { NextRequest, NextResponse } from \'next/server\';
import { query } from \'@/lib/db\';
import { sanitizeError } from \'@/lib/security\';

export const dynamic = \'force-dynamic\';

// ── Helper: parse resource from subpath ──
function getResource(pathname: string): string | null {
  const segments = pathname.replace(/^\/api\/appcc\/?/, \'\').split(\'/\');
  return segments[0] || null;
}

// ── Helper: build WHERE clause from searchParams ──
function buildFilters(sp: URLSearchParams, tableAlias: string): { where: string; params: any[] } {
  const filters: string[] = [];
  const params: any[] = [];
  let idx = 1;

  const EVENT_FILTER_FIELDS = [\'event_id\', \'eventId\'];
  for (const f of EVENT_FILTER_FIELDS) {
    const v = sp.get(f);
    if (v) { filters.push(`${tableAlias}.event_id = $${idx}`); params.push(v); idx++; break; }
  }

  const status = sp.get(\'status\');
  if (status) { filters.push(`${tableAlias}.status = $${idx}`); params.push(status); idx++; }

  const date_from = sp.get(\'from\');
  if (date_from) { filters.push(`${tableAlias}.recorded_at >= $${idx}`); params.push(date_from); idx++; }

  const date_to = sp.get(\'to\');
  if (date_to) { filters.push(`${tableAlias}.recorded_at <= $${idx}`); params.push(date_to); idx++; }

  const limit_id = sp.get(\'limit_id\') || sp.get(\'limitId\');
  if (limit_id) { filters.push(`${tableAlias}.limit_id = $${idx}`); params.push(limit_id); idx++; }

  const ingredient = sp.get(\'ingredient_id\') || sp.get(\'ingredientId\');
  if (ingredient) { filters.push(`${tableAlias}.ingredient_id = $${idx}`); params.push(ingredient); idx++; }

  const fridge = sp.get(\'fridge_name\') || sp.get(\'fridgeName\');
  if (fridge) { filters.push(`${tableAlias}.fridge_name = $${idx}`); params.push(fridge); idx++; }

  return {
    where: filters.length > 0 ? \'WHERE \' + filters.join(\' AND \') : \'\',
    params,
  };
}

// ═══════════════════════════════════════════════════
//  GET /api/appcc/dashboard
// ═══════════════════════════════════════════════════
async function handleDashboard(): Promise<NextResponse> {
  const today = new Date().toISOString().slice(0, 10);

  const [plansActive, fridgeCritical, cleaningToday, suppliersActive, traceToday, monitoringAlerts] = await Promise.all([
    query(\'SELECT COUNT(*)::int as count FROM haccp_plans WHERE status = $1\', [\'active\']),
    query(\'SELECT COUNT(*)::int as count FROM fridge_temperature_log WHERE recorded_at >= $1 AND status = $2\',
      [today, \'critical\']),
    query(\'SELECT COUNT(*)::int as count FROM cleaning_log WHERE performed_at >= $1\', [today]),
    query(\'SELECT COUNT(*)::int as count FROM supplier_approval WHERE status = $1\', [\'active\']),
    query(\'SELECT COUNT(*)::int as count FROM traceability_log WHERE used_at >= $1\', [today]),
    query(\'SELECT COUNT(*)::int as count FROM haccp_monitoring WHERE recorded_at >= $1 AND status IN ($2,$3)\',
      [today, \'warning\', \'critical\']),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      plansActive: (plansActive.rows[0] as any)?.count || 0,
      fridgeCritical: (fridgeCritical.rows[0] as any)?.count || 0,
      cleaningToday: (cleaningToday.rows[0] as any)?.count || 0,
      suppliersActive: (suppliersActive.rows[0] as any)?.count || 0,
      traceToday: (traceToday.rows[0] as any)?.count || 0,
      monitoringAlerts: (monitoringAlerts.rows[0] as any)?.count || 0,
    },
  });
}

// ═══════════════════════════════════════════════════
//  RESOURCE HANDLERS
// ═══════════════════════════════════════════════════
const HANDLERS: Record<string, {
  table: string;
  alias: string;
  select: string;
  validFields?: string[];
}> = {
  plans: {
    table: \'haccp_plans\',
    alias: \'hp\',
    select: \'hp.*, e.client_name as event_name, e.event_date\',
    join: \'LEFT JOIN events e ON e.id = hp.event_id\',
  },
  limits: {
    table: \'haccp_critical_limits\',
    alias: \'hcl\',
    select: \'hcl.*, hp.plan_type, hp.status as plan_status\',
    join: \'LEFT JOIN haccp_plans hp ON hp.id = hcl.plan_id\',
  },
  monitoring: {
    table: \'haccp_monitoring\',
    alias: \'hm\',
    select: \'hm.*, hcl.name as limit_name, hcl.parameter, hcl.min_value, hcl.max_value, hcl.unit as limit_unit\',
    join: \'LEFT JOIN haccp_critical_limits hcl ON hcl.id = hm.limit_id\',
  },
  fridge: {
    table: \'fridge_temperature_log\',
    alias: \'ft\',
    select: \'ft.*, e.client_name as event_name\',
    join: \'LEFT JOIN events e ON e.id = ft.event_id\',
  },
  cleaning: {
    table: \'cleaning_log\',
    alias: \'cl\',
    select: \'cl.*, e.client_name as event_name\',
    join: \'LEFT JOIN events e ON e.id = cl.event_id\',
  },
  suppliers: {
    table: \'supplier_approval\',
    alias: \'sa\',
    select: \'sa.*, p.name as provider_name, p.category as provider_category\',
    join: \'LEFT JOIN providers p ON p.id = sa.provider_id\',
  },
  traceability: {
    table: \'traceability_log\',
    alias: \'tl\',
    select: \'tl.*, i.name as ingredient_name, r.name as recipe_name, e.client_name as event_name\',
    join: \'LEFT JOIN ingredients i ON i.id = tl.ingredient_id LEFT JOIN recipes r ON r.id = tl.recipe_id LEFT JOIN events e ON e.id = tl.event_id\',
  },
  calibration: {
    table: \'haccp_equipment_calibration\',
    alias: \'hec\',
    select: \'hec.*, eq.name as equipment_name, eq.category as equipment_category\',
    join: \'LEFT JOIN equipment eq ON eq.id = hec.equipment_id\',
  },
};

// ═══════════════════════════════════════════════════
//  GET Handler
// ═══════════════════════════════════════════════════
async function handleGet(resource: string, searchParams: URLSearchParams): Promise<NextResponse> {
  if (resource === \'dashboard\') return handleDashboard();

  const h = HANDLERS[resource];
  if (!h) return NextResponse.json({ success: false, error: \'Unknown resource\' }, { status: 400 });

  const { where, params } = buildFilters(searchParams, h.alias);
  const limit = searchParams.get(\'limit\') ? \'LIMIT \' + searchParams.get(\'limit\') : \'LIMIT 100\';
  const orderBy = searchParams.get(\'order\') || \'\';

  let orderClause = \'ORDER BY \' + h.alias + \'.created_at DESC\';
  if (orderBy) orderClause = \'ORDER BY \' + orderBy;

  const result = await query(
    \`SELECT \${h.select} FROM \${h.table} \${h.alias} \${h.join || \'\'} \${where} \${orderClause} \${limit}\`,
    params
  );

  return NextResponse.json({ success: true, data: result.rows || [] });
}

// ═══════════════════════════════════════════════════
//  POST Handler
// ═══════════════════════════════════════════════════
async function handlePost(resource: string, body: any): Promise<NextResponse> {
  const h = HANDLERS[resource];
  if (!h) return NextResponse.json({ success: false, error: \'Unknown resource\' }, { status: 400 });

  const fields = Object.keys(body).filter(k => !k.startsWith(\'_\'));
  if (fields.length === 0) return NextResponse.json({ success: false, error: \'No fields provided\' }, { status: 400 });

  const cols = fields.join(\', \');
  const placeholders = fields.map((_, i) => \'$\' + (i + 1)).join(\', \');
  const values = fields.map(f => body[f]);

  const result = await query(
    \`INSERT INTO \${h.table} (\${cols}) VALUES (\${placeholders}) RETURNING *\`,
    values
  );

  return NextResponse.json({ success: true, data: result.rows?.[0] || null }, { status: 201 });
}

// ═══════════════════════════════════════════════════
//  MAIN EXPORTS
// ═══════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const resource = getResource(request.nextUrl.pathname);
    if (!resource) return NextResponse.json({ success: false, error: \'Resource required (e.g., /api/appcc/plans)\' }, { status: 400 });
    return await handleGet(resource, request.nextUrl.searchParams);
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const resource = getResource(request.nextUrl.pathname);
    if (!resource) return NextResponse.json({ success: false, error: \'Resource required\' }, { status: 400 });
    const body = await request.json();
    return await handlePost(resource, body);
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
