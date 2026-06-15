/**
 * EventFlow — Generate Order API
 * POST /api/stock/generate-order — Auto-generate supplier orders from escandallo
 *
 * Logic:
 *   a. Get all escandallo items for the event (grouped by provider_name)
 *   b. For each provider, check current stock in ingredients table
 *   c. Calculate deficit: escandallo_needed - current_stock (using convert_uom)
 *   d. Create supplier_order with supplier_name
 *   e. Create supplier_order_items for each deficit ingredient
 *   f. Return the created orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) {
    return { authenticated: false, error: 'No autenticado' };
  }
  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, error: 'Token inválido o expirado' };
  }
  return { authenticated: true };
}

// ── POST: Generate supplier orders from escandallo ──────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { event_id } = body as { event_id?: string };

    if (!event_id || !isValidUUID(event_id)) {
      return NextResponse.json(
        { success: false, error: 'event_id válido es requerido' },
        { status: 422 }
      );
    }

    // a. Get all escandallo items for the event
    const escandalloItems = await queryMany<any>(
      `SELECT
         esi.id,
         esi.ingredient_name,
         esi.provider_name,
         esi.total_grams,
         esi.total_units,
         esi.total_ml
       FROM event_shopping_items esi
       WHERE esi.event_id = $1
       ORDER BY esi.provider_name, esi.ingredient_name`,
      [event_id]
    );

    if (escandalloItems.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay items en el escandallo para este evento' },
        { status: 404 }
      );
    }

    // b. Group items by provider
    const byProvider: Record<string, any[]> = {};
    for (const item of escandalloItems) {
      const provider = item.provider_name || 'Sin proveedor';
      if (!byProvider[provider]) byProvider[provider] = [];
      byProvider[provider].push(item);
    }

    // c-f. Create orders inside a transaction
    const createdOrders = await transaction(async (client) => {
      const orders: any[] = [];

      for (const [providerName, items] of Object.entries(byProvider)) {
        // d. Create supplier_order for this provider
        const orderResult = await client.query(
          `INSERT INTO supplier_orders (supplier, status, ordered_at)
           VALUES ($1, 'pending', now())
           RETURNING *`,
          [sanitizeText(providerName, 200)]
        );
        const order = orderResult.rows[0];

        let totalCost = 0;
        const orderItems: any[] = [];

        for (const item of items) {
          // b. Check current stock for this ingredient
          const ingredient = await client.query(
            `SELECT id, quantity, unit, cost_per_unit
             FROM ingredients
             WHERE name = $1 AND active = true
             LIMIT 1`,
            [item.ingredient_name]
          );

          const ingredientRow = ingredient.rows?.[0];

          // Determine the amount needed from escandallo
          // Use grams if available, then units, then ml
          let neededAmount = 0;
          let neededUnit = 'ud';
          if (Number(item.total_grams) > 0) {
            neededAmount = Number(item.total_grams);
            neededUnit = 'g';
          } else if (Number(item.total_units) > 0) {
            neededAmount = Number(item.total_units);
            neededUnit = 'ud';
          } else if (Number(item.total_ml) > 0) {
            neededAmount = Number(item.total_ml);
            neededUnit = 'ml';
          }

          // c. Calculate deficit using convert_uom
          let deficit = neededAmount;
          if (ingredientRow) {
            const currentStock = Number(ingredientRow.quantity) || 0;
            const stockUnit = ingredientRow.unit || 'ud';

            // Convert escandallo needed amount to the stock's unit
            const neededInStockUnit = await client.query(
              `SELECT convert_uom($1, $2, $3) AS converted`,
              [neededAmount, neededUnit, stockUnit]
            );
            const converted = Number(neededInStockUnit.rows?.[0]?.converted) || 0;
            deficit = converted - currentStock;
          }

          // Only create an order item if there's a deficit
          if (deficit > 0) {
            const unitCost = Number(ingredientRow?.cost_per_unit) || 0;
            totalCost += deficit * unitCost;

            const orderItemResult = await client.query(
              `INSERT INTO supplier_order_items
                 (order_id, ingredient_name, quantity, unit, cost_per_unit, received_quantity)
               VALUES ($1, $2, $3, $4, $5, 0)
               RETURNING *`,
              [
                order.id,
                item.ingredient_name,
                deficit,
                ingredientRow?.unit || neededUnit,
                unitCost,
              ]
            );
            orderItems.push(orderItemResult.rows[0]);
          }
        }

        // Update total cost on the order
        await client.query(
          `UPDATE supplier_orders SET total_cost = $1, updated_at = now() WHERE id = $2`,
          [totalCost, order.id]
        );

        orders.push({
          ...order,
          total_cost: totalCost,
          items: orderItems,
        });
      }

      return orders;
    });

    return NextResponse.json({ success: true, data: createdOrders });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
