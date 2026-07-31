/**
 * EventFlow — Escandallos API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const tipo = new URL(request.url).searchParams.get('tipo') || 'evento';

    if (tipo === 'evento') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT e.id, e.event_id, ev.client_name as evento_nombre, ev.event_date as evento_fecha, ev.guest_count as pax, e.total_cost, e.cost_per_pax, e.version, e.status as estado, COALESCE((SELECT json_agg(json_build_object('receta_id', el.catalog_item_id, 'receta_nombre', COALESCE(ci.name, el.plato_name), 'cantidad_original', el.cantidad, 'cantidad_total', el.cantidad * COALESCE(ev.guest_count, 0), 'coste_unitario', el.cost_unit, 'coste_total', el.cost_total, 'unidad', el.unit)) FROM escandallo_lines el LEFT JOIN catalog_items ci ON ci.id = el.catalog_item_id WHERE el.escandallo_id = e.id), '[]'::json) as recetas FROM escandallos e JOIN events ev ON ev.id = e.event_id ORDER BY ev.event_date DESC, e.created_at DESC LIMIT 50", [])
      });
    }

    if (tipo === 'resumen') {
      return NextResponse.json({ success: true, data: (await queryMany<any>(
        "SELECT COUNT(DISTINCT e.id)::int as total_escandallos, COUNT(DISTINCT e.event_id)::int as total_eventos, COALESCE(SUM(e.total_cost), 0) as coste_total, COALESCE(AVG(e.cost_per_pax), 0) as coste_medio_pax FROM escandallos e WHERE e.status IN ('borrador', 'aprobado')", []))[0] || {}
      });
    }

    return NextResponse.json({ success: false, error: 'Tipo no valido' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}