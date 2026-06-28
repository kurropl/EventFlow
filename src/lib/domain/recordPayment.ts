/**
 * EventFlow — Dominio: registro de pagos (Spec 001, R6/TZ.3)
 *
 * Única implementación canónica del INSERT INTO payments. Reemplaza copias
 * sueltas en payments/route.ts (alta manual de cobro), payments/signal/route.ts
 * (señal) y events/[id]/transitions.ts (ajuste de rectificativa INV-5).
 */
import type { PoolClient } from 'pg';

export interface RecordPaymentParams {
  eventId: string;
  concept: string;
  amount: number;
  dueDate?: string | Date | null;
  paid?: boolean;
  paidDate?: string | Date | null;
  method?: string | null;
  notes?: string | null;
}

export async function recordPayment(client: PoolClient, p: RecordPaymentParams) {
  const result = await client.query(
    `INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [p.eventId, p.concept, p.amount, p.dueDate || null, p.paid ?? false, p.paidDate || null, p.method || null, p.notes || null]
  );
  return result.rows[0];
}
