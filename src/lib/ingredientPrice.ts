/**
 * EventFlow — Precio más reciente de ingrediente (ingredient_price_history)
 *
 * C1: los costes de cocina y compras se resuelven desde el último registro de
 * ingredient_price_history de cada ingrediente (nuevo_price más reciente), con
 * fallback a ingredients.unit_cost cuando no hay histórico.
 */
import { getPool } from './db';

/**
 * Resuelve el precio actual de un ingrediente:
 * 1. Si existe fila en ingredient_price_history → latest.new_price
 * 2. Si no existe → ingredients.unit_cost (comportamiento idéntico a antes)
 *
 * @param ingredientId UUID del ingrediente
 * @returns precio unitario actual (numeric → number)
 */
export async function getLatestIngredientPrice(ingredientId: string): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT h.new_price
       FROM ingredient_price_history h
      WHERE h.ingredient_id = $1
      ORDER BY h.recorded_at DESC NULLS LAST LIMIT 1`,
    [ingredientId]
  );
  const row = result.rows[0];
  if (row && row.new_price != null) {
    return Number(row.new_price);
  }
  // Fallback: coste actual del ingrediente
  const fallback = await pool.query(
    `SELECT unit_cost FROM ingredients WHERE id = $1`,
    [ingredientId]
  );
  const fb = fallback.rows[0];
  return fb ? Number(fb.unit_cost) || 0 : 0;
}