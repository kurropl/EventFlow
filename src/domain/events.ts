/**
 * EventFlow — Domain Events (Outbox pattern)
 * Emisión y consumo de eventos de dominio.
 */

import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';

// ============================================================
// Emisión de eventos
// ============================================================

/**
 * Emite un evento de dominio dentro de la transacción activa.
 * @param client - Cliente de la transacción (PoolClient con tx activa)
 * @param eventType - Tipo de evento (catálogo §5)
 * @param aggregateType - Tipo de agregado ('event', 'purchase_order', 'menu', ...)
 * @param aggregateId - ID del agregado (string, normalmente UUID)
 * @param payload - Datos del evento (JSONB)
 */
export async function emitDomainEvent(
  client: PoolClient,
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const query = `
    INSERT INTO domain_events (event_type, aggregate_type, aggregate_id, payload)
    VALUES ($1, $2, $3, $4)
  `;
  await client.query(query, [eventType, aggregateType, aggregateId, JSON.stringify(payload)]);
}

/**
 * Emite un evento de dominio usando el pool (sin transacción externa).
 * Crea su propia transacción para garantizar atomicidad.
 */
export async function emitDomainEventStandalone(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await emitDomainEvent(client, eventType, aggregateType, aggregateId, payload);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// Consumo de eventos (Worker)
// ============================================================

export interface DomainEvent {
  id: number;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  created_at: Date;
  processed_at: Date | null;
  attempts: number;
  last_error: string | null;
}

/**
 * Obtiene eventos pendientes de procesar.
 */
export async function getPendingEvents(limit = 10): Promise<DomainEvent[]> {
  const result = await getPool().query<DomainEvent>(
    `SELECT id, event_type, aggregate_type, aggregate_id, payload, created_at, processed_at, attempts, last_error
     FROM domain_events
     WHERE processed_at IS NULL
     ORDER BY id ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Marca un evento como procesado.
 */
export async function markEventProcessed(eventId: number): Promise<void> {
  await getPool().query(
    `UPDATE domain_events SET processed_at = now() WHERE id = $1`,
    [eventId]
  );
}

/**
 * Registra un error en el procesamiento de un evento.
 */
export async function recordEventError(eventId: number, error: string): Promise<void> {
  await getPool().query(
    `UPDATE domain_events
     SET attempts = attempts + 1, last_error = $1
     WHERE id = $2`,
    [error, eventId]
  );
}

/**
 * Obtiene eventos fallidos que han agotado reintentos.
 */
export async function getFailedEvents(maxAttempts = 5): Promise<DomainEvent[]> {
  const result = await getPool().query<DomainEvent>(
    `SELECT id, event_type, aggregate_type, aggregate_id, payload, created_at, processed_at, attempts, last_error
     FROM domain_events
     WHERE processed_at IS NULL AND attempts >= $1
     ORDER BY id ASC`,
    [maxAttempts]
  );
  return result.rows;
}