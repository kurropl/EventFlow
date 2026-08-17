/**
 * EventFlow — Tests de regresión: esquema real de cocinaSheets
 *
 * Verifica el diagnóstico de los bugs que rompían las hojas de
 * producción/logística/servicio (esi.category no existe) y la
 * corrección (category se deriva de catalog_items vía recipe_items).
 */

import { describe, it, expect } from 'vitest';
import { getPool } from '@/lib/db';

describe('cocinaSheets — esquema real de event_shopping_items', () => {
  it('event_shopping_items NO tiene columna category (el bug era consultarla)', async () => {
    const res = await getPool().query(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE table_name='event_shopping_items' AND column_name='category'`
    );
    expect(res.rows[0].n).toBe(0);
  });

  it('recipe_items (vista) expone catalog_item_id para derivar la categoría', async () => {
    const res = await getPool().query(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE table_name='recipe_items' AND column_name='catalog_item_id'`
    );
    expect(res.rows[0].n).toBe(1);
  });

  it('catalog_items tiene la columna category (fuente de derivación)', async () => {
    const res = await getPool().query(
      `SELECT count(*)::int AS n FROM information_schema.columns
       WHERE table_name='catalog_items' AND column_name='category'`
    );
    expect(res.rows[0].n).toBe(1);
  });
});
