/**
 * EventFlow — WP-07: Servicio de Recepción Unificada APPCC ↔ Stock ↔ OC
 *
 * Un solo acto, tres efectos:
 *   1. Registro APPCC (receiving_log) — flujo existente intacto
 *   2. Lote de stock (stock_lots) + movimiento 'entrada' (stock_movements)
 *   3. Actualización línea/OC (supplier_order_items.received_quantity + status)
 *
 * Opcionalmente, si el precio difiere del histórico:
 *   4. Actualiza ingredient_price_history + ingredients.unit_cost
 *   5. Emite ingredient.price_changed
 *
 * Sin línea OC seleccionada: comportamiento actual NR-2 (solo receiving_log + inventario).
 */
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';
import { emitDomainEvent } from '@/domain/events';
import { recordStockMovement } from '@/lib/domain/stockMovements';

// ── Tipos ────────────────────────────────────────────────────────

export interface UnifiedReceptionParams {
  /** ID del ingrediente */
  ingredientId: string;
  /** Nº de lote */
  lotNumber: string;
  /** Cantidad recibida */
  batchQuantity: number;
  /** Unidad de la cantidad recibida */
  unit: string;
  /** Fecha de recepción (ISO date) */
  receivedDate: string;
  /** Responsable de la recepción */
  receivedBy?: string | null;
  /** Fecha de caducidad */
  expiryDate?: string | null;
  /** Temperatura */
  temperature?: number | null;
  /** Nombre del proveedor */
  supplier?: string | null;
  /** Código QR */
  qrCode?: string | null;
  /** ¿Condición OK? */
  conditionOk?: boolean;
  /** Notas */
  notes?: string | null;
  /** Fuente: manual | scan | api */
  source?: 'manual' | 'scan' | 'api';

  // ── Campos WP-07: línea OC ──
  /** ID de la línea de OC (supplier_order_items.id). Si se provee, se ejecuta el flujo unificado. */
  supplierOrderItemId?: string | null;
}

export interface UnifiedReceptionResult {
  receiving: any;
  stockLot: { id: number; lotCode: string; qtyInitial: number; qtyRemaining: number } | null;
  stockMovement: { id: number; ingredientId: string; previousQty: number; newQty: number } | null;
  orderUpdate: {
    lineId: string;
    orderId: string;
    qtyReceived: number;
    orderStatus: string;
  } | null;
  priceChanged: boolean;
  previousPrice: number | null;
  newPrice: number | null;
}

// ── Función principal ────────────────────────────────────────────

/**
 * Procesa una recepción unificada: APPCC + stock + OC en una sola transacción.
 * Si no se provee supplierOrderItemId, funciona como la ruta actual (NR-2).
 */
export async function processUnifiedReception(
  params: UnifiedReceptionParams
): Promise<UnifiedReceptionResult> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result: UnifiedReceptionResult = {
      receiving: null,
      stockLot: null,
      stockMovement: null,
      orderUpdate: null,
      priceChanged: false,
      previousPrice: null,
      newPrice: null,
    };

    // ══════════════════════════════════════════════════════════════
    // PASO 1: Verificar ingrediente
    // ══════════════════════════════════════════════════════════════
    const ingResult = await client.query(
      `SELECT id, name, unit, quantity, unit_cost, base_unit
       FROM ingredients WHERE id = $1 FOR UPDATE`,
      [params.ingredientId]
    );
    if (ingResult.rows.length === 0) {
      throw new Error(`Ingrediente no encontrado: ${params.ingredientId}`);
    }
    const ingredient = ingResult.rows[0];
    const previousStock = Number(ingredient.quantity) || 0;
    const ingUnit = ingredient.unit || 'g';
    const previousPrice = Number(ingredient.unit_cost) || 0;

    // ══════════════════════════════════════════════════════════════
    // PASO 2: Validar línea OC si se provee
    // ══════════════════════════════════════════════════════════════
    let orderLine: any = null;
    let supplierOrder: any = null;

    if (params.supplierOrderItemId) {
      const lineResult = await client.query(
        `SELECT soi.*, so.supplier AS order_supplier, so.status AS order_status
         FROM supplier_order_items soi
         JOIN supplier_orders so ON so.id = soi.order_id
         WHERE soi.id = $1 FOR UPDATE OF soi`,
        [params.supplierOrderItemId]
      );

      if (lineResult.rows.length === 0) {
        throw new Error(`Línea de OC no encontrada: ${params.supplierOrderItemId}`);
      }

      orderLine = lineResult.rows[0];
      supplierOrder = {
        id: orderLine.order_id,
        supplier: orderLine.order_supplier,
        status: orderLine.order_status,
      };

      // Verificar que la línea no esté cancelada
      if (supplierOrder.status === 'cancelled') {
        throw new Error('No se puede recibir una línea de un pedido cancelado');
      }

      // Verificar que hay cantidad pendiente
      const qtyOrdered = Number(orderLine.quantity) || 0;
      const qtyAlreadyReceived = Number(orderLine.received_quantity) || 0;
      if (qtyAlreadyReceived >= qtyOrdered) {
        throw new Error('Esta línea ya fue recibida completamente');
      }
    }

    // ══════════════════════════════════════════════════════════════
    // PASO 3: Insertar receiving_log (flujo APPCC existente)
    // ══════════════════════════════════════════════════════════════
    const supplierOrderId = supplierOrder?.id || null;
    const supplierOrderItemId = params.supplierOrderItemId || null;

    const receivingResult = await client.query(
      `INSERT INTO receiving_log
         (supplier_order_id, supplier_order_item_id, ingredient_id, lot_number,
          batch_quantity, unit, received_date, received_by, expiry_date,
          temperature, supplier, condition_ok, qr_code, notes, source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        supplierOrderId,
        supplierOrderItemId,
        params.ingredientId,
        params.lotNumber,
        params.batchQuantity,
        params.unit,
        params.receivedDate,
        params.receivedBy || null,
        params.expiryDate || null,
        params.temperature ?? null,
        params.supplier || supplierOrder?.supplier || null,
        params.conditionOk !== undefined ? params.conditionOk : true,
        params.qrCode || null,
        params.notes || null,
        params.source || 'manual',
      ]
    );
    result.receiving = receivingResult.rows[0];

    // ══════════════════════════════════════════════════════════════
    // PASO 4: Crear stock_lots
    // ══════════════════════════════════════════════════════════════
    // Convertir cantidad a unidad base del ingrediente
    const baseUnit = ingredient.base_unit || ingUnit;
    let qtyBase = params.batchQuantity;
    // Si la unidad recibida difiere de la unidad base, intentar conversión simple
    // (la conversión completa depende de ingredient_unit_conversions, si existe)
    if (params.unit !== baseUnit) {
      // Conversión básica: kg→g (×1000), l→ml (×1000), ud→ud (×1)
      if (params.unit === 'kg' && baseUnit === 'g') qtyBase = params.batchQuantity * 1000;
      else if (params.unit === 'l' && baseUnit === 'ml') qtyBase = params.batchQuantity * 1000;
      // Si no se puede convertir, se usa tal cual
    }

    const lotResult = await client.query(
      `INSERT INTO stock_lots
         (ingredient_id, lot_code, expiry_date, received_at, supplier_id,
          qty_base_initial, qty_base_remaining)
       VALUES ($1, $2, $3, now(), $4, $5, $5)
       RETURNING id, lot_code, qty_base_initial, qty_base_remaining`,
      [
        params.ingredientId,
        params.lotNumber,
        params.expiryDate || null,
        null, // supplier_id es UUID pero stock_lots lo tiene como INT nullable
        qtyBase,
      ]
    );
    result.stockLot = {
      id: lotResult.rows[0].id,
      lotCode: lotResult.rows[0].lot_code,
      qtyInitial: Number(lotResult.rows[0].qty_base_initial),
      qtyRemaining: Number(lotResult.rows[0].qty_base_remaining),
    };

    // Actualizar receiving_log con el lote creado
    await client.query(
      `UPDATE receiving_log SET stock_lot_id = $1 WHERE id = $2`,
      [result.stockLot.id, result.receiving.id]
    );

    // ══════════════════════════════════════════════════════════════
    // PASO 5: Registrar movimiento 'entrada' en stock_movements
    // ══════════════════════════════════════════════════════════════
    const movementResult = await recordStockMovement(
      {
        ingredientId: params.ingredientId,
        movementType: 'entrada',
        qtyBase: qtyBase,
        lotId: result.stockLot.id,
        eventId: null, // no imputable a evento en recepción de OC
        purchaseOrderLineId: params.supplierOrderItemId || null,
        reason: `Recepción OC ${supplierOrder?.id?.slice(0, 8) || ''} lote ${params.lotNumber}`,
      },
      client
    );
    result.stockMovement = {
      id: movementResult.movementId,
      ingredientId: movementResult.ingredientId,
      previousQty: movementResult.previousQty,
      newQty: movementResult.newQty,
    };

    // ══════════════════════════════════════════════════════════════
    // PASO 6: Actualizar línea OC y estado del pedido
    // ══════════════════════════════════════════════════════════════
    if (orderLine && supplierOrder) {
      const qtyOrdered = Number(orderLine.quantity) || 0;
      const qtyBefore = Number(orderLine.received_quantity) || 0;
      const qtyReceivedThisTime = params.batchQuantity;
      const qtyAfter = qtyBefore + qtyReceivedThisTime;

      // Actualizar received_quantity en la línea
      await client.query(
        `UPDATE supplier_order_items SET received_quantity = $1 WHERE id = $2`,
        [qtyAfter, params.supplierOrderItemId]
      );

      // Determinar nuevo estado de la línea
      let lineStatus: string;
      if (qtyAfter >= qtyOrdered) {
        lineStatus = 'received';
      } else {
        lineStatus = 'partial';
      }

      // Actualizar estado de la OC
      // Contar todas las líneas de la OC para determinar el estado general
      const linesResult = await client.query(
        `SELECT quantity, received_quantity FROM supplier_order_items WHERE order_id = $1`,
        [supplierOrder.id]
      );
      const lines = linesResult.rows;
      const allReceived = lines.every(
        (l: any) => Number(l.received_quantity || 0) >= Number(l.quantity)
      );
      const anyReceived = lines.some(
        (l: any) => Number(l.received_quantity || 0) > 0
      );

      let newOrderStatus: string;
      if (allReceived) {
        newOrderStatus = 'received';
      } else if (anyReceived) {
        newOrderStatus = 'partial';
      } else {
        newOrderStatus = supplierOrder.status; // sin cambios
      }

      await client.query(
        `UPDATE supplier_orders SET status = $1, updated_at = now() WHERE id = $2`,
        [newOrderStatus, supplierOrder.id]
      );

      result.orderUpdate = {
        lineId: params.supplierOrderItemId!,
        orderId: supplierOrder.id,
        qtyReceived: qtyAfter,
        orderStatus: newOrderStatus,
      };

      // ══════════════════════════════════════════════════════════════
      // PASO 7: Actualizar precio si difiere + emitir evento
      // ══════════════════════════════════════════════════════════════
      const lineUnitCost = Number(orderLine.unit_cost) || Number(orderLine.cost_per_unit) || 0;
      if (lineUnitCost > 0 && lineUnitCost !== previousPrice) {
        // Actualizar precio en ingredientes
        await client.query(
          `UPDATE ingredients SET unit_cost = $1, updated_at = now() WHERE id = $2`,
          [lineUnitCost, params.ingredientId]
        );

        // Registrar en histórico
        await client.query(
          `INSERT INTO ingredient_price_history
             (ingredient_id, old_price, new_price, changed_by)
           VALUES ($1, $2, $3, $4)`,
          [params.ingredientId, previousPrice, lineUnitCost, 'recepcion_oc']
        );

        // Emitir evento de dominio
        await emitDomainEvent(
          client,
          'ingredient.price_changed',
          'ingredient',
          params.ingredientId,
          {
            ingredient_id: params.ingredientId,
            ingredient_name: ingredient.name,
            old_price: previousPrice,
            new_price: lineUnitCost,
            source: 'recepcion_oc',
            supplier_order_id: supplierOrder.id,
          }
        );

        result.priceChanged = true;
        result.previousPrice = previousPrice;
        result.newPrice = lineUnitCost;
      }

      // Emitir purchase_order.received si la OC cambió de estado
      if (newOrderStatus !== supplierOrder.status) {
        await emitDomainEvent(
          client,
          'purchase_order.received',
          'purchase_order',
          supplierOrder.id,
          {
            purchase_order_id: supplierOrder.id,
            supplier: supplierOrder.supplier,
            old_status: supplierOrder.status,
            new_status: newOrderStatus,
            line_ids: [params.supplierOrderItemId],
          }
        );
      }
    }

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
