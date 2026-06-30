/**
 * EventFlow — Dominio: coste de personal del evento (SPEC Sprint 1, G3)
 *
 * Mantiene UNA línea `cost_desglose(line_type='personal')` por evento con el
 * coste laboral que afecta al margen. Decisión D4: el margen cuenta SOLO las
 * nóminas PAGADAS (`worker_event_pay.status='paid'`), pero se devuelve también
 * el total asignado (pagado + pendiente) para reflejarlo de forma informativa.
 *
 * NO toca `events.total_cost` (que sigue siendo comida+extras, R2/Opción B):
 * el coste laboral es una dimensión separada del P&L, consumida por
 * `/api/rentabilidad`. Idempotente: borra+inserta su única línea, así que
 * reejecutar converge al mismo estado (no duplica).
 */
import type { Pool, PoolClient } from 'pg';
import { getPool } from '@/lib/db';

const AUTO_LABOR_DESC = 'Personal del evento (nóminas pagadas)';

export interface LaborCost {
  paid: number;   // Σ total_pay de nóminas pagadas → base del margen
  total: number;  // Σ total_pay de todas las nóminas (pagadas + pendientes)
}

export async function recalcEventLaborCost(
  clientOrEventId: Pool | PoolClient | string,
  maybeEventId?: string
): Promise<LaborCost> {
  const usingClient = typeof clientOrEventId !== 'string';
  const client = (usingClient ? clientOrEventId : getPool()) as Pool | PoolClient;
  const eventId = usingClient ? (maybeEventId as string) : (clientOrEventId as string);

  const agg = (await client.query(
    `SELECT COALESCE(SUM(total_pay) FILTER (WHERE status = 'paid'), 0) AS paid,
            COALESCE(SUM(total_pay), 0) AS total
     FROM worker_event_pay WHERE event_id = $1`,
    [eventId]
  )).rows[0];

  const paid = Number(agg?.paid) || 0;
  const total = Number(agg?.total) || 0;

  // Resincroniza la única línea auto de personal (= coste pagado). Idempotente.
  await client.query(
    `DELETE FROM cost_desglose
     WHERE event_id = $1 AND line_type = 'personal' AND description = $2`,
    [eventId, AUTO_LABOR_DESC]
  );
  if (paid > 0) {
    await client.query(
      `INSERT INTO cost_desglose (event_id, line_type, description, quantity, unit_price, total)
       VALUES ($1, 'personal', $2, 1, $3, $3)`,
      [eventId, AUTO_LABOR_DESC, paid]
    );
  }

  return { paid, total };
}
