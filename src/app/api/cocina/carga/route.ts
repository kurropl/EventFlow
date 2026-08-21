/**
 * EventFlow — Carga API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { generateLoadingSheet } from '@/lib/cocinaSheets';


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const fecha = new URL(request.url).searchParams.get('fecha') || new Date().toISOString().split('T')[0];
    const eventId = new URL(request.url).searchParams.get('event_id');

    let sql = "SELECT hc.id, hc.event_id, e.client_name as evento_nombre, hc.fecha, hc.status as estado, hc.notas, COALESCE((SELECT json_agg(json_build_object('id', ic.id, 'tipo', ic.tipo, 'nombre', ic.nombre, 'cantidad', ic.cantidad, 'unit', ic.unit, 'cargado', ic.cargado, 'pass_number', ic.pass_number, 'load_order', ic.load_order)) FROM items_carga ic WHERE ic.hoja_carga_id = hc.id), '[]'::json) as items FROM hojas_carga hc LEFT JOIN events e ON e.id = hc.event_id";
    const params: any[] = [];
    let idx = 1;

    if (eventId) {
      sql += " WHERE hc.event_id = $" + idx;
      params.push(eventId);
      idx++;
    } else {
      sql += " WHERE hc.fecha = $" + idx + "::date";
      params.push(fecha);
    }

    sql += " ORDER BY hc.created_at";

    const rows = await queryMany<any>(sql, params);
    // Parse JSON columns (json_agg returns strings from pg)
    for (const row of rows) {
      if (typeof row.items === 'string') {
        try { row.items = JSON.parse(row.items); } catch { row.items = []; }
      }
    }
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

// Helper: parse JSON columns that come back as strings from pg

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const body = await request.json();

    // ── Reorder items (POST /api/cocina/carga con action=reorder) ──
    if (body.action === 'reorder') {
      if (!body.hoja_carga_id || !Array.isArray(body.items)) {
        return NextResponse.json({ success: false, error: 'hoja_carga_id y items requeridos' }, { status: 400 });
      }
      const pool = await import('@/lib/db').then(m => m.getPool());
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const item of body.items) {
          await client.query(
            `UPDATE items_carga SET load_order = $1, pass_number = $2 WHERE id = $3`,
            [item.load_order, item.pass_number, item.id]
          );
        }
        await client.query('COMMIT');
        return NextResponse.json({ success: true, updated: body.items.length });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }

    // ── Generar hoja de carga ──
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
        ...(sheet.perecedero || []).map(i => ({ tipo: 'perecedero', nombre: i.productName || i.catalogItemName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud', passNumber: i.passNumber || null })),
        ...(sheet.noPerecedero || []).map(i => ({ tipo: 'no_perecedero', nombre: i.productName || i.catalogItemName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud', passNumber: i.passNumber || null })),
        ...(sheet.vajilla as any[] || []).map(i => ({ tipo: 'vajilla', nombre: i.productName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud', passNumber: i.passNumber || null })),
        ...(sheet.packs as any[] || []).map(i => ({ tipo: 'pack', nombre: i.productName || 'Item', cantidad: i.quantity || 0, unit: i.unit || 'ud', passNumber: null })),
      ];
      let orden = 1;
      for (const item of allItems) {
        await querySingle<any>(
          `INSERT INTO items_carga (hoja_carga_id, tipo, nombre, cantidad, unit, cargado, orden, pass_number, load_order)
           VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8)`,
          [hoja.id, item.tipo, item.nombre, item.cantidad, item.unit, orden, item.passNumber, orden]
        );
        orden++;
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