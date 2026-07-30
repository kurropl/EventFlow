/**
 * EventFlow — WP-02: Servicio único de movimientos de stock
 *
 * `recordStockMovement()` es la ÚNICA función que debe crear movimientos
 * y actualizar el cache de `ingredients.quantity` (la fuente canónica de stock).
 *
 * Flujo por transacción:
 *   1. Lee el stock actual del ingrediente (FOR UPDATE).
 *   2. Inserta el movimiento en `stock_movements`.
 *   3. Actualiza `ingredients.quantity` (cache materializado).
 *   4. Si el stock resultante está por debajo del mínimo, emite
 *      `stock.below_minimum` vía outbox (domain_events).
 *
 * Nota: `stock_entries` e `inventory`/`inventory_movements` se mantienen
 * por compatibilidad con trazabilidad existente (WP-07+ las unificará).
 */
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';
import { emitDomainEvent } from '@/domain/events';

// ── Tipos ────────────────────────────────────────────────────────

export type MovementType = 'entrada' | 'salida' | 'merma' | 'ajuste' | 'retorno';

export interface RecordMovementParams {
  ingredientId: string;
  movementType: MovementType;
  /** Cantidad en unidad base. Para salidas/merma/retorno se almacena negativa. */
  qtyBase: number;
  lotId?: number | null;
  eventId?: string | null;
  purchaseOrderLineId?: string | null;
  reason?: string | null;
  userId?: string | null;
}

export interface RecordMovementResult {
  movementId: number;
  ingredientId: string;
  previousQty: number;
  newQty: number;
  unit: string;
  baseUnit: string;
  belowMinimum: boolean;
}

// ── Función principal ────────────────────────────────────────────

/**
 * Registra un movimiento de stock y actualiza el cache en la misma tx.
 * Si `client` se provee, usa esa transacción; si no, crea una nueva.
 */
export async function recordStockMovement(
  params: RecordMovementParams,
  client?: PoolClient
): Promise<RecordMovementResult> {
  const shouldRelease = !client;
  const tx = client || await getPool().connect();

  try {
    if (!client) await tx.query('BEGIN');

    // 1. Leer stock actual con lock
    const ingRow = (
      await tx.query(
        `SELECT quantity, unit, base_unit, min_stock
         FROM ingredients WHERE id = $1 FOR UPDATE`,
        [params.ingredientId]
      )
    ).rows[0];

    if (!ingRow) throw new Error(`Ingrediente no encontrado: ${params.ingredientId}`);

    const previousQty = Number(ingRow.quantity) || 0;
    const unit: string = ingRow.unit;
    const baseUnit: string = ingRow.base_unit;
    const minStock = Number(ingRow.min_stock) || 0;

    // Normalizar signo: entradas positivas, salidas/merma/retorno negativos
    let signedQty = params.qtyBase;
    if (['salida', 'merma', 'retorno'].includes(params.movementType) && signedQty > 0) {
      signedQty = -signedQty;
    }
    // Ajustes pueden ser positivos o negativos (el usuario decide)
    // Entradas siempre positivas
    if (params.movementType === 'entrada' && signedQty < 0) {
      signedQty = -signedQty;
    }

    // 2. Insertar movimiento
    const movRow = (
      await tx.query(
        `INSERT INTO stock_movements
           (ingredient_id, movement_type, qty_base, lot_id, event_id,
            purchase_order_line_id, reason, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          params.ingredientId,
          params.movementType,
          signedQty,
          params.lotId ?? null,
          params.eventId ?? null,
          params.purchaseOrderLineId ?? null,
          params.reason ?? null,
          params.userId ?? null,
        ]
      )
    ).rows[0];

    // 3. Actualizar cache en ingredients.quantity
    const newQty = Math.max(0, Math.round((previousQty + signedQty) * 10000) / 10000);
    await tx.query(
      `UPDATE ingredients SET quantity = $1, updated_at = now() WHERE id = $2`,
      [newQty, params.ingredientId]
    );

    // 4. Espejo en inventory + inventory_movements (compat trazabilidad)
    const invRow = (
      await tx.query(
        `INSERT INTO inventory (ingredient_id, quantity, unit, last_movement_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (ingredient_id)
         DO UPDATE SET quantity = $2, unit = $3, last_movement_at = now()
         RETURNING id`,
        [params.ingredientId, newQty, unit]
      )
    ).rows[0];

    await tx.query(
      `INSERT INTO inventory_movements
         (inventory_id, movement_type, quantity, unit, reference_type, reference_id,
          previous_stock, new_stock, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        invRow.id,
        params.movementType === 'ajuste' ? 'adjustment'
          : params.movementType === 'entrada' ? 'receipt'
          : params.movementType === 'merma' ? 'consumption'
          : params.movementType === 'retorno' ? 'transfer'
          : 'consumption',
        signedQty,
        unit,
        'stock_movement',
        movRow.id,
        previousQty,
        newQty,
        params.reason ?? null,
      ]
    );

    // 5. Log canónico en stock_entries (compat con receiving existente)
    await tx.query(
      `INSERT INTO stock_entries (ingredient_id, event_id, quantity, unit, movement_reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        params.ingredientId,
        params.eventId ?? null,
        signedQty,
        unit,
        params.movementType,
        params.reason ?? null,
      ]
    );

    // 6. Detectar stock bajo mínimo y emitir evento de dominio
    const belowMinimum = newQty <= minStock && minStock > 0;
    if (belowMinimum) {
      await emitDomainEvent(
        tx,
        'stock.below_minimum',
        'ingredient',
        params.ingredientId,
        {
          ingredient_id: params.ingredientId,
          current: newQty,
          minimum: minStock,
          unit,
          movement_type: params.movementType,
        }
      );
    }

    if (!client) await tx.query('COMMIT');

    return {
      movementId: movRow.id,
      ingredientId: params.ingredientId,
      previousQty,
      newQty,
      unit,
      baseUnit,
      belowMinimum,
    };
  } catch (error) {
    if (!client) await tx.query('ROLLBACK');
    throw error;
  } finally {
    if (shouldRelease) tx.release();
  }
}

// ── Consultas de lectura ─────────────────────────────────────────

/**
 * Lista movimientos de un ingrediente, ordenados por fecha descendente.
 */
export async function getIngredientMovements(
  ingredientId: string,
  limit = 50,
  offset = 0
): Promise<{
  movements: Array<{
    id: number;
    ingredient_id: string;
    movement_type: string;
    qty_base: number;
    lot_id: number | null;
    event_id: string | null;
    reason: string | null;
    user_id: string | null;
    created_at: Date;
    // Joins
    event_name?: string;
    user_name?: string;
  }>;
  total: number;
}> {
  const pool = getPool();

  const countResult = await pool.query(
    `SELECT count(*) FROM stock_movements WHERE ingredient_id = $1`,
    [ingredientId]
  );
  const total = Number(countResult.rows[0].count);

  const rows = (
    await pool.query(
      `SELECT
         sm.id, sm.ingredient_id, sm.movement_type, sm.qty_base,
         sm.lot_id, sm.event_id, sm.reason, sm.user_id, sm.created_at,
         e.client_name AS event_name,
         a.name AS user_name
       FROM stock_movements sm
       LEFT JOIN events e ON e.id = sm.event_id
       LEFT JOIN admins a ON a.id = sm.user_id
       WHERE sm.ingredient_id = $1
       ORDER BY sm.created_at DESC
       LIMIT $2 OFFSET $3`,
      [ingredientId, limit, offset]
    )
  ).rows;

  return { movements: rows, total };
}
