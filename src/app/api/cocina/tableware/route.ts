/**
 * EventFlow — Tableware API (Vajilla/Loza)
 * 
 * GET    /api/cocina/tableware          — List tableware inventory
 * POST   /api/cocina/tableware          — Add tableware item
 * PUT    /api/cocina/tableware/[id]     — Update item
 * DELETE /api/cocina/tableware/[id]     — Delete item
 * GET    /api/cocina/tableware/event    — Get tableware for event
 * POST   /api/cocina/tableware/event    — Assign tableware to event
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const searchParams = new URL(request.url).searchParams;
    const eventId = searchParams.get('event_id');

    if (eventId) {
      // Get tableware for specific event
      const items = await queryMany<any>(
        `SELECT et.*, ti.tipo, ti.nombre, ti.stock_total, ti.proveedor, ti.coste_alquiler
         FROM event_tableware et
         JOIN tableware_items ti ON ti.id = et.item_id
         WHERE et.event_id = $1
         ORDER BY ti.tipo, ti.nombre`,
        [eventId]
      );
      return NextResponse.json({ success: true, data: items });
    }

    // Get all tableware inventory
    const items = await queryMany<any>(
      "SELECT * FROM tableware_items WHERE active = true ORDER BY tipo, nombre",
      []
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
    
    // Check if it's assigning to event or creating new item
    if (body.event_id && body.items) {
      // Assign tableware to event
      await queryMany("DELETE FROM event_tableware WHERE event_id = $1", [body.event_id]);
      
      const results = [];
      for (const item of body.items) {
        const result = await querySingle<any>(
          `INSERT INTO event_tableware (event_id, item_id, cantidad_necesaria, proveedor, alquilado, notas, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           RETURNING *`,
          [body.event_id, item.item_id, item.cantidad_necesaria, item.proveedor || null, item.alquilado || false, item.notas || null]
        );
        results.push(result);
      }
      return NextResponse.json({ success: true, data: results }, { status: 201 });
    }

    // Create new tableware item
    if (!body.tipo || !body.nombre) {
      return NextResponse.json({ success: false, error: 'tipo y nombre requeridos' }, { status: 400 });
    }

    const item = await querySingle<any>(
      `INSERT INTO tableware_items (tipo, nombre, stock_total, stock_disponible, proveedor, coste_alquiler, active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, true, NOW())
       RETURNING *`,
      [body.tipo, body.nombre, body.stock_total || 0, body.stock_disponible || 0, body.proveedor || null, body.coste_alquiler || 0]
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
    if (!body.id) return NextResponse.json({ success: false, error: 'ID requerido' }, { status: 400 });

    const item = await querySingle<any>(
      `UPDATE tableware_items SET
        tipo = COALESCE($1, tipo),
        nombre = COALESCE($2, nombre),
        stock_total = COALESCE($3, stock_total),
        stock_disponible = COALESCE($4, stock_disponible),
        proveedor = $5,
        coste_alquiler = COALESCE($6, coste_alquiler)
       WHERE id = $7
       RETURNING *`,
      [body.tipo, body.nombre, body.stock_total, body.stock_disponible, body.proveedor, body.coste_alquiler, body.id]
    );

    if (!item) return NextResponse.json({ success: false, error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}