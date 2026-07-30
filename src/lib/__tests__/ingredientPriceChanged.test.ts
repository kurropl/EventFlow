/**
 * EventFlow — Tests para el handler ingredient.price_changed (WP-13)
 * Verifica el recálculo de costes y alertas de margen.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { query, querySingle, transaction } from '@/lib/db';
import { emitDomainEvent, type DomainEvent } from '@/domain/events';
import {
  handleIngredientPriceChanged,
  countPendingMarginAlerts,
  getPendingMarginAlerts,
} from '@/domain/handlers/ingredientPriceChanged';

describe('WP-13: Coste Vivo y Alertas de Margen', () => {
  let testIngredientId: string;
  let testIngredientName: string;
  let testCatalogItemId: string;
  let testMenuId: number;
  let testSectionId: number;

  beforeAll(async () => {
    // 1. Crear ingrediente de prueba
    const ingResult = await querySingle<any>(
      `INSERT INTO ingredients (name, category, unit, unit_cost, quantity, min_stock, supplier, active)
       VALUES ('Tomate Test WP13', 'verdura', 'g', 0.0050, 100, 10, 'Proveedor Test', true)
       RETURNING id, name`
    );
    testIngredientId = ingResult!.id;
    testIngredientName = ingResult!.name;

    // 2. Crear plato de prueba en el catálogo
    const catResult = await querySingle<any>(
      `INSERT INTO catalog_items (name, category, pvp, cost, active)
       VALUES ('Ensalada Test WP13', 'entrante', 8.00, 0.50, true)
       RETURNING id`
    );
    testCatalogItemId = catResult!.id;

    // 3. Vincular ingrediente al plato (recipe_items)
    await query(
      `INSERT INTO recipe_items (catalog_item_id, ingredient_id, quantity, unit, unit_dimension)
       VALUES ($1, $2, 100, 'g', 'mass')`,
      [testCatalogItemId, testIngredientId]
    );

    // 4. Crear menú publicado con precio y coste iniciales
    const menuResult = await querySingle<any>(
      `INSERT INTO menus (name, version, status, price_per_pax, cost_per_pax, description)
       VALUES ('Menú Test WP13', 1, 'publicado', 25.00, 10.00, 'Menú de prueba para WP-13')
       RETURNING id`
    );
    testMenuId = menuResult!.id;

    // 5. Crear sección del menú
    const sectionResult = await querySingle<any>(
      `INSERT INTO menu_sections (menu_id, name, position)
       VALUES ($1, 'Entrante', 1)
       RETURNING id`,
      [testMenuId]
    );
    testSectionId = sectionResult!.id;

    // 6. Vincular plato a la sección
    await query(
      `INSERT INTO menu_section_dishes (section_id, dish_id)
       VALUES ($1, $2)`,
      [testSectionId, testCatalogItemId]
    );

    // 7. Asegurar que el umbral de margen es 20% (default)
    await query(
      `UPDATE business_settings SET margin_alert_threshold = 20 WHERE id = (SELECT id FROM business_settings LIMIT 1)`
    );
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    if (testMenuId) {
      await query(`DELETE FROM menu_cost_alerts WHERE menu_id = $1`, [testMenuId]);
      await query(`DELETE FROM menu_section_dishes WHERE section_id = $1`, [testSectionId]);
      await query(`DELETE FROM menu_sections WHERE id = $1`, [testSectionId]);
      await query(`DELETE FROM menus WHERE id = $1`, [testMenuId]);
    }
    if (testCatalogItemId) {
      await query(`DELETE FROM recipe_items WHERE catalog_item_id = $1`, [testCatalogItemId]);
      await query(`DELETE FROM catalog_items WHERE id = $1`, [testCatalogItemId]);
    }
    if (testIngredientId) {
      await query(`DELETE FROM ingredients WHERE id = $1`, [testIngredientId]);
    }
  });

  beforeEach(async () => {
    // Restaurar valores iniciales antes de cada test
    await query(
      `UPDATE ingredients SET unit_cost = 0.0050 WHERE id = $1`,
      [testIngredientId]
    );
    await query(
      `UPDATE catalog_items SET cost = 0.50 WHERE id = $1`,
      [testCatalogItemId]
    );
    await query(
      `UPDATE menus SET cost_per_pax = 10.00, price_per_pax = 25.00 WHERE id = $1`,
      [testMenuId]
    );
    // Limpiar alertas de prueba
    await query(`DELETE FROM menu_cost_alerts WHERE menu_id = $1`, [testMenuId]);
  });

  describe('handleIngredientPriceChanged', () => {
    it('debería recalcular coste del plato al cambiar precio del ingrediente', async () => {
      // Precio actual: 0.0050 €/g, cantidad: 100g → coste plato = 0.50
      // Nuevo precio: 0.0100 €/g, cantidad: 100g → coste plato = 1.00
      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          old_price: 0.0050,
          new_price: 0.0100,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleIngredientPriceChanged(event);

      // Verificar que el coste del plato se actualizó
      const dish = await querySingle<any>(
        `SELECT cost FROM catalog_items WHERE id = $1`,
        [testCatalogItemId]
      );
      expect(Number(dish!.cost)).toBe(1.00);
    });

    it('debería actualizar coste_per_pax del menú publicado', async () => {
      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          old_price: 0.0050,
          new_price: 0.0100,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleIngredientPriceChanged(event);

      // Verificar que el coste del menú se actualizó
      const menu = await querySingle<any>(
        `SELECT cost_per_pax FROM menus WHERE id = $1`,
        [testMenuId]
      );
      // coste nuevo del plato = 100g × 0.0100 = 1.00
      expect(Number(menu!.cost_per_pax)).toBe(1.00);
    });

    it('debería crear alerta de margen cuando margen < umbral', async () => {
      // Menú: PVP = 25.00, coste nuevo = 1.00 → margen = (25-1)/25 = 96%
      // Esto NO debería alertar (96% > 20%)
      // Vamos a subir el precio mucho para forzar margen bajo
      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          old_price: 0.0050,
          new_price: 0.2500, // Precio muy alto
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      // Mock del queueEmail para evitar envío real
      // En el handler real, sendMarginAlertEmail se llama sin await
      await handleIngredientPriceChanged(event);

      // coste nuevo del plato = 100g × 0.2500 = 25.00
      // coste_per_pax del menú = 25.00
      // margen = (25 - 25) / 25 = 0% < 20% → debería crear alerta
      const menu = await querySingle<any>(
        `SELECT cost_per_pax FROM menus WHERE id = $1`,
        [testMenuId]
      );
      expect(Number(menu!.cost_per_pax)).toBe(25.00);

      // Verificar que se creó una alerta
      const alertCount = await querySingle<any>(
        `SELECT COUNT(*)::int AS count FROM menu_cost_alerts WHERE menu_id = $1`,
        [testMenuId]
      );
      expect(alertCount!.count).toBeGreaterThanOrEqual(1);
    });

    it('NO debería crear alerta cuando margen >= umbral', async () => {
      // Menú: PVP = 25.00, coste = 10.00 → margen = (25-10)/25 = 60%
      // Cambio menor: coste nuevo = 4.00 → margen = (25-4)/25 = 84%
      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          old_price: 0.0050,
          new_price: 0.0400, // coste plato = 4.00
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleIngredientPriceChanged(event);

      // Verificar que NO se creó alerta
      const alertCount = await querySingle<any>(
        `SELECT COUNT(*)::int AS count FROM menu_cost_alerts WHERE menu_id = $1`,
        [testMenuId]
      );
      expect(alertCount!.count).toBe(0);
    });

    it('debería ignorar ingrediente que no está en ningún plato', async () => {
      // Crear ingrediente sin platos
      const orphanIng = await querySingle<any>(
        `INSERT INTO ingredients (name, category, unit, unit_cost, quantity, active)
         VALUES ('Ingrediente Huérfano WP13', 'test', 'g', 0.01, 100, true)
         RETURNING id`
      );

      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: orphanIng!.id,
        payload: {
          ingredient_id: orphanIng!.id,
          old_price: 0.01,
          new_price: 0.02,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      // No debería fallar
      await handleIngredientPriceChanged(event);

      // Limpiar
      await query(`DELETE FROM ingredients WHERE id = $1`, [orphanIng!.id]);
    });

    it('debería ignorar ingrediente inexistente', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000999';

      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: fakeId,
        payload: {
          ingredient_id: fakeId,
          old_price: 0.01,
          new_price: 0.02,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      // No debería fallar
      await handleIngredientPriceChanged(event);
    });

    it('debería usar umbral configurable de business_settings', async () => {
      // Cambiar umbral a 50%
      await query(
        `UPDATE business_settings SET margin_alert_threshold = 50 WHERE id = (SELECT id FROM business_settings LIMIT 1)`
      );

      // Menú: PVP = 25.00, coste nuevo = 10.00 → margen = 60%
      // Con umbral 50%, NO debería alertar
      const event1: DomainEvent = {
        id: Date.now(),
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          old_price: 0.0050,
          new_price: 0.1000, // coste plato = 10.00
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleIngredientPriceChanged(event1);

      const alertCount1 = await querySingle<any>(
        `SELECT COUNT(*)::int AS count FROM menu_cost_alerts WHERE menu_id = $1`,
        [testMenuId]
      );
      expect(alertCount1!.count).toBe(0);

      // Ahora subir más: coste = 15.00 → margen = (25-15)/25 = 40% < 50%
      const event2: DomainEvent = {
        id: Date.now() + 1,
        event_type: 'ingredient.price_changed',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          old_price: 0.1000,
          new_price: 0.1500, // coste plato = 15.00
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleIngredientPriceChanged(event2);

      const alertCount2 = await querySingle<any>(
        `SELECT COUNT(*)::int AS count FROM menu_cost_alerts WHERE menu_id = $1`,
        [testMenuId]
      );
      expect(alertCount2!.count).toBeGreaterThanOrEqual(1);

      // Restaurar umbral
      await query(
        `UPDATE business_settings SET margin_alert_threshold = 20 WHERE id = (SELECT id FROM business_settings LIMIT 1)`
      );
    });
  });

  describe('countPendingMarginAlerts', () => {
    it('debería contar alertas pendientes', async () => {
      // Crear alerta de prueba
      await query(
        `INSERT INTO menu_cost_alerts
           (menu_id, alert_type, old_margin, new_margin, old_cost, new_cost, ingredient_id, threshold)
         VALUES ($1, 'margen_bajo', 60, 10, 10, 20, $2, 20)`,
        [testMenuId, testIngredientId]
      );

      const count = await countPendingMarginAlerts();
      expect(count).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getPendingMarginAlerts', () => {
    it('debería retornar alertas con info del menú e ingrediente', async () => {
      // Crear alerta de prueba
      await query(
        `INSERT INTO menu_cost_alerts
           (menu_id, alert_type, old_margin, new_margin, old_cost, new_cost, ingredient_id, threshold)
         VALUES ($1, 'margen_bajo', 60, 10, 10, 20, $2, 20)`,
        [testMenuId, testIngredientId]
      );

      const alerts = await getPendingMarginAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(1);

      const lastAlert = alerts[0];
      expect(lastAlert).toHaveProperty('menu_name');
      expect(lastAlert).toHaveProperty('menu_version');
      expect(lastAlert).toHaveProperty('ingredient_name');
      expect(lastAlert.menu_name).toBe('Menú Test WP13');
    });
  });
});
