/**
 * EventFlow — Shopping Items API (SECURED)
 * 
 * Security:
 * - UUID validation on all IDs
 * - Input sanitization on text fields
 * - Numeric bounds on quantities
 * - Rate limiting via middleware
 * - Field whitelist on PUT (no SQL injection)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, query } from '@/lib/db';
import {
  isValidUUID,
  sanitizeText,
  toSafeInt,
  toSafeFloat,
  securityHeaders,
} from '@/lib/security';

// ── GET: List items for an event ─────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { success: false, error: 'event_id inválido.' },
        { status: 422, headers: securityHeaders() }
      );
    }
    const rows = await queryMany<any>(
      `SELECT * FROM event_shopping_items WHERE event_id = $1 ORDER BY ingredient_name ASC`,
      [eventId]
    );
    return NextResponse.json({ success: true, data: rows }, { headers: securityHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: securityHeaders() });
  }
}

// ── POST: Add item or regenerate ─────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Regenerate from catalog ───────────────────────────────────
    if (body.action === 'regenerate' && body.event_id) {
      if (!isValidUUID(body.event_id)) {
        return NextResponse.json({ success: false, error: 'event_id inválido.' }, { status: 422, headers: securityHeaders() });
      }
      const items = await regenerateShoppingList(body.event_id);
      return NextResponse.json({ success: true, data: items }, { headers: securityHeaders() });
    }

    // ── Add new item ──────────────────────────────────────────────
    if (!body.event_id || !isValidUUID(body.event_id)) {
      return NextResponse.json({ success: false, error: 'event_id inválido.' }, { status: 422, headers: securityHeaders() });
    }
    const ingredientName = sanitizeText(body.ingredient_name, 200);
    if (!ingredientName) {
      return NextResponse.json({ success: false, error: 'ingredient_name es obligatorio.' }, { status: 422, headers: securityHeaders() });
    }

    const created = await querySingle<any>(
      `INSERT INTO event_shopping_items (event_id, order_id, ingredient_name, provider_name, total_grams, total_units, total_ml, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        body.event_id,
        body.order_id && isValidUUID(body.order_id) ? body.order_id : null,
        ingredientName,
        sanitizeText(body.provider_name || '—', 100),
        toSafeFloat(body.total_grams),
        toSafeInt(body.total_units),
        toSafeInt(body.total_ml),
        sanitizeText(body.notes || '', 500) || null,
      ]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201, headers: securityHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: securityHeaders() });
  }
}

// ── PUT: Update an item (whitelist-based, no SQL injection) ──────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id;
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'id inválido.' }, { status: 422, headers: securityHeaders() });
    }

    // Field whitelist with sanitizers
    const allowed: Record<string, (v: any) => any> = {
      ingredient_name: (v) => sanitizeText(String(v), 200),
      provider_name: (v) => sanitizeText(String(v), 100),
      total_grams: (v) => toSafeFloat(v),
      total_units: (v) => toSafeInt(v),
      total_ml: (v) => toSafeInt(v),
      custom_qty: (v) => toSafeFloat(v),
      notes: (v) => sanitizeText(String(v), 500) || null,
      completed: (v) => Boolean(v),
    };

    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, transform] of Object.entries(allowed)) {
      if (key in body && body[key] !== undefined) {
        fields.push(`${key} = $${idx}`);
        values.push(transform(body[key]));
        idx++;
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que actualizar.' }, { status: 422, headers: securityHeaders() });
    }

    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE event_shopping_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    return NextResponse.json({ success: true, data: updated }, { headers: securityHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: securityHeaders() });
  }
}

// ── DELETE: Remove an item ───────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'id inválido.' }, { status: 422, headers: securityHeaders() });
    }
    await querySingle<any>(`DELETE FROM event_shopping_items WHERE id = $1`, [id]);
    return NextResponse.json({ success: true }, { headers: securityHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: securityHeaders() });
  }
}

// ── Internal: Regenerate from shopping_list view ─────────────────────
async function regenerateShoppingList(eventId: string) {
  await query(`DELETE FROM event_shopping_items WHERE event_id = $1`, [eventId]);
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
