/**
 * EventFlow — Logística Items API (Event equipment, linked to stock)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { generateLogisticsSheet } from '@/lib/cocinaSheets';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const eventId = new URL(request.url).searchParams.get('event_id');
    if (!eventId) return NextResponse.json({ success: false, error: 'event_id requerido' }, { status: 400 });

    const items = await queryMany<any>(
      `SELECT il.*, e.name as stock_name, e.stock_quantity as stock_total, e.category as stock_category
       FROM items_logistica il
       LEFT JOIN equipment e ON e.id = il.equipment_id
       WHERE il.event_id = $1
       ORDER BY il.tipo, il.orden, il.created_at`,
      [eventId]
    );

    return NextResponse.json({ success: true, data: items });
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
      // Auto-generar items de logística desde el escandallo
      if (!body.event_id) return NextResponse.json({ success: false, error: 'event_id es obligatorio' }, { status: 400 });
      const sheet = await generateLogisticsSheet(body.event_id);
      const allItems = [
        ...(sheet.equipment || []).map(i => ({ tipo: 'equipos', nombre: (i as any).name || 'Equipo', cantidad: (i as any).needed || 1, unit: (i as any).unit || 'ud' })),
        ...(sheet.dryGoods || []).map(i => ({ tipo: 'mobiliario', nombre: (i as any).productName || 'Item seco', cantidad: (i as any).quantity || 1, unit: (i as any).unit || 'ud' })),
        ...(sheet.perishableGoods || []).map(i => ({ tipo: 'utensilios', nombre: (i as any).productName || 'Item perecedero', cantidad: (i as any).quantity || 1, unit: (i as any).unit || 'ud' })),
        ...(sheet.disposables || []).map(i => ({ tipo: 'otros', nombre: (i as any).productName || 'Descartable', cantidad: (i as any).quantity || 1, unit: (i as any).unit || 'ud' })),
      ];
      let inserted = 0;
      for (const item of allItems) {
        const existing = await queryMany<any>(
          'SELECT id FROM items_logistica WHERE event_id = $1 AND nombre = $2',
          [body.event_id, item.nombre]
        );
        if (existing.length > 0) continue;
        const maxOrden = await querySingle<any>(
          "SELECT COALESCE(MAX(orden), 0) + 1 as next_orden FROM items_logistica WHERE event_id = $1",
          [body.event_id]
        );
        await querySingle<any>(
          `INSERT INTO items_logistica (event_id, tipo, nombre, cantidad, unit, preparado, cargado, notas, orden, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, false, false, $6, $7, NOW(), NOW())`,
          [body.event_id, item.tipo, item.nombre, item.cantidad, item.unit, 'Generado automáticamente', maxOrden?.next_orden || 1]
        );
        inserted++;
      }
      return NextResponse.json({ success: true, data: { inserted, total: allItems.length } }, { status: 201 });
    }

    if (!body.event_id || !body.nombre) {
      return NextResponse.json({ success: false, error: 'event_id y nombre son obligatorios' }, { status: 400 });
    }

    const maxOrden = await querySingle<any>(
      "SELECT COALESCE(MAX(orden), 0) + 1 as next_orden FROM items_logistica WHERE event_id = $1",
      [body.event_id]
    );

    const item = await querySingle<any>(
      `INSERT INTO items_logistica (event_id, tipo, nombre, cantidad, unit, equipment_id, preparado, cargado, notas, orden, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, false, false, $7, $8, NOW(), NOW())
       RETURNING *`,
      [
        body.event_id,
        body.tipo || 'mobiliario',
        body.nombre,
        body.cantidad || 1,
        body.unit || 'ud',
        body.equipment_id || null,
        body.notas || null,
        maxOrden?.next_orden || 1
      ]
    );

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID es obligatorio' }, { status: 400 });
    }

    const item = await querySingle<any>(
      `UPDATE items_logistica SET
        tipo = COALESCE($1, tipo),
        nombre = COALESCE($2, nombre),
        cantidad = COALESCE($3, cantidad),
        unit = COALESCE($4, unit),
        equipment_id = $5,
        preparado = COALESCE($6, preparado),
        cargado = COALESCE($7, cargado),
        notas = $8,
        orden = COALESCE($9, orden),
        updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        body.tipo, body.nombre, body.cantidad,
        body.unit, body.equipment_id ?? null,
        body.preparado, body.cargado,
        body.notas ?? null, body.orden, body.id
      ]
    );

    if (!item) {
      return NextResponse.json({ success: false, error: 'Item no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'ID es obligatorio' }, { status: 400 });
    }

    await querySingle<any>(
      "DELETE FROM items_logistica WHERE id = $1",
      [body.id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}