/**
 * EventFlow — Dominio: máquina de estados única para events.status (Spec 001, R3)
 *
 * `UPDATE events SET ... status = ...` SOLO se escribe aquí, en dos modos:
 *   - `setEventStatus`: escritura directa (sin validar transición), para los
 *     sitios legítimos que fijan el status como efecto secundario de otra
 *     operación (cierre de factura, deducción de stock, automatizaciones,
 *     drag&drop del Kanban...).
 *   - `VALID_TRANSITIONS` + `assertTransition`: el mapa canónico de
 *     transiciones FWD/INV, usado por `events/[id]/transitions/route.ts`.
 */
import type { PoolClient } from 'pg';
import { getPool } from '@/lib/db';

export const VALID_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  'FWD-2': { from: ['draft'],     to: 'sent' },
  'FWD-3': { from: ['sent'],      to: 'accepted' },
  'FWD-4': { from: ['accepted', 'presupuestado'],  to: 'completed' },
  'INV-1': { from: ['sent'],      to: 'lost' },
  'INV-2': { from: ['accepted'],  to: 'sent' },
  'INV-3': { from: ['accepted'],  to: 'cancelled' },
  'INV-4': { from: ['completed'], to: 'reopened' },
  'INV-5': { from: ['reopened'],  to: 'completed' },
};

export class EventStateError extends Error {
  status: number;
  constructor(message: string, status = 409) {
    super(message);
    this.status = status;
  }
}

export function assertTransition(currentStatus: string, code: string) {
  const spec = VALID_TRANSITIONS[code];
  if (!spec) throw new EventStateError(`Invalid transition: ${code}`, 400);
  if (!spec.from.includes(currentStatus)) {
    throw new EventStateError(
      `Cannot apply ${code}: event is '${currentStatus}', expected ${spec.from.join(' or ')}`,
      409
    );
  }
  return spec;
}

/** Sentinel: en `extra`, fija la columna a NOW() en vez de un valor literal. */
export const NOW = Symbol('NOW');

interface SetStatusOpts {
  /** Columnas adicionales a escribir en la misma UPDATE (ej. lost_reason, cancelled_at). */
  extra?: Record<string, any>;
  /** Fragmento SQL literal (sin parámetros de usuario) añadido al WHERE, ej. "AND status != 'completed'". */
  extraWhereSql?: string;
}

export async function setEventStatus(
  clientOrEventId: PoolClient | string,
  maybeEventIdOrStatus: string,
  maybeStatusOrOpts?: string | SetStatusOpts,
  maybeOpts?: SetStatusOpts
): Promise<any | null> {
  const usingClient = typeof clientOrEventId !== 'string';
  const eventId = usingClient ? (maybeEventIdOrStatus as string) : (clientOrEventId as string);
  const status = usingClient ? (maybeStatusOrOpts as string) : (maybeEventIdOrStatus as string);
  const opts = (usingClient ? maybeOpts : (maybeStatusOrOpts as SetStatusOpts | undefined)) || {};
  const client = usingClient ? (clientOrEventId as PoolClient) : getPool();

  const { extra = {}, extraWhereSql = '' } = opts;
  const fields = ['status = $1', 'updated_at = now()'];
  const vals: any[] = [status];
  let p = 2;
  for (const [k, v] of Object.entries(extra)) {
    if (v === NOW) {
      fields.push(`${k} = now()`);
    } else {
      fields.push(`${k} = $${p++}`);
      vals.push(v);
    }
  }
  vals.push(eventId);

  const result = await client.query(
    `UPDATE events SET ${fields.join(', ')} WHERE id = $${p} ${extraWhereSql} RETURNING *`,
    vals
  );
  return result.rows[0] || null;
}
