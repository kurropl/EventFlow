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

export async function ensureCatalogItem(client: PoolClient, recipeId: string): Promise<string> {
  const r = (await client.query(
    `SELECT catalog_item_id, name, category FROM recipes WHERE id = $1`,
    [recipeId]
  )).rows[0];
  if (!r) throw new Error('Receta no encontrada');
  if (r.catalog_item_id) return r.catalog_item_id;

  const category = (CATALOG_CATEGORIES as readonly string[]).includes(r.category) ? r.category : 'complemento';
  const cat = (await client.query(
    `INSERT INTO catalog_items (name, category, pvp, cost, ingredients, active)
     VALUES ($1, $2, 0, 0, '[]'::jsonb, true) RETURNING id`,
    [r.name, category]
  )).rows[0];
  await client.query(`UPDATE recipes SET catalog_item_id = $1 WHERE id = $2`, [cat.id, recipeId]);
  return cat.id;
}

export async function recomputeFicha(client: PoolClient, recipeId: string): Promise<FichaTotales> {
  const recipe = (await client.query(
    `SELECT merma_pct, peso_racion, catalog_item_id FROM recipes WHERE id = $1`,
    [recipeId]
  )).rows[0];
  if (!recipe?.catalog_item_id) throw new Error('La receta no tiene catalog_item_id (ensureCatalogItem primero)');

  const lineas = (await client.query(
    `SELECT ri.quantity, COALESCE(i.unit_cost, 0) AS unit_cost
     FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.catalog_item_id = $1`,
    [recipe.catalog_item_id]
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
    `UPDATE recipes SET servings = $1 WHERE id = $2`,
    [Math.max(1, Math.round(totales.raciones ?? 1)), recipeId]
  );
  await client.query(`UPDATE catalog_items SET cost = $1 WHERE id = $2`, [totales.costeTotal, recipe.catalog_item_id]);

  return totales;
}
