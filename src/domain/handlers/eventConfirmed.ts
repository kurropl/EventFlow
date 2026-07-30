/**
 * EventFlow — Handler: event.confirmed
 * Emite cuando un evento pasa a estado 'confirmado'.
 * Consumidores: WP-15 plantillas venue, WP-17 staffing.
 */

import { getPool } from '@/lib/db';
import { emitDomainEvent } from '../events';
import type { DomainEvent } from '../events';

export interface EventConfirmedPayload {
  event_id: string;
  venue_type: string;
  pax: number;
  date: string;
}

export async function handleEventConfirmed(event: DomainEvent): Promise<void> {
  const payload = event.payload as unknown as EventConfirmedPayload;

  console.log(`[Handler] event.confirmed para evento ${payload.event_id}`);
  console.log(`  Venue: ${payload.venue_type}, Pax: ${payload.pax}, Fecha: ${payload.date}`);

  // Emit event.confirmed.staffing to trigger staffing generation (WP-17)
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await emitDomainEvent(
      client,
      'event.confirmed.staffing',
      'event',
      payload.event_id,
      {
        event_id: payload.event_id,
        venue_type: payload.venue_type,
        pax: payload.pax,
        date: payload.date
      }
    );
    await client.query('COMMIT');
    console.log(`[Handler] Emitted event.confirmed.staffing for event ${payload.event_id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Handler] Failed to emit event.confirmed.staffing:', error);
    throw error;
  } finally {
    client.release();
  }

  // TODO: WP-15 - Generar plantillas automáticas por tipo de venue
}