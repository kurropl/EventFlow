/**
 * EventFlow — API: Domain Events por evento
 * GET /api/events/[id]/domain-events
 * Retorna los eventos de dominio asociados a un evento específico.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: eventId } = params;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'ID de evento requerido' },
        { status: 400 }
      );
    }

    // Obtener eventos de dominio donde aggregate_id = eventId
    const domainEvents = await queryMany<any>(
      `SELECT id, event_type, aggregate_type, aggregate_id, payload, created_at, processed_at, attempts, last_error
       FROM domain_events
       WHERE aggregate_id = $1
       ORDER BY created_at DESC`,
      [eventId]
    );

    // También obtener interacciones CRM del lead asociado (si existe)
    // Por ahora solo devolvemos domain_events
    const timeline = domainEvents.map((event) => ({
      id: event.id,
      type: 'domain_event',
      event_type: event.event_type,
      payload: event.payload,
      created_at: event.created_at,
      processed_at: event.processed_at,
      status: event.processed_at ? 'processed' : event.attempts > 0 ? 'retrying' : 'pending',
      error: event.last_error,
    }));

    return NextResponse.json({
      success: true,
      data: timeline,
      total: timeline.length,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`[API] Error fetching domain events for event ${params.id}:`, message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}