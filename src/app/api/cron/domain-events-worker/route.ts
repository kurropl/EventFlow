/**
 * EventFlow — Domain Events Worker
 * GET /api/cron/domain-events-worker
 * Procesa eventos de dominio pendientes (outbox pattern).
 *
 * Configuración:
 *   - Intervalo recomendado: 30 segundos (configurar en cron externo o Vercel cron)
 *   - Máximo de reintentos por evento: 5
 *   - Backoff exponencial entre reintentos
 *
 * Este worker reutiliza la estructura de cron routes existentes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/security';
import { getPendingEvents, markEventProcessed, recordEventError, type DomainEvent } from '@/domain/events';
import { getHandler, defaultHandler } from '@/domain/handlers';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const BATCH_SIZE = 10;

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    const events = await getPendingEvents(BATCH_SIZE);

    if (events.length === 0) {
      return NextResponse.json({ success: true, message: 'No hay eventos pendientes', processed: 0 });
    }

    let processed = 0;
    let failed = 0;
    const errors: Array<{ id: number; event_type: string; error: string }> = [];

    for (const event of events) {
      try {
        // Si ya agotó reintentos, saltar (quedará con last_error)
        if (event.attempts >= MAX_ATTEMPTS) {
          console.warn(`[Worker] Evento ${event.id} (${event.event_type}) agotó reintentos (${event.attempts}/${MAX_ATTEMPTS})`);
          failed++;
          errors.push({
            id: event.id,
            event_type: event.event_type,
            error: event.last_error || 'Máximo de reintentos alcanzado'
          });
          continue;
        }

        // Obtener handler registrado
        const handler = getHandler(event.event_type) || defaultHandler;

        // Ejecutar handler
        await handler(event);

        // Marcar como procesado
        await markEventProcessed(event.id);
        processed++;

        console.log(`[Worker] Evento ${event.id} (${event.event_type}) procesado correctamente`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[Worker] Error procesando evento ${event.id} (${event.event_type}):`, errorMessage);

        // Registrar error y actualizar contador de intentos
        await recordEventError(event.id, errorMessage);
        failed++;
        errors.push({
          id: event.id,
          event_type: event.event_type,
          error: errorMessage
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      failed,
      total: events.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Worker] Error general:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}