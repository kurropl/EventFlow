/**
 * EventFlow — Handler: event.confirmed
 * Emite cuando un evento pasa a estado 'confirmado'.
 * Consumidores: WP-15 plantillas venue, WP-17 staffing.
 */

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

  // TODO: WP-15 - Generar plantillas automáticas por tipo de venue
  // TODO: WP-17 - Iniciar planificación de personal

  // Por ahora solo registramos la recepción del evento
}