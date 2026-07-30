/**
 * EventFlow — Motor de recálculo centralizado del escandallo
 * 
 * Escala automáticamente recipe_items por guest_count cuando:
 * - Cambia el número de comensales
 * - Se asigna un plato a un evento
 * - Se actualiza el precio de un ingrediente
 */

import { getPool } from '@/lib/db';
import { recalcEventCost } from '@/lib/domain/recalcEventCost';

/**
 * Recalcula el escandallo de un evento completo
 */
export async function recalcEventEscandallo(
  eventId: string,
  guestCount?: number
): Promise<void> {
  const pool = getPool();
  const event = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
  if (!event.rows.length) return;
  const gc = guestCount ?? Number(event.rows[0].guest_count) ?? 1;

  // WP-05: usar qty_base (unidad base del ingrediente) en vez de quantity (unidad nativa)
  // para que unit_cost (€/unidad base) cuadre correctamente.
  await pool.query(
    `UPDATE event_shopping_items esi
     SET theoretical_qty = (
       SELECT COALESCE(ri.qty_base, ri.quantity_override, ri.quantity) * $1
       FROM recipe_items ri WHERE ri.id = esi.recipe_item_id AND ri.catalog_item_id IS NOT NULL
     ),
     theoretical_unit = (SELECT i.base_unit FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.id = esi.recipe_item_id),
     estimated_cost = (
       SELECT COALESCE(ri.qty_base, ri.quantity_override, ri.quantity) * $1 * (
         SELECT COALESCE(i.unit_cost, 0) FROM ingredients i WHERE i.id = esi.ingredient_id
       )
       FROM recipe_items ri WHERE ri.id = esi.recipe_item_id
     )
     WHERE esi.event_id = $2 AND esi.frozen = false AND esi.recipe_item_id IS NOT NULL`,
    [gc, eventId]
  );

  // R2/Opción B: tras rescalar el escandallo, events.total_cost debe seguir
  // siendo Σ estimated_cost (recalcEventCost es la única fuente de escritura).
  await recalcEventCost(eventId);
}

/**
 * Recalcula el coste estimado de todos los eventos que usan
 * un ingrediente concreto (propagación de precio)
 */
export async function propagatePriceToAllEvents(
  ingredientId: string,
  oldCost: number,
  newCost: number
): Promise<number> {
  const pool = getPool();

  await pool.query(
    `INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by)
     VALUES ($1, $2, $3, 'system')`,
    [ingredientId, oldCost, newCost]
  );

  await pool.query('UPDATE ingredients SET unit_cost = $1 WHERE id = $2', [newCost, ingredientId]);

  const result = await pool.query(
    `SELECT COUNT(DISTINCT event_id) AS affected
     FROM event_shopping_items WHERE ingredient_id = $1 AND frozen = false`,
    [ingredientId]
  );

  return Number(result.rows[0]?.affected) || 0;
}

/**
 * Verifica si algún plato ha caído por debajo del margen mínimo
 */
export async function checkMarginAlerts(
  eventId: string,
  minMarginPct: number = 15
): Promise<{ itemId: string; catalogItemId: string; currentMargin: number; below: boolean }[]> {
  const pool = getPool();

  const result = await pool.query(
    `SELECT esi.id AS item_id, ci.id AS catalog_id,
     (ci.pvp - esi.estimated_cost) / NULLIF(ci.pvp, 0) * 100 AS current_margin
     FROM event_shopping_items esi
     JOIN recipe_items ri ON ri.id = esi.recipe_item_id
     JOIN catalog_items ci ON ci.id = ri.catalog_item_id
     WHERE esi.event_id = $1 AND esi.frozen = false AND esi.estimated_cost > 0
       AND (ci.pvp - esi.estimated_cost) / NULLIF(ci.pvp, 0) * 100 < $2`,
    [eventId, minMarginPct]
  );

  return result.rows.map((row: any) => ({
    itemId: row.item_id,
    catalogItemId: row.catalog_id,
    currentMargin: Number(row.current_margin),
    below: true,
  }));
}

// freezeEventEscandallo eliminada (G20, Sprint 4) — era una copia más pobre
// de domain/../lib/escandallo.ts::freezeEscandallo (no consolidaba real:=teórico
// por línea, no fijaba frozen_at/closed_at). Único call site
// (escandallo/event/[eventId]/route.ts) migrado a la implementación canónica.