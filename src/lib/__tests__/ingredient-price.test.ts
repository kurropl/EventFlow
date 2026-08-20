/**
 * EventFlow — Tests: getLatestIngredientPrice (C1)
 *
 * Verifica que el precio se resuelve desde ingredient_price_history,
 * y que cae de nuevo a ingredients.unit_cost cuando no hay histórico.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { query, querySingle } from '@/lib/db';
import { getLatestIngredientPrice } from '@/lib/ingredientPrice';

describe('C1: getLatestIngredientPrice', () => {
  let testIngId: string;

  beforeAll(async () => {
    const result = await querySingle<any>(
      `INSERT INTO ingredients (name, category, unit, unit_cost, quantity, min_stock, active)
       VALUES ('C1 Test Price', 'test', 'g', 0.05, 100, 10, true)
       RETURNING id`
    );
    testIngId = result!.id!;
  });

  afterAll(async () => {
    if (testIngId) {
      await query(`DELETE FROM ingredient_price_history WHERE ingredient_id = $1`, [testIngId]);
      await query(`DELETE FROM ingredients WHERE id = $1`, [testIngId]);
    }
  });

  beforeEach(async () => {
    // Restaurar precio base
    await query(
      `UPDATE ingredients SET unit_cost = 0.05 WHERE id = $1`,
      [testIngId]
    );
    // Limpiar histórico de prueba
    await query(
      `DELETE FROM ingredient_price_history WHERE ingredient_id = $1`,
      [testIngId]
    );
  });

  it('devuelve unit_cost cuando no hay histórico (fallback)', async () => {
    const price = await getLatestIngredientPrice(testIngId);
    expect(price).toBe(0.05);
  });

  it('devuelve el precio más reciente de ingredient_price_history', async () => {
    await query(
      `INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by, recorded_at)
       VALUES ($1, 0.05, 0.07, 'admin', '2026-01-01 UTC')`,
      [testIngId]
    );

    const price = await getLatestIngredientPrice(testIngId);
    expect(price).toBe(0.07);
  });

  it('elige el registro por recorded_at DESC (más reciente)', async () => {
    const price1 = await querySingle<any>(
      `INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by, recorded_at)
       VALUES ($1, 0.05, 0.06, 'admin', '2026-01-01 UTC'),
              ($1, 0.06, 0.10, 'admin', '2026-06-01 UTC'),
              ($1, 0.10, 0.08, 'admin', '2026-12-01 UTC')
       RETURNING new_price`,
      [testIngId]
    );

    // El más reciente (2026-12-01) tiene new_price = 0.08
    const price = await getLatestIngredientPrice(testIngId);
    expect(price).toBe(0.08);
  });

  it('ignora un ingrediente con ID inexistente (fallback a 0)', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000999';
    // El backend hace LEFT JOIN LATERAL que devuelve 0 cuando no hay history ni ingredient
    const price = await getLatestIngredientPrice(fakeId);
    expect(price).toBe(0);
  });
});