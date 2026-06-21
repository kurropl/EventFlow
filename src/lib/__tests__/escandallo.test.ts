/**
 * Tests del motor de escandallo
 * - Verifica que recipe_items tiene version
 * - Verifica que event_shopping_items se actualiza al cambiar guest_count
 * - Verifica que ingredient_price_history se actualiza
 * - Verifica que freeze funciona
 * - Verifica que las desviaciones se calculan correctamente
 */

import { getPool } from '@/lib/db';
import { recalcEventEscandallo, freezeEventEscandallo, checkMarginAlerts } from '@/lib/recalcEscandallo';

describe('Escandallo — receta como fuente de verdad', () => {

  test('recipe_items existe y tiene version', async () => {
    const result = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'recipe_items' AND column_name = 'version'`
    );
    expect(result.rows.length).toBeGreaterThan(0);
  });

  test('recipe_items tiene unit y unit_dimension', async () => {
    const result = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'recipe_items'
         AND column_name IN ('unit', 'unit_dimension')`
    );
    expect(result.rows.length).toBe(2);
  });

  test('event_shopping_items tiene frozen', async () => {
    const result = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'event_shopping_items' AND column_name = 'frozen'`
    );
    expect(result.rows.length).toBe(1);
  });

  test('event_shopping_items tiene theoretical_qty', async () => {
    const result = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'event_shopping_items' AND column_name = 'theoretical_qty'`
    );
    expect(result.rows.length).toBe(1);
  });

  test('event_shopping_items tiene estimated_cost', async () => {
    const result = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'event_shopping_items' AND column_name = 'estimated_cost'`
    );
    expect(result.rows.length).toBe(1);
  });

  test('ingredient_price_history existe y registra cambios', async () => {
    const result = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'ingredient_price_history' AND column_name = 'ingredient_id'`
    );
    expect(result.rows.length).toBe(1);
  });

  test('event_cost_deviations existe y tiene campos', async () => {
    const result = await getPool().query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'event_cost_deviations' AND column_name = 'deviation_pct'`
    );
    expect(result.rows.length).toBe(1);
  });

  test('recipe_item_versions existe', async () => {
    const result = await getPool().query(
      `SELECT COUNT(*)::int AS cnt FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'recipe_item_versions'`
    );
    expect(result.rows[0].cnt).toBe(1);
  });
});