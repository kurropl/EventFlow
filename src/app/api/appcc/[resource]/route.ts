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

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

function getResource(pathname: string): string | null {
  const segments = pathname.replace(/^\/api\/appcc\/?/, '').split('/');
  return segments[0] || null;
}

function buildFilters(sp: URLSearchParams, alias: string): { where: string; params: string[] } {
  const filters: string[] = [];
  const params: string[] = [];
  let idx = 1;

  const v = sp.get('event_id') || sp.get('eventId');
  if (v) { filters.push(`${alias}.event_id = $${idx}`); params.push(v); idx++; }

  const status = sp.get('status');
  if (status) { filters.push(`${alias}.status = $${idx}`); params.push(status); idx++; }

  const f = sp.get('from');
  if (f) { filters.push(`${alias}.recorded_at >= $${idx}`); params.push(f); idx++; }

  const t = sp.get('to');
  if (t) { filters.push(`${alias}.recorded_at <= $${idx}`); params.push(t); idx++; }

  const lid = sp.get('limit_id') || sp.get('limitId');
  if (lid) { filters.push(`${alias}.limit_id = $${idx}`); params.push(lid); idx++; }

  const iid = sp.get('ingredient_id') || sp.get('ingredientId');
  if (iid) { filters.push(`${alias}.ingredient_id = $${idx}`); params.push(iid); idx++; }

  const fn = sp.get('fridge_name') || sp.get('fridgeName');
  if (fn) { filters.push(`${alias}.fridge_name = $${idx}`); params.push(fn); idx++; }

  return {
    where: filters.length > 0 ? 'WHERE ' + filters.join(' AND ') : '',
    params,
  };
}

async function handleDashboard(): Promise<NextResponse> {
  const today = new Date().toISOString().slice(0, 10);

  const [plansActive, fridgeCritical, cleaningToday, suppliersActive, monitoringAlerts] = await Promise.all([
    query(`SELECT COUNT(*)::int as count FROM haccp_plans WHERE status = $1`, ['active']),
    query(`SELECT COUNT(*)::int as count FROM fridge_temperature_log WHERE recorded_at::date = $1 AND status = $2`, [today, 'critical']),
    query(`SELECT COUNT(*)::int as count FROM cleaning_log WHERE performed_at::date = $1`, [today]),
    query(`SELECT COUNT(*)::int as count FROM supplier_approval WHERE status = $1`, ['active']),
    query(`SELECT COUNT(*)::int as count FROM haccp_monitoring WHERE recorded_at::date = $1 AND status IN ($2,$3)`, [today, 'warning', 'critical']),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      plansActive: Number((plansActive.rows[0] as any)?.count || 0),
      fridgeCritical: Number((fridgeCritical.rows[0] as any)?.count || 0),
      cleaningToday: Number((cleaningToday.rows[0] as any)?.count || 0),
      suppliersActive: Number((suppliersActive.rows[0] as any)?.count || 0),
      monitoringAlerts: Number((monitoringAlerts.rows[0] as any)?.count || 0),
    },
  });
}

interface ResourceConfig {
  table: string;
  alias: string;
  select: string;
  join?: string;
}

const HANDLERS: Record<string, ResourceConfig> = {
  dashboard: { table: '', alias: '', select: '' },
  plans: {
    table: 'haccp_plans', alias: 'hp',
    select: 'hp.*, e.client_name as event_name, e.event_date',
    join: 'LEFT JOIN events e ON e.id = hp.event_id',
  },
  limits: {
    table: 'haccp_critical_limits', alias: 'hcl',
    select: 'hcl.*, hp.plan_type, hp.status as plan_status',
    join: 'LEFT JOIN haccp_plans hp ON hp.id = hcl.plan_id',
  },
  monitoring: {
    table: 'haccp_monitoring', alias: 'hm',
    select: 'hm.*, hcl.name as limit_name, hcl.parameter, hcl.min_value, hcl.max_value, hcl.unit as limit_unit',
    join: 'LEFT JOIN haccp_critical_limits hcl ON hcl.id = hm.limit_id',
  },
  fridge: {
    table: 'fridge_temperature_log', alias: 'ft',
    select: 'ft.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = ft.event_id',
  },
  cleaning: {
    table: 'cleaning_log', alias: 'cl',
    select: 'cl.*, e.client_name as event_name',
    join: 'LEFT JOIN events e ON e.id = cl.event_id',
  },
  suppliers: {
    table: 'supplier_approval', alias: 'sa',
    select: 'sa.*, p.name as provider_name, p.category as provider_category',
    join: 'LEFT JOIN providers p ON p.id = sa.provider_id',
  },
  traceability: {
    table: 'traceability_log', alias: 'tl',
    select: 'tl.*, i.name as ingredient_name, r.name as recipe_name, e.client_name as event_name',
    join: 'LEFT JOIN ingredients i ON i.id = tl.ingredient_id LEFT JOIN recipes r ON r.id = tl.recipe_id LEFT JOIN events e ON e.id = tl.event_id',
  },
  calibration: {
    table: 'haccp_equipment_calibration', alias: 'hec',
    select: 'hec.*, eq.name as equipment_name, eq.category as equipment_category',
    join: 'LEFT JOIN equipment eq ON eq.id = hec.equipment_id',
  },
};

async function handleGet(resource: string, sp: URLSearchParams): Promise<NextResponse> {
  if (resource === 'dashboard') return handleDashboard();
  const h = HANDLERS[resource];
  if (!h) return NextResponse.json({ success: false, error: 'Unknown resource' }, { status: 400 });

  const { where, params } = buildFilters(sp, h.alias);
  const limit = 'LIMIT ' + (sp.get('limit') || '100');
  const orderBy = sp.get('order') || h.alias + '.created_at DESC';

  const result = await query(
    `SELECT ${h.select} FROM ${h.table} ${h.alias} ${h.join || ''} ${where} ORDER BY ${orderBy} ${limit}`,
    params
  );
  return NextResponse.json({ success: true, data: result.rows || [] });
}

async function handlePost(resource: string, body: any): Promise<NextResponse> {
  const h = HANDLERS[resource];
  if (!h) return NextResponse.json({ success: false, error: 'Unknown resource' }, { status: 400 });

  const fields = Object.keys(body).filter(k => !k.startsWith('_'));
  if (fields.length === 0) return NextResponse.json({ success: false, error: 'No fields provided' }, { status: 400 });

  const cols = fields.join(', ');
  const placeholders = fields.map((_, i) => '$' + (i + 1)).join(', ');
  const values = fields.map((f: string) => body[f]);

  const result = await query(
    `INSERT INTO ${h.table} (${cols}) VALUES (${placeholders}) RETURNING *`,
    values
  );

  return NextResponse.json({ success: true, data: result.rows?.[0] || null }, { status: 201 });
}

export async function GET(request: NextRequest) {
  try {
    const resource = getResource(request.nextUrl.pathname);
    if (!resource) return NextResponse.json({ success: false, error: 'Resource required (e.g. /api/appcc/plans)' }, { status: 400 });
    return await handleGet(resource, request.nextUrl.searchParams);
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const resource = getResource(request.nextUrl.pathname);
    if (!resource) return NextResponse.json({ success: false, error: 'Resource required' }, { status: 400 });
    const body = await request.json();
    return await handlePost(resource, body);
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}