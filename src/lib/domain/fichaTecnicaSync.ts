/**
 * EventFlow — Sincronización de la ficha técnica de recetas
 *
 * Antes una receta vivía en dos estados: "borrador" (solo `recipes`, con
 * ingredientes en un JSONB suelto) y "publicada" (con `catalog_item_id` +
 * `recipe_items` reales) — un paso manual que la UI ni siquiera invocaba
 * correctamente. Ahora toda receta tiene su `catalog_item_id` desde que se
 * crea; `ensureCatalogItem` solo cubre las filas antiguas que quedaron sin
 * él. `recomputeFicha` recalcula peso/raciones/coste tras cualquier cambio
 * de metadatos o de líneas de ingrediente, y sincroniza `recipes.servings`
 * (que generateEscandallo/freeze siguen usando como divisor de escala) y
 * `catalog_items.cost` con el resultado.
 */
import type { PoolClient } from 'pg';
import { computeFichaTotales, type FichaTotales } from '@/lib/fichaTecnica';
import { CATALOG_CATEGORIES } from '@/lib/recipeImport';
import { getLatestIngredientPrice } from '@/lib/ingredientPrice';

export async function ensureCatalogItem(client: PoolClient, recipeId: string): Promise<string> {
  // WP-11: ahora el id de receta ES el catalog_item_id (tabla unificada)
  const r = (await client.query(
    `SELECT id, name, category FROM catalog_items WHERE id = $1`,
    [recipeId]
  )).rows[0];
  if (!r) throw new Error('Receta no encontrada');
  return r.id;
}

export async function recomputeFicha(client: PoolClient, recipeId: string): Promise<FichaTotales> {
  // WP-11: la receta ahora vive directamente en catalog_items
  const recipe = (await client.query(
    `SELECT merma_pct, peso_racion, id FROM catalog_items WHERE id = $1`,
    [recipeId]
  )).rows[0];
  if (!recipe) throw new Error('La receta no existe en catalog_items');

  // C1: resolve unit_cost from ingredient_price_history (latest) before falling back to unit_cost
  const lineas = (await client.query(
    `SELECT ri.quantity,
            COALESCE(h2.new_price, i.unit_cost, 0)::NUMERIC AS unit_cost
       FROM recipe_items ri
       JOIN ingredients i ON i.id = ri.ingredient_id
       LEFT JOIN LATERAL (
         SELECT h.new_price
           FROM ingredient_price_history h
          WHERE h.ingredient_id = i.id
          ORDER BY h.recorded_at DESC NULLS LAST
          LIMIT 1
       ) h2 ON true
      WHERE ri.catalog_item_id = $1`,
    [recipeId]
  )).rows;

  const settings = (await client.query(`SELECT min_price_multiplier FROM business_settings LIMIT 1`)).rows[0];
  const totales = computeFichaTotales(
    lineas.map((l: any) => ({ quantity: Number(l.quantity), unitCost: Number(l.unit_cost) })),
    Number(recipe.merma_pct) || 0,
    recipe.peso_racion != null ? Number(recipe.peso_racion) : null,
    Number(settings?.min_price_multiplier) || 3,
    null
  );

  await client.query(
    `UPDATE catalog_items SET servings = $1 WHERE id = $2`,
    [Math.max(1, Math.round(totales.raciones ?? 1)), recipeId]
  );
  await client.query(`UPDATE catalog_items SET cost = $1 WHERE id = $2`, [totales.costeTotal, recipeId]);

  return totales;
}
