/**
 * EventFlow — APPCC API (CORREGIDA)
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

    const tipo = new URL(request.url).searchParams.get('tipo') || 'resumen';

    if (tipo === 'temperaturas') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT ftl.id, ftl.fridge_name, ftl.temperature, ftl.recorded_at, ftl.event_id, e.client_name as evento_nombre FROM fridge_temperature_log ftl LEFT JOIN events e ON e.id = ftl.event_id ORDER BY ftl.recorded_at DESC LIMIT 50", []
      )});
    }
    if (tipo === 'limpieza') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT cl.id, cl.area, cl.performed_by, cl.performed_at, cl.verified_by, cl.event_id, e.client_name as evento_nombre FROM cleaning_log cl LEFT JOIN events e ON e.id = cl.event_id ORDER BY cl.performed_at DESC LIMIT 50", []
      )});
    }
    if (tipo === 'trazabilidad') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT tl.id, tl.ingredient_id, i.name as ingrediente, tl.lot_number, tl.used_at, tl.event_id, e.client_name as evento_nombre FROM traceability_log tl LEFT JOIN ingredients i ON i.id = tl.ingredient_id LEFT JOIN events e ON e.id = tl.event_id ORDER BY tl.used_at DESC LIMIT 50", []
      )});
    }

    const t = await queryMany<any>("SELECT COUNT(*)::int as total FROM fridge_temperature_log", []);
    const c = await queryMany<any>("SELECT COUNT(*)::int as total FROM cleaning_log", []);
    const tr = await queryMany<any>("SELECT COUNT(*)::int as total FROM traceability_log", []);
    return NextResponse.json({ success: true, data: { resumen: { temperaturas: t[0]?.total || 0, limpieza: c[0]?.total || 0, trazabilidad: tr[0]?.total || 0 } } });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}