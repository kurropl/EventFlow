/**
 * EventFlow — Dashboard Cocina API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
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

    const recetas = await querySingle<any>("SELECT COUNT(*)::int as count FROM catalog_items WHERE active = true", []);
    const esc = await querySingle<any>("SELECT COUNT(*)::int as count FROM escandallos WHERE status IN ('borrador', 'aprobado')", []);
    const prod = await querySingle<any>("SELECT COUNT(*)::int as count FROM hojas_produccion WHERE fecha = CURRENT_DATE", []);
    const aler = await querySingle<any>("SELECT COUNT(*)::int as count FROM inventory WHERE quantity <= min_stock AND min_stock > 0", []);

    const evs = await queryMany<any>(
      "SELECT e.id, e.client_name, e.event_date, e.guest_count FROM events e WHERE e.event_date >= CURRENT_DATE AND e.event_date <= CURRENT_DATE + INTERVAL '7 days' AND e.status NOT IN ('canceled', 'rechazado') ORDER BY e.event_date LIMIT 10", []
    );
    const pax = evs.reduce((s: number, e: any) => s + (Number(e.guest_count) || 0), 0);

    const act = await queryMany<any>(
      "SELECT 'receta' as tipo, ci.name as descripcion, NULL as evento, ci.created_at as fecha, '/admin/cocina/recetas' as href FROM catalog_items ci WHERE ci.created_at >= NOW() - INTERVAL '7 days' AND ci.active = true UNION ALL SELECT 'escandallo' as tipo, COALESCE(e.name, 'Escandallo') as descripcion, ev.client_name as evento, e.updated_at as fecha, '/admin/cocina/escandallos' as href FROM escandallos e JOIN events ev ON ev.id = e.event_id WHERE e.updated_at >= NOW() - INTERVAL '7 days' UNION ALL SELECT 'produccion' as tipo, 'Hoja' as descripcion, ev.client_name as evento, hp.updated_at as fecha, '/admin/cocina/produccion' as href FROM hojas_produccion hp JOIN events ev ON ev.id = hp.event_id WHERE hp.updated_at >= NOW() - INTERVAL '7 days' ORDER BY fecha DESC LIMIT 10", []
    );

    return NextResponse.json({ success: true, data: { kpis: { recetas_activas: recetas?.count ?? 0, escandallos_activos: esc?.count ?? 0, produccion_hoy: prod?.count ?? 0, alertas_stock: aler?.count ?? 0, eventos_semana: evs.length, pax_semana: pax }, actividad: act.map((a: any, i: number) => ({ id: String(i), tipo: a.tipo, descripcion: a.descripcion, evento: a.evento, fecha: a.fecha ? new Date(a.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '-', href: a.href })) } });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}