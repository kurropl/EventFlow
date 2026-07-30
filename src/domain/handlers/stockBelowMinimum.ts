/**
 * EventFlow — Handler: stock.below_minimum
 * WP-08 Reposición Automática por Mínimos
 *
 * Cuando el stock de un ingrediente cae por debajo del mínimo, este handler
 * crea o actualiza una línea en la OC borrador semanal (supplier_orders) del
 * proveedor correspondiente. Una OC borrador por proveedor, sin event_id.
 *
 * Cantidad propuesta = (mínimo × 2) − stock_actual, redondeada hacia arriba.
 * No duplica líneas: si el ingrediente ya está en la OC borrador, suma la
 * cantidad propuesta a la existente.
 */

import type { PoolClient } from 'pg';
import type { DomainEvent } from '../events';
import { query, transaction } from '@/lib/db';

// ============================================================
// Tipos
// ============================================================

export interface StockBelowMinimumPayload {
  ingredient_id: string;
  current: number;
  minimum: number;
}

interface IngredientRow {
  id: string;
  name: string;
  quantity: number;
  min_stock: number;
  unit: string;
  supplier: string | null;
  supplier_id: string | null;
}

interface ExistingLineRow {
  id: string;
  quantity: number;
  unit_cost: number;
}

// ============================================================
// Handler principal
// ============================================================

export async function handleStockBelowMinimum(event: DomainEvent): Promise<void> {
  const payload = event.payload as unknown as StockBelowMinimumPayload;
  const { ingredient_id, current, minimum } = payload;

  console.log(
    `[Handler] stock.below_minimum para ingrediente ${ingredient_id}` +
    ` (actual: ${current}, mínimo: ${minimum})`
  );

  // 1. Obtener datos del ingrediente
  const ingredient = await query<IngredientRow>(
    `SELECT id, name, quantity, min_stock, unit, supplier, supplier_id
     FROM ingredients
     WHERE id = $1`,
    [ingredient_id]
  );

  const ing = ingredient.rows[0];
  if (!ing) {
    console.warn(`[Handler] stock.below_minimum: ingrediente ${ingredient_id} no encontrado, ignorando.`);
    return;
  }

  // Sin proveedor asignado → no podemos generar compra automática
  if (!ing.supplier && !ing.supplier_id) {
    console.warn(
      `[Handler] stock.below_minimum: ingrediente "${ing.name}" sin proveedor, no se genera compra.`
    );
    return;
  }

  // Nombre del proveedor para la OC (supplier_orders.supplier es TEXT, no FK)
  const supplierName = ing.supplier || 'desconocido';

  // 2. Calcular cantidad propuesta: (mínimo × 2) − stock actual
  //    Redondear hacia arriba a la unidad entera
  const rawQty = (minimum * 2) - current;
  const qtyToOrder = Math.max(0, Math.ceil(rawQty));

  if (qtyToOrder <= 0) {
    console.log(
      `[Handler] stock.below_minimum: "${ing.name}" no requiere reposición (qty calculada: ${qtyToOrder}).`
    );
    return;
  }

  // 3. Ejecutar en transacción atómica
  await transaction(async (client: PoolClient) => {
    // Buscar OC borrador existente para este proveedor (sin event_id)
    const draftOrder = await client.query<{ id: string }>(
      `SELECT id FROM supplier_orders
       WHERE supplier = $1
         AND status = 'pending'
         AND event_id IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [supplierName]
    );

    let orderId: string;

    if (draftOrder.rows.length > 0) {
      // Reutilizar OC borrador existente
      orderId = draftOrder.rows[0].id;
      console.log(`[Handler] Reutilizando OC borrador ${orderId} para proveedor "${supplierName}"`);
    } else {
      // Crear nueva OC borrador
      const newOrder = await client.query<{ id: string }>(
        `INSERT INTO supplier_orders (supplier, status, origin, notes)
         VALUES ($1, 'pending', 'auto_reposicion', $2)
         RETURNING id`,
        [
          supplierName,
          `Reposición automática — generada el ${new Date().toLocaleDateString('es-ES')}`,
        ]
      );
      orderId = newOrder.rows[0].id;
      console.log(`[Handler] Creada OC borrador ${orderId} para proveedor "${supplierName}"`);
    }

    // Verificar si el ingrediente ya tiene línea en la OC borrador
    const existingLine = await client.query<ExistingLineRow>(
      `SELECT id, quantity, unit_cost
       FROM supplier_order_items
       WHERE order_id = $1 AND ingredient_id = $2`,
      [orderId, ingredient_id]
    );

    if (existingLine.rows.length > 0) {
      // Actualizar línea existente: sumar la cantidad adicional
      const line = existingLine.rows[0];
      const newQty = Number(line.quantity) + qtyToOrder;
      await client.query(
        `UPDATE supplier_order_items
         SET quantity = $1
         WHERE id = $2`,
        [newQty, line.id]
      );
      console.log(
        `[Handler] Línea actualizada: "${ing.name}" → ${newQty} ${ing.unit}` +
        ` (era ${line.quantity}, +${qtyToOrder})`
      );
    } else {
      // Crear nueva línea
      await client.query(
        `INSERT INTO supplier_order_items
           (order_id, ingredient_id, ingredient_name, quantity, unit, unit_cost)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          orderId,
          ingredient_id,
          ing.name,
          qtyToOrder,
          ing.unit || 'ud',
          Number(ing.quantity) || 0, // unit_cost precargado (se actualizará al enviar)
        ]
      );
      console.log(
        `[Handler] Nueva línea: "${ing.name}" → ${qtyToOrder} ${ing.unit}`
      );
    }

    // Recalcular total de la OC
    const totalResult = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(quantity * unit_cost), 0)::numeric AS total
       FROM supplier_order_items
       WHERE order_id = $1`,
      [orderId]
    );
    await client.query(
      `UPDATE supplier_orders SET total_cost = $1, updated_at = now() WHERE id = $2`,
      [Number(totalResult.rows[0].total), orderId]
    );
  });

  console.log(`[Handler] stock.below_minimum procesado para "${ing.name}" → OC borrador actualizada.`);
}

// ============================================================
// Helpers para UI (badge de alertas)
// ============================================================

/**
 * Cuenta órdenes de reposición automática pendientes.
 * Usado por el badge en el panel Cocina.
 */
export async function countPendingRepositionOrders(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM supplier_orders
     WHERE status = 'pending'
       AND origin = 'auto_reposicion'
       AND event_id IS NULL`
  );
  return Number(result.rows[0]?.count || 0);
}
