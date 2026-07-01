/**
 * EventFlow — Dominio: trazabilidad de lote FEFO al consumo (SPEC Sprint 3, G5)
 *
 * Complementa (no sustituye) domain/stockLedger.ts: adjustIngredientStock
 * sigue siendo el único escritor del SALDO (ingredients.quantity). Esta
 * función escribe el RASTRO — qué lote concreto (First-Expired-First-Out)
 * cubrió cada consumo — que hoy solo existe si un humano lo introduce a
 * mano vía /api/trazabilidad/lot-consumption/[eventId].
 *
 * Si el stock consumido no proviene de ningún lote registrado (p.ej. una
 * carga inicial de inventario sin receiving_log, o un ajuste manual), NO se
 * inventa un lote: se reporta como `untracedQty` para que el hueco de
 * trazabilidad sea visible, nunca oculto.
 */
import type { PoolClient } from 'pg';

export interface ConsumeLotsParams {
  ingredientId: string;
  eventId: string;
  quantity: number;   // en la unidad de stock del ingrediente (positivo)
  unit: string;
  recipeId?: string | null;
  usedBy?: string;
  guestServed?: number | null;
}

export interface ConsumeLotsResult {
  consumedFromLots: number;
  untracedQty: number;
  lotsUsed: Array<{ lotNumber: string; qty: number }>;
}

export async function consumeLotsFEFO(
  client: PoolClient, p: ConsumeLotsParams
): Promise<ConsumeLotsResult> {
  const lots = (await client.query(
    `SELECT rl.id, rl.lot_number,
            rl.batch_quantity - COALESCE((
              SELECT SUM(quantity_consumed) FROM lot_consumption WHERE receiving_log_id = rl.id
            ), 0) AS remaining
     FROM receiving_log rl
     WHERE rl.ingredient_id = $1
     ORDER BY rl.expiry_date ASC NULLS LAST, rl.received_date ASC
     FOR UPDATE OF rl`,
    [p.ingredientId]
  )).rows.filter((r: any) => Number(r.remaining) > 0);

  let remaining = p.quantity;
  const lotsUsed: Array<{ lotNumber: string; qty: number }> = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Number(lot.remaining));
    if (take <= 0) continue;

    await client.query(
      `INSERT INTO lot_consumption (receiving_log_id, event_id, quantity_consumed, unit)
       VALUES ($1, $2, $3, $4)`,
      [lot.id, p.eventId, take, p.unit]
    );
    await client.query(
      `INSERT INTO traceability_log
         (event_id, ingredient_id, recipe_id, lot_number, receiving_id, quantity_used, unit, used_by, guest_served, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [p.eventId, p.ingredientId, p.recipeId ?? null, lot.lot_number, lot.id, take, p.unit,
       p.usedBy ?? 'sistema (cierre automático)', p.guestServed ?? null, 'Consumo FEFO automático al cierre']
    );
    lotsUsed.push({ lotNumber: lot.lot_number, qty: take });
    remaining -= take;
  }

  return {
    consumedFromLots: Math.round((p.quantity - remaining) * 1000) / 1000,
    untracedQty: Math.round(Math.max(0, remaining) * 1000) / 1000,
    lotsUsed,
  };
}

/** Best-effort: resuelve un recipe_id para el traceability_log a partir del
 *  recipe_item_id de la línea del escandallo. Devuelve null si no hay
 *  correspondencia única (varias versiones de receta para el mismo plato). */
export async function resolveRecipeId(client: PoolClient, recipeItemId: string | null): Promise<string | null> {
  if (!recipeItemId) return null;
  const rows = (await client.query(
    `SELECT r.id FROM recipes r
     JOIN recipe_items ri ON ri.catalog_item_id = r.catalog_item_id
     WHERE ri.id = $1`,
    [recipeItemId]
  )).rows;
  return rows.length === 1 ? rows[0].id : null;
}
