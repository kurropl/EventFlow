/**
 * EventFlow — WP-09: Consumo por Evento desde Carga y Retorno
 *
 * Servicio que gestiona:
 * 1. Salidas de stock al marcar items en Carga (FEFO)
 * 2. Retornos de consumibles desde Logística
 * 3. Cálculo de merma al cerrar la vuelta
 *
 * Usa recordStockMovement() como writer canónico de stock_movements.
 */
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';
import { recordStockMovement, type RecordMovementResult } from './stockMovements';

// ── Tipos ────────────────────────────────────────────────────────

export interface ConsumeItemParams {
  eventId: string;
  shoppingItemId: string;
  ingredientId: string;
  ingredientName: string;
  quantityBase: number;
  userId?: string | null;
}

export interface ReturnItemParams {
  eventId: string;
  ingredientId: string;
  ingredientName: string;
  quantityReturned: number;
  unit?: string;
  lotId?: number | null;
  userId?: string | null;
  notes?: string | null;
}

export interface CloseReturnParams {
  eventId: string;
  userId?: string | null;
}

export interface ConsumptionSummary {
  eventId: string;
  totalConsumed: number;
  totalReturned: number;
  totalWaste: number;
  items: Array<{
    ingredientId: string;
    ingredientName: string;
    consumed: number;
    returned: number;
    waste: number;
    unit: string;
  }>;
}

// ── Funciones principales ────────────────────────────────────────

/**
 * Registra la salida de stock al marcar un item en Carga.
 * Usa FEFO para seleccionar el lote con caducidad más próxima.
 */
export async function recordConsumption(
  params: ConsumeItemParams,
  client?: PoolClient
): Promise<RecordMovementResult> {
  const shouldRelease = !client;
  const tx = client || await getPool().connect();

  try {
    if (!client) await tx.query('BEGIN');

    // 1. Buscar lote más próximo a caducar (FEFO)
    const lotId = await findNextExpiringLot(tx, params.ingredientId, params.quantityBase);

    // 2. Registrar movimiento de salida
    const result = await recordStockMovement(
      {
        ingredientId: params.ingredientId,
        movementType: 'salida',
        qtyBase: params.quantityBase,
        lotId,
        eventId: params.eventId,
        reason: `Carga evento - ${params.ingredientName}`,
        userId: params.userId,
      },
      tx
    );

    // 3. Actualizar event_shopping_items con la referencia al movimiento
    await tx.query(
      `UPDATE event_shopping_items 
       SET actual_qty_base = $1, stock_movement_id = $2
       WHERE id = $3`,
      [params.quantityBase, result.movementId, params.shoppingItemId]
    );

    if (!client) await tx.query('COMMIT');
    return result;
  } catch (error) {
    if (!client) await tx.query('ROLLBACK');
    throw error;
  } finally {
    if (shouldRelease) tx.release();
  }
}

/**
 * Registra el retorno de un ingrediente no consumido.
 */
export async function recordReturn(
  params: ReturnItemParams,
  client?: PoolClient
): Promise<{ returnId: string; movementResult: RecordMovementResult }> {
  const shouldRelease = !client;
  const tx = client || await getPool().connect();

  try {
    if (!client) await tx.query('BEGIN');

    // 1. Insertar en event_consumable_returns
    const returnRow = (
      await tx.query(
        `INSERT INTO event_consumable_returns
           (event_id, ingredient_id, ingredient_name, quantity_returned, unit, lot_id, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          params.eventId,
          params.ingredientId,
          params.ingredientName,
          params.quantityReturned,
          params.unit || 'g',
          params.lotId ?? null,
          params.notes ?? null,
          params.userId ?? null,
        ]
      )
    ).rows[0];

    // 2. Registrar movimiento de retorno (positivo, reingresa stock)
    const movementResult = await recordStockMovement(
      {
        ingredientId: params.ingredientId,
        movementType: 'retorno',
        qtyBase: params.quantityReturned,
        lotId: params.lotId,
        eventId: params.eventId,
        reason: `Retorno de consumible - ${params.ingredientName}`,
        userId: params.userId,
      },
      tx
    );

    if (!client) await tx.query('COMMIT');
    return { returnId: returnRow.id, movementResult };
  } catch (error) {
    if (!client) await tx.query('ROLLBACK');
    throw error;
  } finally {
    if (shouldRelease) tx.release();
  }
}

/**
 * Cierra la vuelta y calcula la merma (salidas - retornos) por ingrediente.
 * Registra movimientos de merma para las diferencias.
 */
export async function closeReturn(
  params: CloseReturnParams,
  client?: PoolClient
): Promise<ConsumptionSummary> {
  const shouldRelease = !client;
  const tx = client || await getPool().connect();

  try {
    if (!client) await tx.query('BEGIN');

    // 1. Calcular salidas totales del evento por ingrediente
    const exits = (
      await tx.query(
        `SELECT 
           ingredient_id,
           SUM(ABS(qty_base)) as total_consumed
         FROM stock_movements
         WHERE event_id = $1 
           AND movement_type = 'salida'
         GROUP BY ingredient_id`,
        [params.eventId]
      )
    ).rows;

    // 2. Calcular retornos totales del evento por ingrediente
    const returns = (
      await tx.query(
        `SELECT 
           ingredient_id,
           SUM(quantity_returned) as total_returned
         FROM event_consumable_returns
         WHERE event_id = $1
         GROUP BY ingredient_id`,
        [params.eventId]
      )
    ).rows;

    // 3. Indexar por ingredient_id para fácil acceso
    const returnMap = new Map<string, number>();
    for (const r of returns) {
      returnMap.set(r.ingredient_id, Number(r.total_returned));
    }

    const items: ConsumptionSummary['items'] = [];
    let totalConsumed = 0;
    let totalReturned = 0;
    let totalWaste = 0;

    // 4. Para cada ingrediente con salidas, calcular merma
    for (const exit of exits) {
      const ingredientId = exit.ingredient_id;
      const consumed = Number(exit.total_consumed);
      const returned = returnMap.get(ingredientId) || 0;
      const waste = Math.max(0, consumed - returned);

      // Obtener info del ingrediente
      const ing = (
        await tx.query(
          `SELECT id, name, unit FROM ingredients WHERE id = $1`,
          [ingredientId]
        )
      ).rows[0];

      if (ing && waste > 0) {
        // Registrar movimiento de merma
        await recordStockMovement(
          {
            ingredientId,
            movementType: 'merma',
            qtyBase: waste,
            eventId: params.eventId,
            reason: `Merma por cierre de vuelta - Consumido: ${consumed}, Retornado: ${returned}`,
            userId: params.userId,
          },
          tx
        );
      }

      totalConsumed += consumed;
      totalReturned += returned;
      totalWaste += waste;

      items.push({
        ingredientId,
        ingredientName: ing?.name || 'Desconocido',
        consumed,
        returned,
        waste,
        unit: ing?.unit || 'g',
      });
    }

    if (!client) await tx.query('COMMIT');

    return {
      eventId: params.eventId,
      totalConsumed,
      totalReturned,
      totalWaste,
      items,
    };
  } catch (error) {
    if (!client) await tx.query('ROLLBACK');
    throw error;
  } finally {
    if (shouldRelease) tx.release();
  }
}

// ── Funciones auxiliares ─────────────────────────────────────────

/**
 * Busca el lote con caducidad más próxima que tenga stock suficiente (FEFO).
 */
async function findNextExpiringLot(
  client: PoolClient,
  ingredientId: string,
  requiredQty: number
): Promise<number | null> {
  const lot = (
    await client.query(
      `SELECT id, qty_base_remaining
       FROM stock_lots
       WHERE ingredient_id = $1
         AND qty_base_remaining > 0
       ORDER BY expiry_date ASC NULLS LAST, received_at ASC
       LIMIT 1`,
      [ingredientId]
    )
  ).rows[0];

  if (!lot) return null;

  // Si el lote no tiene suficiente, aún lo usamos (parcial)
  return lot.id;
}

/**
 * Obtiene el resumen de consumo de un evento.
 */
export async function getConsumptionSummary(
  eventId: string
): Promise<ConsumptionSummary> {
  const pool = getPool();

  // Salidas
  const exits = (
    await pool.query(
      `SELECT 
         ingredient_id,
         SUM(ABS(qty_base)) as total_consumed
       FROM stock_movements
       WHERE event_id = $1 
         AND movement_type = 'salida'
       GROUP BY ingredient_id`,
      [eventId]
    )
  ).rows;

  // Retornos
  const returns = (
    await pool.query(
      `SELECT 
         ingredient_id,
         SUM(quantity_returned) as total_returned
       FROM event_consumable_returns
       WHERE event_id = $1
       GROUP BY ingredient_id`,
      [eventId]
    )
  ).rows;

  const returnMap = new Map<string, number>();
  for (const r of returns) {
    returnMap.set(r.ingredient_id, Number(r.total_returned));
  }

  const items: ConsumptionSummary['items'] = [];
  let totalConsumed = 0;
  let totalReturned = 0;
  let totalWaste = 0;

  for (const exit of exits) {
    const ingredientId = exit.ingredient_id;
    const consumed = Number(exit.total_consumed);
    const returned = returnMap.get(ingredientId) || 0;
    const waste = consumed - returned;

    const ing = (
      await pool.query(
        `SELECT id, name, unit FROM ingredients WHERE id = $1`,
        [ingredientId]
      )
    ).rows[0];

    totalConsumed += consumed;
    totalReturned += returned;
    totalWaste += Math.max(0, waste);

    items.push({
      ingredientId,
      ingredientName: ing?.name || 'Desconocido',
      consumed,
      returned,
      waste: Math.max(0, waste),
      unit: ing?.unit || 'g',
    });
  }

  return {
    eventId,
    totalConsumed,
    totalReturned,
    totalWaste,
    items,
  };
}
