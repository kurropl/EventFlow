/**
 * EventFlow — Shopping Items API (Escandallo editable)
 * GET    /api/shopping?event_id= — List items for an event
 * POST   /api/shopping — Add a new item
 * PUT    /api/shopping/[id] — Update an item (qty, notes, completed)
 * DELETE /api/shopping/[id] — Remove an item
 * POST   /api/shopping/generate?event_id= — Recalculate from catalog
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'event_id es obligatorio' }, { status: 422 });
    }
    const rows = await queryMany<any>(
      `SELECT * FROM event_shopping_items WHERE event_id = $1 ORDER BY ingredient_name ASC`,
      [eventId]
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Regenerate from catalog
    if (body.action === 'regenerate' && body.event_id) {
      const items = await regenerateShoppingList(body.event_id);
      return NextResponse.json({ success: true, data: items });
    }

    if (!body.event_id || !body.ingredient_name?.trim()) {
      return NextResponse.json({ success: false, error: 'event_id y ingredient_name son obligatorios' }, { status: 422 });
    }
    const created = await querySingle<any>(
      `INSERT INTO event_shopping_items (event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        body.event_id,
        body.order_id || null,
        body.ingredient_name.trim(),
        body.provider_name || '—',
        body.total_grams || 0,
        body.total_units || 0,
        body.total_ml || 0,
        body.notes || null,
      ]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id es obligatorio' }, { status: 422 });
    }
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const key of ['ingredient_name', 'provider_name', 'total_grams', 'total_units', 'total_ml', 'custom_qty', 'notes', 'completed']) {
      if (body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(body[key]);
        idx++;
      }
    }
    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay campos para actualizar' }, { status: 422 });
    }
    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE event_shopping_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}



// POST with action=regenerate — recalculate from shopping_list view
async function regenerateShoppingList(eventId: string) {
  // First delete existing items
  await query(`DELETE FROM event_shopping_items WHERE event_id = $1`, [eventId]);
  // Then insert from the view
  const inserted = await queryMany<any>(
    `INSERT INTO event_shopping_items (event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml)
     SELECT event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml
     FROM shopping_list WHERE event_id = $1
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [eventId]
  );
  return inserted;
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'id es obligatorio' }, { status: 422 });
    }
    await querySingle<any>(`DELETE FROM event_shopping_items WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
