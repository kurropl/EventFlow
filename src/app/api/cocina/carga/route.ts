/**
 * EventFlow — Carga API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { generateLoadingSheet } from '@/lib/cocinaSheets';

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
    const generate = body.generate === true;

    if (generate) {
      // Auto-generar hoja de carga desde el escandallo
      if (!body.evento_id) return NextResponse.json({ success: false, error: 'El evento es obligatorio' }, { status: 400 });
      const sheet = await generateLoadingSheet(body.evento_id);
      if (!sheet.applies) {
        return NextResponse.json({ success: false, error: sheet.reason || 'No aplica carga para este evento' }, { status: 400 });
      }
      // Crear hoja de carga
      const hoja = await querySingle<any>(
        "INSERT INTO hojas_carga (event_id, fecha, status, notas, created_at, updated_at) VALUES ($1, $2, 'borrador', $3, NOW(), NOW()) RETURNING *",
        [body.evento_id, body.fecha || new Date().toISOString().split('T')[0], body.notas || 'Generado automáticamente']
      );
      // Insertar items de carga desde los datos generados
      const allItems = [
        ...(sheet.perecedero || []).map(i => ({ tipo: 'perecedero', nombre: i.productName || i.catalogItemName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud' })),
        ...(sheet.noPerecedero || []).map(i => ({ tipo: 'no_perecedero', nombre: i.productName || i.catalogItemName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud' })),
        ...(sheet.vajilla || []).map(i => ({ tipo: 'vajilla', nombre: i.productName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud' })),
        ...(sheet.packs || []).map(i => ({ tipo: 'pack', nombre: i.productName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud' })),
      ];
      for (const item of allItems) {
        await querySingle<any>(
          `INSERT INTO items_carga (hoja_carga_id, tipo, nombre, cantidad, unit, cargado, orden, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, false, $6, NOW(), NOW())`,
          [hoja.id, item.tipo, item.nombre, item.cantidad, item.unit, 0]
        );
      }
      return NextResponse.json({ success: true, data: hoja, items_count: allItems.length }, { status: 201 });
    }

    if (!body.evento_id) return NextResponse.json({ success: false, error: 'El evento es obligatorio' }, { status: 400 });

    return NextResponse.json({ success: true, data: await querySingle<any>(
      "INSERT INTO hojas_carga (event_id, fecha, status, notas, created_at, updated_at) VALUES ($1, $2, 'borrador', $3, NOW(), NOW()) RETURNING *",
      [body.evento_id, body.fecha || new Date().toISOString().split('T')[0], body.notas || '']
    )}, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}