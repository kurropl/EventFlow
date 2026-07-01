/**
 * EventFlow — Dominio: reserva de menaje/equipamiento (SPEC Sprint 4, G12)
 *
 * `equipment_rules` ya calculaba la necesidad de equipamiento por evento
 * (usado por generateLogisticsSheet en cocinaSheets.ts), pero era de solo
 * lectura: nunca se registraba una reserva ni se decrementaba
 * equipment.stock_quantity. Esta función cierra ese hueco reutilizando el
 * cálculo YA existente (no lo duplica) — generateLogisticsSheet la invoca
 * con el mapa de necesidad que ya calculó.
 *
 * E-B2 (decisión usuario): la reserva se dispara automáticamente al generar
 * la hoja de logística, solo para eventos 'externo' (donde aplica
 * transporte) — sin botón manual.
 */
import type { Pool, PoolClient } from 'pg';

/** Upsert idempotente: 1 fila por (evento, equipo) con la cantidad a enviar. */
export async function reserveEquipmentForEvent(
  client: Pool | PoolClient,
  eventId: string,
  neededByEquipmentId: Map<string, number>
): Promise<void> {
  for (const [equipmentId, qty] of neededByEquipmentId) {
    if (qty <= 0) continue;
    await client.query(
      `INSERT INTO event_equipment_checkout (event_id, equipment_id, quantity_sent)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, equipment_id)
       DO UPDATE SET quantity_sent = $3, updated_at = now()`,
      [eventId, equipmentId, Math.ceil(qty)]
    );
  }
}

/** Marca como enviado (carga del camión) todo lo reservado y aún no enviado. */
export async function markEquipmentCheckedOut(
  client: Pool | PoolClient,
  eventId: string
): Promise<void> {
  await client.query(
    `UPDATE event_equipment_checkout SET checked_out_at = now(), updated_at = now()
     WHERE event_id = $1 AND checked_out_at IS NULL`,
    [eventId]
  );
}

/** Marca como devuelto (con notas de rotura/merma si difiere de lo enviado). */
export async function markEquipmentReturned(
  client: Pool | PoolClient,
  eventId: string,
  equipmentId: string,
  quantityReturned: number,
  conditionNotes?: string | null
): Promise<any> {
  const result = await client.query(
    `UPDATE event_equipment_checkout
     SET quantity_returned = $3, condition_notes = $4, returned_at = now(), updated_at = now()
     WHERE event_id = $1 AND equipment_id = $2
     RETURNING *`,
    [eventId, equipmentId, quantityReturned, conditionNotes ?? null]
  );
  return result.rows[0] ?? null;
}
