/**
 * EventFlow — Escandallo API
 *
 * GET  /api/escandallo/[eventId]   — Items de escandallo para un evento
 * PUT  /api/escandallo/[eventId]   — Actualizar consumos reales
 * POST /api/escandallo/[eventId]/freeze — Congelar escandallo
 * POST /api/escandallo/[eventId]/recalc — Recalcular desde recipe_items
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

// ── GET ──
export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    const result = await query(
      `SELECT esi.*, ri.quantity as recipe_qty, ri.unit as recipe_unit,
              i.name as ingredient_name, i.current_price,
              ri.version as recipe_item_version,
              eo.confirmed_price, eo.extra_consumptions
       FROM event_shopping_items esi
       LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
       LEFT JOIN ingredients i ON i.id = esi.ingredient_id
       LEFT JOIN event_orders eo ON eo.id = esi.order_id
       WHERE esi.event_id = $1
       ORDER BY esi.ingredient_name ASC`,
      [eventId]
    );

    const eventResult = await query(
      `SELECT e.id, e.client_name, e.event_date, e.guest_count, e.total_pvp, e.total_cost,
              e.status, e.event_type
       FROM events e WHERE e.id = $1`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      data: result.rows || [],
      event: eventResult.rows?.[0] || null,
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

// ── PUT (actualizar consumos reales) ──
export async function PUT(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    const body = await req.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'items array required' }, { status: 400 });
    }

    const updated: any[] = [];
    for (const item of items) {
      if (!item.id) continue;

      const result = await query(
        `UPDATE event_shopping_items
         SET actual_quantity = COALESCE($1, actual_quantity),
             actual_unit = COALESCE($2, actual_unit),
             actual_cost = COALESCE($3, actual_cost),
             cost_per_unit = COALESCE($4, cost_per_unit),
             actual_cost_total = COALESCE($5, actual_cost_total),
             notes = COALESCE($6, notes),
             updated_at = now()
         WHERE id = $1 AND event_id = $2
         RETURNING *`,
        [
          item.actual_quantity ?? null,
          item.actual_unit ?? null,
          item.actual_cost ?? null,
          item.cost_per_unit ?? null,
          item.actual_cost_total ?? null,
          item.notes ?? null,
          eventId,
        ]
      );

      if (result.rows?.[0]) {
        updated.push(result.rows[0]);
      }
    }

    // Recalcular total_cost del evento
    const totalsResult = await query(
      `SELECT COALESCE(SUM(actual_cost_total), 0) as total_actual_cost
       FROM event_shopping_items WHERE event_id = $1`,
      [eventId]
    );

    const totalActualCost = Number((totalsResult.rows[0] as any)?.total_actual_cost || 0);

    // Actualizar deviation_qty y deviation_cost
    await query(
      `UPDATE event_shopping_items
       SET deviation_qty = COALESCE(NULLIF(actual_quantity, 0), 0) - COALESCE(NULLIF(theoretical_qty, 0), 0),
           deviation_cost = COALESCE(NULLIF(actual_cost_total, 0), 0) - COALESCE(NULLIF(estimated_cost, 0), 0)
       WHERE event_id = $1 AND frozen = false`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      updated: updated.length,
      totalActualCost,
      message: updated.length > 0
        ? 'Consumos reales actualizados'
        : 'No se actualizó ningún item',
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
