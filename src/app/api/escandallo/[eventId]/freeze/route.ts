/**
 * POST /api/escandallo/[eventId]/freeze — Congelar escandallo
 * POST /api/escandallo/[eventId]/recalc — Recalcular desde recipe_items
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function POST(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    const url = req.nextUrl.pathname;
    const action = url.endsWith('/freeze') ? 'freeze' : 'recalc';

    if (action === 'freeze') {
      // Congelar escandallo: calcular deviation y marcar frozen
      await query(
        `UPDATE event_shopping_items
         SET frozen = true,
             deviation_qty = COALESCE(NULLIF(actual_quantity, 0), 0) - COALESCE(NULLIF(theoretical_qty, 0), 0),
             deviation_cost = COALESCE(NULLIF(actual_cost_total, 0), 0) - COALESCE(NULLIF(estimated_cost, 0), 0)
         WHERE event_id = $1`,
        [eventId]
      );

      // Crear registro en event_costs con los totales
      const totals = await query(
        `SELECT COALESCE(SUM(estimated_cost), 0) as est, COALESCE(SUM(actual_cost_total), 0) as act
         FROM event_shopping_items WHERE event_id = $1`,
        [eventId]
      );

      const r = totals.rows[0] as any;
      const estCost = Number(r?.est || 0);
      const actCost = Number(r?.act || 0);

      await query(
        `INSERT INTO event_cost_deviations (event_id, estimated_cost, actual_cost, deviation, deviation_pct)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id) DO UPDATE
         SET estimated_cost = $2, actual_cost = $3, deviation = $4, deviation_pct = $5`,
        [eventId, estCost, actCost, actCost - estCost, estCost > 0 ? Math.round(((actCost - estCost) / estCost) * 100 * 100) / 100 : 0]
      );

      return NextResponse.json({
        success: true,
        data: { estimatedCost: estCost, actualCost: actCost, deviation: actCost - estCost },
      });
    } else {
      // recalc: escalar recipe_items por guest_count y crear/actualizar event_shopping_items
      const event = await query(
        `SELECT id, guest_count FROM events WHERE id = $1`,
        [eventId]
      );

      if (!event.rows?.[0]) {
        return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });
      }

      const guestCount = Number((event.rows[0] as any).guest_count || 1);

      // Obtener recipe_items del catálogo vinculado
      const recipeItems = await query(
        `SELECT ri.*, i.name as ingredient_name, i.current_price,
                COALESCE(r.servings, 1) as servings
         FROM recipe_items ri
         JOIN ingredients i ON i.id = ri.ingredient_id
         LEFT JOIN catalog_items ci ON ci.id = ri.catalog_item_id
         LEFT JOIN recipes r ON r.catalog_item_id = ci.id
         WHERE r.active = true AND r.published = true`
      );

      let created = 0;
      for (const ri of recipeItems.rows || []) {
        const r = ri as any;
        const theoreticalQty = Number(r.quantity || 0) * (guestCount / Math.max(Number(r.servings || 1), 1));

        // Upsert
        await query(
          `INSERT INTO event_shopping_items
           (event_id, ingredient_id, recipe_item_id, ingredient_name,
            theoretical_qty, theoretical_unit, unit_dimension, estimated_cost,
            recipe_version, frozen)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
           ON CONFLICT (event_id, recipe_item_id) DO UPDATE
           SET theoretical_qty = EXCLUDED.theoretical_qty,
               estimated_cost = EXCLUDED.estimated_cost,
               recipe_version = EXCLUDED.recipe_version`,
          [
            eventId,
            r.ingredient_id,
            r.id,
            r.ingredient_name,
            theoreticalQty,
            r.unit || 'g',
            r.unit_dimension || 'mass',
            theoreticalQty * Number(r.current_price || 0),
            r.version || 1,
          ]
        );
        created++;
      }

      return NextResponse.json({
        success: true,
        message: `Recalculado: ${created} items para ${guestCount} comensales`,
        guestCount,
      });
    }
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
