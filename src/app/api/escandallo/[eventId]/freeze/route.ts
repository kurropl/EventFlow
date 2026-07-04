/**
 * POST /api/escandallo/[eventId]/freeze — Congelar escandallo
 * POST /api/escandallo/[eventId]/recalc — Recalcular desde recipe_items
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { freezeEscandallo } from '@/lib/escandallo';

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
      // Congela el escandallo y persiste el snapshot de desviación (fuente única).
      const { estimado, real, desviacion } = await freezeEscandallo(eventId);
      return NextResponse.json({
        success: true,
        data: { estimatedCost: estimado, actualCost: real, deviation: desviacion },
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
      if (guestCount <= 0) {
        return NextResponse.json({ success: false, error: 'Invalid guest count' }, { status: 400 });
      }

      // Obtener recipe_items activos
      const recipeItems = await query(
        `SELECT ri.*, i.name as ingredient_name, i.current_price,
                COALESCE(r.servings, 1) as servings
         FROM recipe_items ri
         JOIN ingredients i ON i.id = ri.ingredient_id
         LEFT JOIN catalog_items ci ON ci.id = ri.catalog_item_id
         LEFT JOIN recipes r ON r.catalog_item_id = ci.id
         WHERE r.active = true AND r.published = true`,
        []
      );

      // T3.8: skip frozen items — don't overwrite frozen escandallo on recalc
      let created = 0, skipped = 0;
      for (const raw of recipeItems.rows || []) {
        const ri = raw as any;

        // Check if this items already has a frozen record
        const existing = await query(
          `SELECT id FROM event_shopping_items
           WHERE event_id = $1 AND recipe_item_id = $2 AND frozen = true`,
          [eventId, ri.id]
        );
        if (existing.rows?.length) { skipped++; continue; }
        const factor = guestCount / Math.max(Number(ri.servings || 1), 1);
        const theoreticalQty = Math.round(Number(ri.quantity || 0) * factor * 100) / 100;
        const estCost = Math.round(theoreticalQty * Number(ri.current_price || 0) * 100) / 100;

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
            ri.ingredient_id,
            ri.id,
            ri.ingredient_name,
            theoreticalQty,
            ri.unit || 'g',
            ri.unit_dimension || 'mass',
            estCost,
            ri.version || 1,
          ]
        );
        created++;
      }

      return NextResponse.json({
        success: true,
        message: `Recalculado: ${created} items para ${guestCount} comensales (${skipped} congelados omitidos)`,
        guestCount,
      });
    }
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
