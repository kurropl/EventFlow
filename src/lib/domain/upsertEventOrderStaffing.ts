/**
 * EventFlow — Dominio: sugerencia de mesas/camareros sobre event_orders (Spec 001, TZ.3)
 *
 * Única implementación canónica del INSERT INTO event_orders fuera de
 * acceptQuote (que crea el event_order al aceptar presupuesto). Esta función
 * cubre el caso de event-flow/[eventId]/calculate: recalcular mesas/camareros
 * para un evento que aún no tiene event_order (p.ej. creado a mano sin
 * presupuesto previo) o actualizar la sugerencia si ya existe.
 */
import type { Pool, PoolClient } from 'pg';

export interface UpsertEventOrderStaffingParams {
  eventId: string;
  tablesSuggested: number;
  waitersSuggested: number;
}

export async function upsertEventOrderStaffing(
  client: Pool | PoolClient,
  p: UpsertEventOrderStaffingParams
) {
  const existing = await client.query(
    `SELECT id FROM event_orders WHERE event_id = $1 LIMIT 1`,
    [p.eventId]
  );

  // event_orders no tiene columna guest_count propia — events.guest_count ya
  // es la fuente única (bug encontrado vía verify-sprint4.sh: esta UPDATE
  // rompía con "column guest_count does not exist" en cuanto el event_order
  // ya existía, es decir, en casi cualquier recálculo tras la aceptación).
  if (existing.rows?.[0]) {
    await client.query(
      `UPDATE event_orders
       SET tables_suggested = $1, waiters_suggested = $2, updated_at = now()
       WHERE event_id = $3`,
      [p.tablesSuggested, p.waitersSuggested, p.eventId]
    );
  } else {
    await client.query(
      `INSERT INTO event_orders (event_id, quote_id, tables_suggested, waiters_suggested, status)
       SELECT $1, e.quote_id, $2, $3, 'pending'
       FROM events e WHERE e.id = $1 AND e.quote_id IS NOT NULL`,
      [p.eventId, p.tablesSuggested, p.waitersSuggested]
    );
  }
}
