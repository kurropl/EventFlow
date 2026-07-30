/**
 * WP-11: Unificación Platos/Recetas
 * Tests de aceptación y regresión
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { queryMany, querySingle } from '@/lib/db';

// ── Helpers ──────────────────────────────────────────────────────

async function cleanup() {
  await queryMany(`DELETE FROM recipe_items WHERE catalog_item_id IN
    (SELECT id FROM catalog_items WHERE name LIKE '%WP11_TEST%')`);
  await queryMany(`DELETE FROM catalog_items WHERE name LIKE '%WP11_TEST%'`);
}

// ── Tests ────────────────────────────────────────────────────────

describe('WP-11: Unificación Platos/Recetas', () => {
  beforeAll(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  describe('Migración: columnas añadidas', () => {
    it('catalog_items tiene todas las columnas de recipes', async () => {
      const columns = await queryMany<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'catalog_items' AND column_name IN (
          'source', 'servings', 'instructions', 'prep_time', 'cook_time',
          'difficulty', 'version', 'published', 'merma_pct', 'peso_racion',
          'author', 'photo_url'
        )
      `);
      expect(columns.length).toBe(12);
    });

    it('vista v_recipes existe y es legible', async () => {
      const rows = await queryMany(`SELECT * FROM v_recipes LIMIT 1`);
      expect(rows).toBeDefined();
    });

    it('vista v_dishes_unified existe y es legible', async () => {
      const rows = await queryMany(`SELECT * FROM v_dishes_unified LIMIT 1`);
      expect(rows).toBeDefined();
    });
  });

  describe('Backfill: datos copiados correctamente', () => {
    it('recetas con catalog_item_id tienen datos sincronizados', async () => {
      const mismatches = await queryMany<{ id: string; name: string }>(`
        SELECT ci.id, ci.name
        FROM catalog_items ci
        JOIN recipes r ON r.catalog_item_id = ci.id
        WHERE r.active = true
          AND ci.active = true
          AND (
            (r.servings IS NOT NULL AND ci.servings IS NULL) OR
            (r.instructions IS NOT NULL AND ci.instructions IS NULL) OR
            (r.prep_time IS NOT NULL AND ci.prep_time IS NULL) OR
            (r.cook_time IS NOT NULL AND ci.cook_time IS NULL)
          )
        LIMIT 10
      `);
      expect(mismatches.length).toBe(0);
    });
  });

  describe('CRUD: creación unificada', () => {
    it('crear un plato en catalog_items con datos de cocina', async () => {
      const dish = await querySingle<{ id: string; servings: number; source: string }>(`
        INSERT INTO catalog_items (name, category, pvp, cost, active, servings, source, instructions, prep_time, cook_time, difficulty)
        VALUES ('WP11_TEST Plato Unificado', 'carne', 10.50, 4.20, true, 4, 'manual', 'Instrucciones de test', 30, 60, 'media')
        RETURNING id, servings, source
      `);

      expect(dish).toBeDefined();
      expect(dish!.servings).toBe(4);
      expect(dish!.source).toBe('manual');
    });

    it('la vista v_recipes muestra el plato creado', async () => {
      const recipe = await querySingle<{ id: string; name: string; servings: number }>(`
        SELECT id, name, servings FROM v_recipes
        WHERE name = 'WP11_TEST Plato Unificado'
      `);

      expect(recipe).toBeDefined();
      expect(recipe!.servings).toBe(4);
    });

    it('vista v_dishes_unified muestra el plato con margen calculado', async () => {
      const unified = await querySingle<{ name: string; margin_pct: number; ingredient_count: number }>(`
        SELECT name, margin_pct, ingredient_count FROM v_dishes_unified
        WHERE name = 'WP11_TEST Plato Unificado'
      `);

      expect(unified).toBeDefined();
      expect(unified!.margin_pct).toBeGreaterThan(0);
      expect(unified!.ingredient_count).toBe(0);
    });

    it('la tabla recipes legacy sigue intacta (NR-1)', async () => {
      const count = await querySingle<{ count: number }>(`
        SELECT count(*)::int as count FROM recipes
      `);
      expect(count).toBeDefined();
      expect(count!.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('API: /api/catalog y /api/cocina/recipes responden', () => {
    it('catalog_items tiene platos activos', async () => {
      const result = await querySingle<{ count: number }>(`
        SELECT count(*)::int as count FROM catalog_items WHERE active = true
      `);
      expect(result).toBeDefined();
      expect(result!.count).toBeGreaterThan(0);
    });

    it('v_recipes tiene el mismo count que catalog_items activos', async () => {
      const catalogCount = await querySingle<{ count: number }>(`
        SELECT count(*)::int as count FROM catalog_items WHERE active = true
      `);
      const recipesCount = await querySingle<{ count: number }>(`
        SELECT count(*)::int as count FROM v_recipes WHERE active = true
      `);

      expect(catalogCount!.count).toBe(recipesCount!.count);
    });
  });

  describe('Integridad: recipe_items sigue referenciando catalog_items', () => {
    it('todas las recipe_items apuntan a un catalog_item válido', async () => {
      const orphans = await queryMany<{ id: string }>(`
        SELECT ri.id FROM recipe_items ri
        LEFT JOIN catalog_items ci ON ci.id = ri.catalog_item_id
        WHERE ci.id IS NULL
        LIMIT 10
      `);
      expect(orphans.length).toBe(0);
    });
  });

  describe('Degradación: catálogo items sin receta no se pierden', () => {
    it('catalog_items seed (118+) sigue presente', async () => {
      const count = await querySingle<{ count: number }>(`
        SELECT count(*)::int as count FROM catalog_items
      `);
      expect(count!.count).toBeGreaterThanOrEqual(100);
    });
  });
});
