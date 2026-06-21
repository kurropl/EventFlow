/**
 * EventFlow — API de costes unificada
 * 
 * GET /api/costing/[eventId] — Devuelve el coste calculado de un evento
 * 
 * Mismo endpoint llamado desde presupuesto, escandallo y factura.
 * Garantiza que los tres vean exactamente el mismo coste.
 * 
 * Si el evento está en 'accepted' / 'won' → coste congelado (de event_costs)
 * Si está en 'draft' / 'sent' → se recalcula desde catálogo
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, querySingle, queryMany } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  context: { params: { eventId: string } }
) {
  const eventId = context.params.eventId;

  if (!eventId || eventId === 'undefined') {
    return NextResponse.json({ success: false, error: 'eventId requerido' }, { status: 400 });
  }

  try {
    // 1. Obtener evento y su estado
    const event = await querySingle<{
      id: string;
      status: string;
      guest_count: number;
      selected_items: any;
      total_pvp: string;
    }>(
      `SELECT id, status, guest_count, selected_items, total_pvp FROM events WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }

    // 2. Si el evento está en accepted/won → coste congelado de event_costs
    if (event.status === 'accepted' || event.status === 'won') {
      const lines = await queryMany<{
        id: string;
        ingredient_name: string;
        quantity: number;
        unit: string;
        unit_cost: number;
        line_total: number;
      }>(
        `SELECT id, ingredient_name, quantity, unit, unit_cost, line_total
         FROM event_costs WHERE event_id = $1`,
        [eventId]
      );

      const subtotal = lines.reduce((s, l) => s + Number(l.line_total || 0), 0);
      const margin = subtotal * 0.2;
      const pvp = subtotal + margin;

      return NextResponse.json({
        success: true,
        source: 'frozen',
        subtotal,
        margin,
        marginPercent: 20,
        pvp,
        lines,
      });
    }

    // 3. Si está en draft/sent → calcular desde catálogo
    if (!event.selected_items || !Array.isArray(event.selected_items) || event.selected_items.length === 0) {
      return NextResponse.json({
        success: true,
        source: 'calculated',
        subtotal: 0,
        margin: 0,
        marginPercent: 0,
        pvp: Number(event.total_pvp) || 0,
        lines: [],
      });
    }

    // Obtener items seleccionados con sus nombres
    const items = event.selected_items.map((item: any) => ({
      name: item.name || item.item_id || '',
      quantity: Number(item.quantity) || 0,
    })).filter((i: any) => i.name && i.quantity > 0);

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        source: 'calculated',
        subtotal: 0,
        margin: 0,
        marginPercent: 0,
        pvp: Number(event.total_pvp) || 0,
        lines: [],
      });
    }

    // Buscar cada item en el catálogo para obtener sus ingredientes
    const lines: any[] = [];
    let subtotal = 0;

    for (const item of items) {
      const catalogItem = await querySingle<{
        id: string;
        pvp: string;
        cost: string;
        ingredients: any;
      }>(
        `SELECT id, pvp, cost, ingredients FROM catalog_items WHERE name = $1`,
        [item.name]
      );

      if (!catalogItem) {
        lines.push({
          ingredientId: null,
          ingredientName: item.name,
          quantity: 0,
          unit: 'g',
          unitCost: 0,
          lineTotal: 0,
          note: 'No encontrado en catálogo',
        });
        continue;
      }

      // Parsear ingredientes del catálogo (JSONB array)
      const ingredients = Array.isArray(catalogItem.ingredients)
        ? catalogItem.ingredients
        : (typeof catalogItem.ingredients === 'string'
            ? JSON.parse(catalogItem.ingredients)
            : []);

      for (const ing of ingredients) {
        const grams = Number(ing.grams) || 0;
        const count = Number(ing.count) || 0;
        const ml = Number(ing.ml) || 0;
        const ingName = ing.name || 'desconocido';
        const ingId = ing.id || null;

        // Buscar el ingrediente en la tabla ingredients
        const ingredient = await querySingle<{
          id: string;
          name: string;
          unit_cost: number;
        }>(
          `SELECT id, name, unit_cost FROM ingredients WHERE name = $1 LIMIT 1`,
          [ingName]
        );

        const unitCost = ingredient?.unit_cost || 0;
        const qty = (grams || ml || count) * item.quantity;
        const cost = qty * unitCost;

        if (qty > 0) {
          lines.push({
            ingredientId: ingredient?.id || ingId,
            ingredientName: ingName,
            quantity: qty,
            unit: grams > 0 ? 'g' : ml > 0 ? 'ml' : 'ud',
            unitCost,
            lineTotal: cost,
          });
          subtotal += cost;
        }
      }
    }

    const margin = subtotal * 0.2;
    const pvp = subtotal + margin;

    return NextResponse.json({
      success: true,
      source: 'calculated',
      subtotal,
      margin,
      marginPercent: subtotal > 0 ? 20 : 0,
      pvp,
      lines,
    });

  } catch (error: any) {
    console.error('[api/costing] Error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}