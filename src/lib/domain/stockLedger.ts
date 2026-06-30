/**
 * EventFlow — Dominio: ledger único de stock (SPEC Sprint 2, G6)
 *
 * Única función que debe escribir `ingredients.quantity`. Antes había al
 * menos 6 sitios con su propio `UPDATE ingredients SET quantity = ...` y,
 * en paralelo, 3 rutas de trazabilidad escribiendo SOLO en `inventory.
 * quantity` (confirmado leyendo el código: receiving/from-order y
 * lot-consumption nunca tocaban `ingredients.quantity`) — la divergencia
 * silenciosa que describía la auditoría (Gap G6).
 *
 * `adjustIngredientStock` cierra el círculo en una sola transacción:
 *   1. Actualiza `ingredients.quantity` (fuente canónica — la que usan
 *      escandallo, stockDeduct e inventory_commitments).
 *   2. Registra en `stock_entries` (log canónico ya usado por receiving).
 *   3. Hace upsert de `inventory.quantity` (espejo para las pantallas de
 *      Trazabilidad) y registra en `inventory_movements` (log detallado que
 *      esas pantallas ya leen) — para que ningún consumidor existente note
 *      el cambio de fontanería interna.
 *
 * El trigger `trg_sync_inventory_quantity` (schema.sql) es una red de
 * seguridad adicional: si algún código futuro escribe `ingredients.quantity`
 * sin pasar por aquí, el SALDO de `inventory` igual queda sincronizado
 * (aunque sin el detalle de movimiento que sí registra esta función).
 */
import type { PoolClient } from 'pg';

export type StockMovementReason =
  | 'operativo' | 'compra_prevision' | 'merma' | 'ajuste_inventario' | 'inventario_inicial';

export type InventoryMovementType =
  | 'receipt' | 'consumption' | 'adjustment' | 'expiry' | 'transfer';

export interface AdjustStockParams {
  ingredientId: string;
  /** Positivo = entrada, negativo = salida. En la unidad de stock del ingrediente. */
  delta: number;
  reason: StockMovementReason;
  movementType: InventoryMovementType;
  eventId?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  notes?: string | null;
  /** Por defecto true: no permite que el stock baje de 0. */
  clampToZero?: boolean;
}

export interface AdjustStockResult {
  ingredientId: string;
  previousQty: number;
  newQty: number;
  unit: string;
}

export async function adjustIngredientStock(
  client: PoolClient,
  p: AdjustStockParams
): Promise<AdjustStockResult> {
  const ing = (await client.query(
    `SELECT quantity, unit FROM ingredients WHERE id = $1 FOR UPDATE`,
    [p.ingredientId]
  )).rows[0];
  if (!ing) throw new Error(`Ingrediente no encontrado: ${p.ingredientId}`);

  const previousQty = Number(ing.quantity) || 0;
  let newQty = previousQty + p.delta;
  if (p.clampToZero !== false) newQty = Math.max(0, newQty);
  const rounded = Math.round(newQty * 10000) / 10000;

  await client.query(
    `UPDATE ingredients SET quantity = $1, updated_at = now() WHERE id = $2`,
    [rounded, p.ingredientId]
  );

  // Log canónico (ya usado por receiving/route.ts).
  await client.query(
    `INSERT INTO stock_entries (ingredient_id, event_id, quantity, unit, movement_reason, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [p.ingredientId, p.eventId ?? null, p.delta, ing.unit, p.reason, p.notes ?? null]
  );

  // Espejo en inventory + log detallado en inventory_movements (compat
  // Trazabilidad). El trigger también haría el upsert del saldo, pero aquí
  // lo hacemos explícito para obtener el id y registrar el movimiento.
  const inv = (await client.query(
    `INSERT INTO inventory (ingredient_id, quantity, unit, last_movement_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (ingredient_id)
     DO UPDATE SET quantity = $2, unit = $3, last_movement_at = now()
     RETURNING id`,
    [p.ingredientId, rounded, ing.unit]
  )).rows[0];

  await client.query(
    `INSERT INTO inventory_movements
       (inventory_id, movement_type, quantity, unit, reference_type, reference_id, previous_stock, new_stock, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [inv.id, p.movementType, p.delta, ing.unit, p.referenceType ?? null, p.referenceId ?? null,
     previousQty, rounded, p.notes ?? null]
  );

  return { ingredientId: p.ingredientId, previousQty, newQty: rounded, unit: ing.unit };
}
