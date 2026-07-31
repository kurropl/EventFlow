/**
 * EventFlow — Carga API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
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

    const fecha = new URL(request.url).searchParams.get('fecha') || new Date().toISOString().split('T')[0];

    return NextResponse.json({ success: true, data: await queryMany<any>(
      "SELECT hc.id, hc.event_id, e.client_name as evento_nombre, hc.fecha, hc.status as estado, hc.notas, COALESCE((SELECT json_agg(json_build_object('id', ic.id, 'tipo', ic.tipo, 'nombre', ic.nombre, 'cantidad', ic.cantidad, 'unit', ic.unit, 'cargado', ic.cargado)) FROM items_carga ic WHERE ic.hoja_carga_id = hc.id), '[]'::json) as items FROM hojas_carga hc LEFT JOIN events e ON e.id = hc.event_id WHERE hc.fecha = $1::date ORDER BY hc.created_at",
      [fecha]
    )});
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const body = await request.json();
    if (!body.evento_id) return NextResponse.json({ success: false, error: 'El evento es obligatorio' }, { status: 400 });

    return NextResponse.json({ success: true, data: await querySingle<any>(
      "INSERT INTO hojas_carga (event_id, fecha, status, notas, created_at, updated_at) VALUES ($1, $2, 'borrador', $3, NOW(), NOW()) RETURNING *",
      [body.evento_id, body.fecha || new Date().toISOString().split('T')[0], body.notas || '']
    )}, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}