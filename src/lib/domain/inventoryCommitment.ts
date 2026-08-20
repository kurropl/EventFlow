/**
 * EventFlow — Dominio: compromiso de inventario al aceptar presupuesto (G2)
 *
 * Resuelve el gap "dos eventos prometen el mismo stock sin aviso": cada
 * evento aceptado registra cuánto de cada ingrediente consumirá (vía
 * inventory_commitments). checkInventoryShortages compara la demanda de UN
 * evento contra el stock físico MENOS lo ya comprometido por OTROS eventos.
 *
 * Fuente de "stock disponible": ingredients.quantity, la misma que tras G6
 * (domain/stockLedger.ts) es la ÚNICA fuente canónica de stock.
 */
import type { PoolClient } from 'pg';

export interface ShortageRow {
  ingredient_id: string | null;
  ingredient_name: string;
  provider_name: string | null;
  needed: number;
  available: number;   // stock físico MENOS comprometido por otros eventos
  unit: string;
  deficit: number;
}

/** Upsert idempotente: 1 fila por (evento, ingrediente) con la demanda total
 *  del escandallo, convertida a la unidad de stock del ingrediente. */
export async function commitInventoryForEvent(client: PoolClient, eventId: string): Promise<void> {
  await client.query(
    `INSERT INTO inventory_commitments (event_id, ingredient_id, qty_committed)
     SELECT esi.event_id, esi.ingredient_id,
            SUM(convert_uom(esi.theoretical_qty, esi.theoretical_unit, i.unit))
     FROM event_shopping_items esi
     JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.ingredient_id IS NOT NULL
       AND esi.theoretical_qty IS NOT NULL AND esi.theoretical_unit IS NOT NULL
     GROUP BY esi.event_id, esi.ingredient_id
     ON CONFLICT (event_id, ingredient_id)
     DO UPDATE SET qty_committed = EXCLUDED.qty_committed, updated_at = now()`,
    [eventId]
  );
}

/** Libera (borra) todos los compromisos de un evento — idempotente. */
export async function releaseInventoryCommitments(client: PoolClient, eventId: string): Promise<void> {
  await client.query(`DELETE FROM inventory_commitments WHERE event_id = $1`, [eventId]);
}

/** Compara la demanda de `eventId` contra stock físico − compromisos de
 *  OTROS eventos. Incluye también ingredientes que generateEscandallo no
 *  pudo resolver a un ingrediente real (ingredient_id NULL) como aviso
 *  informativo (E3: por ahora solo se avisa, no se genera pedido — queda
 *  como punto de extensión para un futuro modo automático). */
export async function checkInventoryShortages(client: PoolClient, eventId: string): Promise<ShortageRow[]> {
  const resolved = await client.query(
    `SELECT esi.ingredient_id, i.name AS ingredient_name, esi.provider_name, i.unit,
            SUM(convert_uom(esi.theoretical_qty, esi.theoretical_unit, i.unit)) AS needed,
            i.quantity AS on_hand,
            COALESCE((
              SELECT SUM(qty_committed) FROM inventory_commitments
              WHERE ingredient_id = esi.ingredient_id AND event_id <> $1
            ), 0) AS others_committed
     FROM event_shopping_items esi
     JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.ingredient_id IS NOT NULL
       AND esi.theoretical_qty IS NOT NULL AND esi.theoretical_unit IS NOT NULL
     GROUP BY esi.ingredient_id, i.name, esi.provider_name, i.unit, i.quantity`,
    [eventId]
  );

  const unresolved = await client.query(
    `SELECT DISTINCT ingredient_name FROM event_shopping_items
     WHERE event_id = $1 AND ingredient_id IS NULL`,
    [eventId]
  );

  const shortages: ShortageRow[] = [];
  for (const row of resolved.rows) {
    const needed = Number(row.needed) || 0;
    // C2: apply 25% merma factor to needed → purchase-ready quantity
    const brutos = needed / 0.75;
    const available = Math.max(0, Number(row.on_hand) - Number(row.others_committed));
    if (brutos > available) {
      shortages.push({
        ingredient_id: row.ingredient_id, ingredient_name: row.ingredient_name,
        provider_name: row.provider_name, needed, available, unit: row.unit,
        deficit: Math.round((brutos - available) * 1000) / 1000,
      });
    }
  }
  for (const row of unresolved.rows) {
    shortages.push({
      ingredient_id: null, ingredient_name: row.ingredient_name, provider_name: null,
      needed: 0, available: 0, unit: 'ud', deficit: 0,
    });
  }
  return shortages;
}
