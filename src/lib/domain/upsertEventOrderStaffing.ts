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
  guestCount: number;
}

export async function upsertEventOrderStaffing(
  client: Pool | PoolClient,
  p: UpsertEventOrderStaffingParams
) {
  const existing = await client.query(
    `SELECT id FROM event_orders WHERE event_id = $1 LIMIT 1`,
    [p.eventId]
  );

  if (existing.rows?.[0]) {
    await client.query(
      `UPDATE event_orders
       SET tables_suggested = $1, waiters_suggested = $2,
           guest_count = $3, updated_at = now()
       WHERE event_id = $4`,
      [p.tablesSuggested, p.waitersSuggested, p.guestCount, p.eventId]
    );
  } else {
    await client.query(
      `INSERT INTO event_orders (event_id, tables_suggested, waiters_suggested, guest_count, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [p.eventId, p.tablesSuggested, p.waitersSuggested, p.guestCount]
    );
  }
}
