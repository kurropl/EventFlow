/**
 * EventFlow — Dominio: generación de escandallo (lista de compras teórica)
 *
 * Única copia de la lógica que antes vivía embebida en quotes/[id]/route.ts.
 * A partir de `events.selected_items`, resuelve cada plato contra su receta
 * canónica (recipe_items + ingredients) o, en su defecto, contra el JSONB de
 * ingredientes del catálogo (sistema legacy A), y crea las filas de
 * `event_shopping_items`.
 *
 * R6.2: a diferencia de la copia original, aquí SIEMPRE se fija
 * `recipe_item_id` cuando el plato resuelve por receta — esto es lo que
 * permite que `recalcEscandallo.ts` (filtro `WHERE recipe_item_id IS NOT
 * NULL`) pueda reescalar estas filas si cambia `guest_count` más adelante.
 */

import type { PoolClient } from 'pg';

const dimsFor = (unit: string) => {
  const u = (unit || '').toLowerCase();
  if (u === 'kg') return { grams: 1000, units: 0, ml: 0 };
  if (u === 'g' || u === 'gr') return { grams: 1, units: 0, ml: 0 };
  if (u === 'l') return { grams: 0, units: 0, ml: 1000 };
  if (u === 'ml') return { grams: 0, units: 0, ml: 1 };
  return { grams: 0, units: 1, ml: 0 }; // ud, docena, caja…
};

interface ShoppingLine {
  ingredientId: string | null;
  recipeItemId: string | null;
  name: string;
  provider: string | null;
  unit: string;
  qtyNative: number;
  estimatedCost: number | null;
  category: string | null;
}

/**
 * Genera el escandallo de un evento a partir de sus `selected_items`.
 * Idempotente: si el evento ya tiene event_shopping_items, no hace nada
 * (evita duplicar filas si se llama dos veces, p.ej. en un reintento).
 */
export async function generateEscandallo(
  client: PoolClient,
  eventId: string,
  orderId: string | null
): Promise<{ created: number }> {
  const existing = (await client.query(
    `SELECT 1 FROM event_shopping_items WHERE event_id = $1 LIMIT 1`,
    [eventId]
  )).rows[0];
  if (existing) return { created: 0 };

  const eventRow = (await client.query(
    `SELECT selected_items FROM events WHERE id = $1`,
    [eventId]
  )).rows[0];
  const selectedItems: any[] = eventRow?.selected_items || [];

  const insertShopping = async (p: ShoppingLine) => {
    const f = dimsFor(p.unit);
    const grams = f.grams * p.qtyNative;
    const units = Math.round(f.units * p.qtyNative);
    const ml = f.ml * p.qtyNative;
    const dimension = grams ? 'mass' : ml ? 'volume' : 'count';
    await client.query(
      `INSERT INTO event_shopping_items
        (event_id, order_id, ingredient_id, recipe_item_id, ingredient_name, provider_name,
         total_grams, total_units, total_ml, unit_dimension,
         theoretical_qty, theoretical_unit, estimated_cost, category, completed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false)`,
      [eventId, orderId, p.ingredientId, p.recipeItemId, p.name, p.provider,
       grams, units, ml, dimension, p.qtyNative, p.unit, p.estimatedCost, p.category]
    );
  };

  let created = 0;
  for (const item of selectedItems) {
    const raciones = Number(item.quantity) || 1;
    const itemName = (item.name || '').trim();

    const catItem = (await client.query(
      `SELECT id, ingredients, category FROM catalog_items WHERE name ILIKE $1 AND active = true`,
      [itemName]
    )).rows[0];
    const dishCategory = catItem?.category || item.category || null;

    // 1) Receta canónica (sistema B): recipe_items + ingredients
    let usedRecipe = false;
    if (catItem?.id) {
      const recipe = (await client.query(
        `SELECT ri.id AS recipe_item_id, ri.quantity, i.id AS ingredient_id, i.name, i.unit, i.unit_cost, i.supplier
         FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
         WHERE ri.catalog_item_id = $1`,
        [catItem.id]
      )).rows;
      if (recipe.length > 0) {
        usedRecipe = true;
        for (const r of recipe) {
          // coste teórico: qty(receta, en unidad del ingrediente) × raciones × coste/unidad
          const qtyNative = (Number(r.quantity) || 0) * raciones;
          const estimated = r.unit_cost != null
            ? Math.round(qtyNative * Number(r.unit_cost) * 100) / 100
            : null;
          await insertShopping({
            ingredientId: r.ingredient_id, recipeItemId: r.recipe_item_id, name: r.name,
            provider: r.supplier || null, unit: r.unit, qtyNative, estimatedCost: estimated,
            category: dishCategory,
          });
          created++;
        }
      }
    }

    // 2) Fallback: JSONB del catálogo (sistema A) resolviendo por nombre
    if (!usedRecipe) {
      let ingredients: any[] = [];
      if (catItem?.ingredients) {
        try {
          ingredients = typeof catItem.ingredients === 'string'
            ? JSON.parse(catItem.ingredients) : catItem.ingredients;
        } catch { ingredients = []; }
      }
      if (ingredients.length > 0) {
        for (const ing of ingredients) {
          const name = (ing.name || 'Sin nombre').trim();
          const ingRow = (await client.query(
            `SELECT id, supplier FROM ingredients WHERE name ILIKE $1 LIMIT 1`, [name]
          )).rows[0];
          // El JSONB ya viene en g / ml / count: lo tratamos como unidad base.
          const g = Number(ing.grams) || 0, mlv = Number(ing.ml) || 0, c = Number(ing.count) || 0;
          const unit = g > 0 ? 'g' : mlv > 0 ? 'ml' : 'ud';
          const qtyNative = (g > 0 ? g : mlv > 0 ? mlv : c) * raciones;
          await insertShopping({
            ingredientId: ingRow?.id || null, recipeItemId: null, name,
            provider: ingRow?.supplier || null, unit, qtyNative, estimatedCost: null,
            category: dishCategory,
          });
          created++;
        }
      } else {
        await insertShopping({
          ingredientId: null, recipeItemId: null, name: itemName, provider: null,
          unit: 'ud', qtyNative: raciones, estimatedCost: null, category: dishCategory,
        });
        created++;
      }
    }
  }

  return { created };
}
