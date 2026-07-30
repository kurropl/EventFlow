/**
 * EventFlow — Shopping Items API (SECURED)
 * 
 * Security:
 * - UUID validation on all IDs
 * - Input sanitization on text fields
 * - Numeric bounds on quantities
 * - Rate limiting via middleware
 * - Field whitelist on PUT (no SQL injection)
 *
 * WP-09: Al marcar/desmarcar items, se crean movimientos de stock
 * - completed=true → movimiento 'salida' con event_id (FEFO)
 * - completed=false → movimiento 'retorno' inverso
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, query, getPool } from '@/lib/db';
import {
  isValidUUID,
  sanitizeText,
  toSafeInt,
  toSafeFloat,
  securityHeaders,
  sanitizeError,
} from '@/lib/security';
import { recordConsumption, recordReturn } from '@/lib/domain/eventConsumption';

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
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500, headers: securityHeaders() });
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
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500, headers: securityHeaders() });
  }
}

// ── PUT: Update an item (whitelist-based, no SQL injection) ──────────
// WP-09: Al cambiar completed, crea movimiento de stock
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const id = body.id;
    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'id inválido.' }, { status: 422, headers: securityHeaders() });
    }

    // Obtener el item actual para detectar cambio en completed
    const currentItem = await querySingle<any>(
      `SELECT * FROM event_shopping_items WHERE id = $1`,
      [id]
    );

    if (!currentItem) {
      return NextResponse.json({ success: false, error: 'Item no encontrado.' }, { status: 404, headers: securityHeaders() });
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

    // ── WP-09: Manejar cambio en completed ─────────────────────────
    if (body.completed !== undefined && body.completed !== currentItem.completed) {
      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        if (body.completed === true && !currentItem.completed) {
          // Marcar como completado → crear movimiento de salida
          const quantityBase = calculateQuantityBase(
            Number(currentItem.total_grams) || 0,
            Number(currentItem.total_units) || 0,
            Number(currentItem.total_ml) || 0
          );

          if (quantityBase > 0 && currentItem.ingredient_id) {
            await recordConsumption(
              {
                eventId: currentItem.event_id,
                shoppingItemId: id,
                ingredientId: currentItem.ingredient_id,
                ingredientName: currentItem.ingredient_name,
                quantityBase,
                userId: body.user_id || null,
              },
              client
            );
          }
        } else if (body.completed === false && currentItem.completed) {
          // Desmarcar → crear retorno (movimiento inverso)
          if (currentItem.stock_movement_id && currentItem.ingredient_id) {
            // Obtener el movimiento original para saber la cantidad
            const originalMovement = await querySingle<any>(
              `SELECT qty_base FROM stock_movements WHERE id = $1`,
              [currentItem.stock_movement_id]
            );

            if (originalMovement) {
              const returnQty = Math.abs(Number(originalMovement.qty_base));
              await recordReturn(
                {
                  eventId: currentItem.event_id,
                  ingredientId: currentItem.ingredient_id,
                  ingredientName: currentItem.ingredient_name,
                  quantityReturned: returnQty,
                  userId: body.user_id || null,
                  notes: `Desmarcar item en Carga`,
                },
                client
              );
            }
          }
        }

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en movimiento de stock:', error);
        // No fallamos la actualización del item por un error en stock
        // pero registramos el error
      } finally {
        client.release();
      }
    }

    return NextResponse.json({ success: true, data: updated }, { headers: securityHeaders() });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500, headers: securityHeaders() });
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
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500, headers: securityHeaders() });
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

// ── Helper: Calcular cantidad en unidad base ─────────────────────────
function calculateQuantityBase(grams: number, units: number, ml: number): number {
  // Priorizar gramos > unidades > ml
  if (grams > 0) return grams;
  if (units > 0) return units;
  if (ml > 0) return ml;
  return 0;
}
