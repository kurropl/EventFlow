/**
 * EventFlow — Dominio: generación del contrato de evento (SPEC Sprint 3, G8)
 *
 * Única implementación de "generar el contrato". D3 (decisión usuario): se
 * invoca bajo demanda desde un botón de admin
 * (POST /api/events/[id]/contract/generate), NO automáticamente dentro de
 * acceptQuote — esa función no se toca.
 */
import type { PoolClient } from 'pg';
import { renderContractHtml } from '@/lib/contractTemplate';

export interface GenerateContractResult {
  contract: any;
  created: boolean;
}

/** Genera el contrato del evento si no existe uno activo (pending/signed).
 *  Idempotente: reintentar no duplica (respaldado además por el índice
 *  único parcial idx_event_contracts_active). */
export async function generateEventContract(
  client: PoolClient, eventId: string
): Promise<GenerateContractResult> {
  const existing = (await client.query(
    `SELECT * FROM event_contracts WHERE event_id = $1 AND status != 'voided' LIMIT 1`,
    [eventId]
  )).rows[0];
  if (existing) return { contract: existing, created: false };

  const event = (await client.query(`SELECT * FROM events WHERE id = $1`, [eventId])).rows[0];
  const quote = (await client.query(
    `SELECT * FROM quotes WHERE event_id = $1 ORDER BY accepted_at DESC NULLS LAST, created_at DESC LIMIT 1`,
    [eventId]
  )).rows[0];
  const payments = (await client.query(
    `SELECT concept, amount, due_date FROM payments WHERE event_id = $1 ORDER BY due_date ASC NULLS LAST`,
    [eventId]
  )).rows;

  const html = renderContractHtml({ event, quote, payments });
  const created = (await client.query(
    `INSERT INTO event_contracts (event_id, quote_id, content_html, status)
     VALUES ($1, $2, $3, 'pending') RETURNING *`,
    [eventId, quote?.id ?? null, html]
  )).rows[0];
  return { contract: created, created: true };
}
