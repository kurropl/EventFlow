/**
 * EventFlow — API: Generar escandallo desde receta
 * POST /api/escandallo/generate
 *
 * Toma una receta y un número de comensales, y genera/actualiza
 * el escandallo con las cantidades escaladas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { recipe_id, event_id, pax } = body;

    if (!recipe_id || !event_id || !pax) {
      return NextResponse.json({ success: false, error: 'Faltan datos: recipe_id, event_id, pax' }, { status: 400 });
    }

    return transaction(async (client) => {
      // 1. Obtener receta con ingredientes
      const recipe = await client.query('SELECT id, name, cost_per_serving FROM recipes WHERE id = $1', [recipe_id]);
      if (!recipe.rows.length) throw new Error('Receta no encontrada');

      const ingredients = await client.query(
        'SELECT ri.quantity, ri.unit, ri.ingredient_id, i.name as ing_name, COALESCE(i.unit_cost, i.cost_per_unit, 0) as unit_cost FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.recipe_id = $1',
        [recipe_id]
      );

      const numGuests = Number(pax);

      // 2. Crear escandallo
      const escResult = await client.query(
        "INSERT INTO escandallos (event_id, name, version, status, pax, total_cost, cost_per_pax, created_at, updated_at) VALUES ($1, $2, 1, 'aprobado', $3, 0, 0, NOW(), NOW()) RETURNING *",
        [event_id, recipe.rows[0].name + ' - Escandallo', numGuests]
      );
      const escandalloId = escResult.rows[0].id;

      // 3. Insertar líneas de escandallo (cantidad × pax)
      let totalCost = 0;
      for (const ing of ingredients.rows) {
        const scaledQty = Number(ing.quantity) * numGuests;
        const cost = scaledQty * Number(ing.unit_cost);
        totalCost += cost;

        await client.query(
          'INSERT INTO escandallo_lines (escandallo_id, catalog_item_id, plato_name, cantidad, unit, cost_unit, cost_total, per_guest, orden) VALUES ($1, (SELECT catalog_item_id FROM recipes WHERE id = $2), $3, $4, $5, $6, $7, $8, 0)',
          [escandalloId, recipe_id, recipe.rows[0].name, scaledQty, ing.unit, ing.unit_cost, cost, ing.quantity]
        );
      }

      // 4. Actualizar totales
      const costPerPax = numGuests > 0 ? totalCost / numGuests : 0;
      await client.query(
        'UPDATE escandallos SET total_cost = $1, cost_per_pax = $2, updated_at = NOW() WHERE id = $3',
        [totalCost, costPerPax, escandalloId]
      );

      return NextResponse.json({
        success: true,
        data: {
          escandallo_id: escandalloId,
          recipe_name: recipe.rows[0].name,
          pax: numGuests,
          total_cost: totalCost,
          cost_per_pax: costPerPax,
          ingredients_count: ingredients.rows.length,
        },
        message: `Escandallo generado: ${ingredients.rows.length} ingredientes × ${numGuests} pax = ${totalCost.toFixed(2)}€`
      });
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: { message: 'Usa POST con JSON: { recipe_id, event_id, pax }' }
  });
}