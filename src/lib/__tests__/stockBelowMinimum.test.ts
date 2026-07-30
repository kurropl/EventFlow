/**
 * EventFlow — Tests para el handler stock.below_minimum (WP-08)
 * Verifica que la reposición automática por mínimos funciona correctamente.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { query, querySingle, transaction } from '@/lib/db';
import { emitDomainEvent, type DomainEvent } from '@/domain/events';
import { handleStockBelowMinimum, countPendingRepositionOrders } from '@/domain/handlers/stockBelowMinimum';

describe('WP-08: Reposición Automática por Mínimos', () => {
  let testIngredientId: string;
  let testIngredientName: string;
  let testSupplierOrderId: string;

  beforeAll(async () => {
    // Crear un ingrediente de prueba con stock bajo mínimo
    const result = await querySingle<any>(
      `INSERT INTO ingredients (name, category, unit, quantity, min_stock, supplier, active)
       VALUES ('Test Ingrediente WP08', 'test', 'g', 5.0, 20.0, 'Proveedor Test WP08', true)
       RETURNING id, name`
    );
    testIngredientId = result!.id;
    testIngredientName = result!.name;
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    if (testIngredientId) {
      // Eliminar líneas de órdenes relacionadas
      await query(
        `DELETE FROM supplier_order_items WHERE ingredient_id = $1`,
        [testIngredientId]
      );
      // Eliminar órdenes auto_reposicion de prueba
      await query(
        `DELETE FROM supplier_orders WHERE supplier = $1 AND origin = 'auto_reposicion'`,
        ['Proveedor Test WP08']
      );
      // Eliminar ingrediente de prueba
      await query(`DELETE FROM ingredients WHERE id = $1`, [testIngredientId]);
    }
  });

  beforeEach(async () => {
    // Limpiar órdenes de prueba antes de cada test
    await query(
      `DELETE FROM supplier_order_items WHERE ingredient_id = $1`,
      [testIngredientId]
    );
    await query(
      `DELETE FROM supplier_orders WHERE supplier = $1 AND origin = 'auto_reposicion'`,
      ['Proveedor Test WP08']
    );
  });

  describe('handleStockBelowMinimum', () => {
    it('debería crear una OC borrador cuando stock cae bajo mínimo', async () => {
      // Preparar ingrediente con stock bajo mínimo
      await query(
        `UPDATE ingredients SET quantity = 5, min_stock = 20 WHERE id = $1`,
        [testIngredientId]
      );

      // Simular evento stock.below_minimum
      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'stock.below_minimum',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          current: 5,
          minimum: 20,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleStockBelowMinimum(event);

      // Verificar que se creó una OC borrador
      const order = await querySingle<any>(
        `SELECT * FROM supplier_orders
         WHERE supplier = 'Proveedor Test WP08'
           AND status = 'pending'
           AND origin = 'auto_reposicion'
           AND event_id IS NULL`
      );
      expect(order).toBeDefined();
      expect(order!.supplier).toBe('Proveedor Test WP08');
      expect(order!.status).toBe('pending');
      expect(order!.origin).toBe('auto_reposicion');
      expect(order!.event_id).toBeNull();

      // Verificar que se creó la línea con cantidad correcta
      // Cantidad = (min_stock × 2) - current = (20 × 2) - 5 = 35
      const line = await querySingle<any>(
        `SELECT * FROM supplier_order_items
         WHERE order_id = $1 AND ingredient_id = $2`,
        [order!.id, testIngredientId]
      );
      expect(line).toBeDefined();
      expect(Number(line!.quantity)).toBe(35);
      expect(line!.ingredient_name).toBe(testIngredientName);

      testSupplierOrderId = order!.id;
    });

    it('debería reutilizar OC borrador existente del mismo proveedor', async () => {
      // Crear OC borrador previa
      const preOrder = await querySingle<any>(
        `INSERT INTO supplier_orders (supplier, status, origin, notes)
         VALUES ('Proveedor Test WP08', 'pending', 'auto_reposicion', 'OC previa')
         RETURNING id`
      );

      // Agregar una línea previa (otro ingrediente simulado)
      const fakeIngId = '00000000-0000-0000-0000-000000000001';
      await query(
        `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_cost)
         VALUES ($1, $2, 'Otro ingrediente', 10, 'ud', 5.00)`,
        [preOrder!.id, fakeIngId]
      );

      // Preparar ingrediente real con stock bajo
      await query(
        `UPDATE ingredients SET quantity = 3, min_stock = 15 WHERE id = $1`,
        [testIngredientId]
      );

      // Ejecutar handler
      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'stock.below_minimum',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          current: 3,
          minimum: 15,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleStockBelowMinimum(event);

      // Verificar que se reutilizó la OC (no se creó una nueva)
      const orderCount = await querySingle<any>(
        `SELECT COUNT(*)::int AS count FROM supplier_orders
         WHERE supplier = 'Proveedor Test WP08'
           AND origin = 'auto_reposicion'`
      );
      expect(orderCount!.count).toBe(1);

      // Verificar que la línea se creó en la OC existente
      const line = await querySingle<any>(
        `SELECT * FROM supplier_order_items
         WHERE order_id = $1 AND ingredient_id = $2`,
        [preOrder!.id, testIngredientId]
      );
      expect(line).toBeDefined();
      // Cantidad = (15 × 2) - 3 = 27
      expect(Number(line!.quantity)).toBe(27);

      // Verificar que la línea previa sigue ahí
      const otherLine = await querySingle<any>(
        `SELECT * FROM supplier_order_items
         WHERE order_id = $1 AND ingredient_id = $2`,
        [preOrder!.id, fakeIngId]
      );
      expect(otherLine).toBeDefined();
      expect(otherLine!.ingredient_name).toBe('Otro ingrediente');

      // Limpiar la línea ficticia
      await query(
        `DELETE FROM supplier_order_items WHERE ingredient_id = $1`,
        [fakeIngId]
      );

      testSupplierOrderId = preOrder!.id;
    });

    it('debería sumar cantidad si el ingrediente ya tiene línea en la OC', async () => {
      // Crear OC borrador
      const order = await querySingle<any>(
        `INSERT INTO supplier_orders (supplier, status, origin, notes)
         VALUES ('Proveedor Test WP08', 'pending', 'auto_reposicion', 'OC para test suma')
         RETURNING id`
      );

      // Agregar línea existente para el ingrediente
      await query(
        `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_cost)
         VALUES ($1, $2, $3, 10, 'g', 0.50)`,
        [order!.id, testIngredientId, testIngredientName]
      );

      // Preparar ingrediente con stock bajo
      await query(
        `UPDATE ingredients SET quantity = 8, min_stock = 25 WHERE id = $1`,
        [testIngredientId]
      );

      // Ejecutar handler
      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'stock.below_minimum',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          current: 8,
          minimum: 25,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleStockBelowMinimum(event);

      // Verificar que la línea se actualizó (suma)
      const line = await querySingle<any>(
        `SELECT * FROM supplier_order_items
         WHERE order_id = $1 AND ingredient_id = $2`,
        [order!.id, testIngredientId]
      );
      expect(line).toBeDefined();
      // Cantidad nueva = (25 × 2) - 8 = 42, suma a existente 10 = 52
      expect(Number(line!.quantity)).toBe(52);

      // Verificar que no se creó una segunda línea
      const lineCount = await querySingle<any>(
        `SELECT COUNT(*)::int AS count FROM supplier_order_items
         WHERE order_id = $1 AND ingredient_id = $2`,
        [order!.id, testIngredientId]
      );
      expect(lineCount!.count).toBe(1);

      testSupplierOrderId = order!.id;
    });

    it('debería ignorar ingrediente sin proveedor', async () => {
      // Crear ingrediente sin proveedor
      const noSupplier = await querySingle<any>(
        `INSERT INTO ingredients (name, category, unit, quantity, min_stock, supplier, active)
         VALUES ('Sin Proveedor WP08', 'test', 'ud', 0, 10, NULL, true)
         RETURNING id`
      );

      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'stock.below_minimum',
        aggregate_type: 'ingredient',
        aggregate_id: noSupplier!.id,
        payload: {
          ingredient_id: noSupplier!.id,
          current: 0,
          minimum: 10,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleStockBelowMinimum(event);

      // Verificar que NO se creó ninguna OC
      const orderCount = await querySingle<any>(
        `SELECT COUNT(*)::int AS count FROM supplier_orders
         WHERE origin = 'auto_reposicion'`
      );
      expect(orderCount!.count).toBe(0);

      // Limpiar
      await query(`DELETE FROM ingredients WHERE id = $1`, [noSupplier!.id]);
    });

    it('debería calcular cantidad correcta: redondeo hacia arriba', async () => {
      // Stock = 12, mínimo = 20 → cantidad = (20×2) - 12 = 28
      await query(
        `UPDATE ingredients SET quantity = 12, min_stock = 20 WHERE id = $1`,
        [testIngredientId]
      );

      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'stock.below_minimum',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          current: 12,
          minimum: 20,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleStockBelowMinimum(event);

      const line = await querySingle<any>(
        `SELECT sol.* FROM supplier_order_items sol
         JOIN supplier_orders so ON so.id = sol.order_id
         WHERE sol.ingredient_id = $1 AND so.origin = 'auto_reposicion'`,
        [testIngredientId]
      );
      expect(line).toBeDefined();
      expect(Number(line!.quantity)).toBe(28);
    });

    it('debería calcular cantidad correcta: stock en decimales', async () => {
      // Stock = 7.5, mínimo = 18 → cantidad = (18×2) - 7.5 = 28.5 → ceil = 29
      await query(
        `UPDATE ingredients SET quantity = 7.5, min_stock = 18 WHERE id = $1`,
        [testIngredientId]
      );

      const event: DomainEvent = {
        id: Date.now(),
        event_type: 'stock.below_minimum',
        aggregate_type: 'ingredient',
        aggregate_id: testIngredientId,
        payload: {
          ingredient_id: testIngredientId,
          current: 7.5,
          minimum: 18,
        },
        created_at: new Date(),
        processed_at: null,
        attempts: 0,
        last_error: null,
      };

      await handleStockBelowMinimum(event);

      const line = await querySingle<any>(
        `SELECT sol.* FROM supplier_order_items sol
         JOIN supplier_orders so ON so.id = sol.order_id
         WHERE sol.ingredient_id = $1 AND so.origin = 'auto_reposicion'`,
        [testIngredientId]
      );
      expect(line).toBeDefined();
      expect(Number(line!.quantity)).toBe(29);
    });
  });

  describe('countPendingRepositionOrders', () => {
    it('debería contar órdenes auto_reposicion pendientes', async () => {
      // Crear dos OCs de prueba
      await query(
        `INSERT INTO supplier_orders (supplier, status, origin, notes)
         VALUES ('Proveedor Test WP08', 'pending', 'auto_reposicion', 'Test count 1')`
      );
      await query(
        `INSERT INTO supplier_orders (supplier, status, origin, notes)
         VALUES ('Proveedor Test WP08', 'pending', 'auto_reposicion', 'Test count 2')`
      );
      // Una OC manual (no debe contar)
      await query(
        `INSERT INTO supplier_orders (supplier, status, origin, notes)
         VALUES ('Proveedor Test WP08', 'pending', 'manual', 'OC manual')`
      );
      // Una OC enviada (no debe contar)
      await query(
        `INSERT INTO supplier_orders (supplier, status, origin, notes)
         VALUES ('Proveedor Test WP08', 'ordered', 'auto_reposicion', 'Ya enviada')`
      );

      const count = await countPendingRepositionOrders();
      expect(count).toBeGreaterThanOrEqual(2);
    });
  });
});
