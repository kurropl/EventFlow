/**
 * EventFlow — Produccion API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const fecha = new URL(request.url).searchParams.get('fecha') || new Date().toISOString().split('T')[0];

    return NextResponse.json({ success: true, data: await queryMany<any>(
      "SELECT hp.id, hp.event_id as evento_id, e.client_name as evento_nombre, hp.fecha, hp.turno, hp.status as estado, hp.notas, hp.pax, COALESCE((SELECT json_agg(json_build_object('id', tp.id, 'plato_nombre', COALESCE(ci.name, tp.plato_name), 'cantidad', tp.cantidad, 'unit', tp.unit, 'pase', tp.pase, 'asignado_a', tp.asignado_a, 'completado', tp.completado) ORDER BY tp.orden) FROM tareas_produccion tp LEFT JOIN catalog_items ci ON ci.id = tp.catalog_item_id WHERE tp.hoja_id = hp.id), '[]'::json) as items FROM hojas_produccion hp LEFT JOIN events e ON e.id = hp.event_id WHERE hp.fecha = $1::date ORDER BY hp.turno, hp.created_at",
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
      "INSERT INTO hojas_produccion (event_id, escandallo_id, fecha, turno, notas, status, pax, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, 'borrador', COALESCE((SELECT guest_count FROM events WHERE id = $1), 0), NOW(), NOW()) RETURNING *",
      [body.evento_id, body.escandallo_id || null, body.fecha || new Date().toISOString().split('T')[0], body.turno || 'manana', body.notas || '']
    )}, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}