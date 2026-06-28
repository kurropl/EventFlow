/**
 * EventFlow — Dominio: fuente única de coste (Spec 001, R2, Opción B)
 *
 * `events.total_cost` SOLO se escribe aquí. Su valor es siempre
 * Σ event_shopping_items.estimated_cost de las líneas no congeladas
 * (las congeladas representan el coste "real" ya cerrado, ver
 * `recalcEscandallo.ts::freezeEventEscandallo`) MÁS los gastos previos
 * (FR-A06, `cost_desglose` line_type='extras') que no forman parte del
 * escandallo pero sí del coste real del evento.
 */

import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';

export async function recalcEventCost(
  clientOrEventId: PoolClient | string,
  maybeEventId?: string
): Promise<number> {
  const usingClient = typeof clientOrEventId !== 'string';
  const client = usingClient ? (clientOrEventId as PoolClient) : getPool();
  const eventId = usingClient ? (maybeEventId as string) : (clientOrEventId as string);

  const result = await client.query(
    `UPDATE events SET total_cost = (
       SELECT COALESCE(SUM(estimated_cost), 0)
       FROM event_shopping_items
       WHERE event_id = $1 AND frozen = false
     ) + (
       SELECT COALESCE(SUM(total), 0)
       FROM cost_desglose
       WHERE event_id = $1 AND line_type = 'extras'
     ), updated_at = NOW()
     WHERE id = $1
     RETURNING total_cost`,
    [eventId]
  );

  return Number(result.rows[0]?.total_cost) || 0;
}
