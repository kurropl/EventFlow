/**
 * EventFlow — Dominio: reserva de salón (SPEC Sprint 1, G1)
 *
 * Única implementación de "reservar/liberar un salón". La garantía dura vive
 * en el constraint EXCLUDE de `venue_bookings` (imposible solapar salón+día);
 * aquí se traduce la violación 23P01 (exclusion_violation) a un error de
 * negocio legible e idempotente.
 *
 * Tres ubicaciones de negocio: 'salon-arriba' y 'salon-abajo' (recursos
 * exclusivos) y "fuera de los salones" (externo → venue_id NULL → sin reserva,
 * varios externos pueden coincidir el mismo día sin conflicto).
 */
import type { Pool, PoolClient } from 'pg';

export class VenueConflictError extends Error {
  status = 409;
  constructor(msg = 'El salón ya está reservado para esa fecha') {
    super(msg);
    this.name = 'VenueConflictError';
  }
}

/**
 * Reserva (idempotente) el salón `venueId` para `eventId` en `eventDate`.
 * No-op + libera si `venueId` es null (evento externo). Lanza
 * VenueConflictError (409) si otro evento ya ocupa ese salón ese día.
 */
export async function reserveVenue(
  client: Pool | PoolClient,
  eventId: string,
  venueId: string | null,
  eventDate: string
): Promise<void> {
  if (!venueId) {
    // Externo (o se le quita el salón): no reserva recurso y libera cualquier
    // reserva previa (p.ej. un evento que pasa de salón a externo).
    await releaseVenue(client, eventId);
    return;
  }
  try {
    await client.query(
      `INSERT INTO venue_bookings (venue_id, event_id, event_date)
       VALUES ($1, $2, $3::date)
       ON CONFLICT (event_id)
       DO UPDATE SET venue_id = EXCLUDED.venue_id, event_date = EXCLUDED.event_date`,
      [venueId, eventId, eventDate]
    );
  } catch (e: any) {
    if (e?.code === '23P01') throw new VenueConflictError();
    throw e;
  }
}

/** Libera la reserva de un evento (idempotente: no falla si no existía). */
export async function releaseVenue(
  client: Pool | PoolClient,
  eventId: string
): Promise<void> {
  await client.query(`DELETE FROM venue_bookings WHERE event_id = $1`, [eventId]);
}

/**
 * Resuelve un slug ('salon-arriba' | 'salon-abajo') a su venue_id.
 * Devuelve null para 'externo', vacío o desconocido (= sin salón).
 */
export async function resolveVenueId(
  client: Pool | PoolClient,
  slug: string | null | undefined
): Promise<string | null> {
  if (!slug || slug === 'externo') return null;
  const r = await client.query(
    `SELECT id FROM venues WHERE slug = $1 AND active = true`,
    [slug]
  );
  return r.rows[0]?.id ?? null;
}

/** Normaliza un valor DATE/Date a 'YYYY-MM-DD'. */
export function toDateStr(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
