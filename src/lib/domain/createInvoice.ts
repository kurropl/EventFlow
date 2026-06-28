/**
 * EventFlow — Dominio: generación de facturas (Spec 001, R6/TZ.3)
 *
 * Única implementación canónica de "crear una factura" (normal o
 * rectificativa). Reemplaza 3 copias divergentes que existían en:
 *   - invoices/route.ts (POST, numeración FE-YYYY-NNNN vía secuencia)
 *   - events/[id]/close/route.ts (numeración F-YYYY-NNNN vía regexp MAX)
 *   - events/[id]/transitions/route.ts (fwd4/inv5, numeración FE-YYYY-NNNN)
 *
 * Se adopta el esquema F-YYYY-NNNN (secuencial por año, vía MAX) porque es
 * el único contractualmente fijado por un test (`verify-e2e.sh` espera
 * exactamente "F-<año>-0001").
 */
import type { PoolClient } from 'pg';

export interface CreateInvoiceParams {
  orderId: string;
  eventId: string;
  clientId: string | null;
  fiscalName: string;
  fiscalNif: string;
  fiscalAddress?: string | null;
  subtotal: number;
  ivaPct?: number;
  extrasPvp?: number;
  paymentsTotal?: number;
  rectificativaOf?: string | null;
}

export async function nextInvoiceNumber(client: PoolClient): Promise<string> {
  const year = new Date().getFullYear();
  const seq = await client.query(
    `SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '^F-[0-9]+-', ''), '')::int), 0) + 1 AS next
     FROM invoices WHERE invoice_number LIKE $1`,
    [`F-${year}-%`]
  );
  const nextNum = Number(seq.rows?.[0]?.next) || 1;
  return `F-${year}-${String(nextNum).padStart(4, '0')}`;
}

export async function createInvoice(client: PoolClient, p: CreateInvoiceParams) {
  const ivaPct = p.ivaPct ?? 10;
  const extras = p.extrasPvp ?? 0;
  const ivaAmount = Math.round((p.subtotal + extras) * ivaPct / 100 * 100) / 100;
  const total = Math.round((p.subtotal + extras + ivaAmount) * 100) / 100;
  const paymentsTotal = p.paymentsTotal ?? 0;
  const invoiceNumber = await nextInvoiceNumber(client);

  const result = await client.query(
    `INSERT INTO invoices (event_order_id, event_id, client_id, invoice_number,
       fiscal_name, fiscal_nif, fiscal_address, subtotal, iva_pct, iva_amount, total,
       extras_pvp, payments_total, balance_due, status, paid_at, rectificativa_of)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      p.orderId, p.eventId, p.clientId, invoiceNumber,
      p.fiscalName, p.fiscalNif, p.fiscalAddress || null,
      p.subtotal, ivaPct, ivaAmount, total,
      extras, paymentsTotal, Math.max(0, total - paymentsTotal),
      paymentsTotal >= total ? 'paid' : 'pending',
      paymentsTotal >= total ? new Date() : null,
      p.rectificativaOf || null,
    ]
  );
  return result.rows[0];
}
