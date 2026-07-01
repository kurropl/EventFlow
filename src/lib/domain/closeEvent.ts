/**
 * EventFlow — Dominio: cierre de evento unificado (SPEC Sprint 4, G16 + G20)
 *
 * Única implementación de "cerrar un evento". Reemplaza dos copias
 * divergentes que existían en events/[id]/close/route.ts y en
 * transitions/route.ts::fwd4, con diferencias reales de comportamiento:
 * fwd4 exigía payments.length>0 (close no), solo fwd4 actualizaba
 * event_orders.status y escribía audit_log, la fuente del subtotal de
 * factura difería, y fwd4 nunca llamaba a freezeEscandallo (la
 * implementación canónica, G20) sino a un UPDATE inline más pobre.
 *
 * E-B5 (decisión usuario) — facturación parcial explícita: el cierre NUNCA
 * fuerza pagos a paid=true (elimina el comportamiento de fwd4 que lo hacía).
 * La primera factura del evento cubre `opts.invoiceAmount` si se indica, o
 * por defecto Σ(payments.paid=true) — igual que ya hacía close/route.ts.
 * El resto queda pendiente de cobro manual y de una factura POSTERIOR,
 * reutilizable vía POST /api/events/[id]/invoice (fuera de este cierre).
 */
import type { Pool } from 'pg';
import { getPool, querySingle, queryMany } from '@/lib/db';
import { freezeEscandallo } from '@/lib/escandallo';
import { generateEscandallo } from './generateEscandallo';
import { deductStockForEvent } from '@/lib/stockDeduct';
import { setEventStatus } from './eventState';
import { createInvoice } from './createInvoice';

export class CloseEventError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface CloseEventOpts {
  /** Importe a facturar en esta primera factura del cierre. Si se omite,
   *  se factura el total del evento (igual que el comportamiento previo de
   *  close/route.ts: subtotal = ev.total_pvp, con payments_total informativo
   *  según lo ya cobrado). NUNCA se fuerza el pago de nada — el estado
   *  'pending'/'paid' de la factura resultante depende solo de payments. */
  invoiceAmount?: number;
  motivo?: string;
}

export interface CloseEventResult {
  event: any;
  effects: string[];
}

export async function closeEvent(eventId: string, opts: CloseEventOpts = {}): Promise<CloseEventResult> {
  const pool: Pool = getPool();
  const effects: string[] = [];

  const ev = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [eventId]);
  if (!ev) throw new CloseEventError('Evento no encontrado', 404);

  const payments = await queryMany<any>(`SELECT * FROM payments WHERE event_id = $1`, [eventId]);
  if (payments.length === 0) {
    throw new CloseEventError('No se puede cerrar: el evento no tiene pagos registrados', 400);
  }

  // 1. Freeze escandallo (canónica G20) — idempotente. Si no hay líneas
  // todavía, generarlas primero (mismo fallback que tenía fwd4).
  const frozenRow = await querySingle<any>(
    `SELECT 1 FROM event_shopping_items WHERE event_id = $1 AND frozen = true LIMIT 1`,
    [eventId]
  );
  if (!frozenRow) {
    const anyRow = await querySingle<any>(`SELECT 1 FROM event_shopping_items WHERE event_id = $1 LIMIT 1`, [eventId]);
    if (!anyRow) {
      const order0 = await querySingle<any>(`SELECT id FROM event_orders WHERE event_id = $1 LIMIT 1`, [eventId]);
      const { created } = await generateEscandallo(pool as any, eventId, order0?.id ?? null);
      if (created > 0) effects.push(`Escandallo generado (${created} líneas)`);
    }
    const dev = await freezeEscandallo(eventId);
    effects.push(`Escandallo congelado (real ${dev.real.toFixed(2)} € vs estimado ${dev.estimado.toFixed(2)} €, desv. ${dev.desviacion.toFixed(2)} €)`);
  }

  // 2. event_orders → completed (siempre; antes solo lo hacía fwd4)
  await pool.query(
    `UPDATE event_orders SET status = 'completed' WHERE event_id = $1 AND status != 'completed'`,
    [eventId]
  );
  effects.push('Operaciones cerradas');

  // 3. Facturación parcial explícita (E-B5) — NUNCA se fuerza el pago.
  const order = await querySingle<any>(`SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`, [eventId]);
  if (order) {
    const invoicedSoFar = await querySingle<any>(
      `SELECT COALESCE(SUM(subtotal), 0) AS total FROM invoices WHERE event_order_id = $1 AND status != 'cancelled'`,
      [order.id]
    );
    // Solo genera la PRIMERA factura del cierre — si ya hay alguna (de un
    // cierre previo o de una llamada manual a /invoice), no se duplica; el
    // resto del importe se gestiona con POST /api/events/[id]/invoice.
    if (Number(invoicedSoFar?.total) === 0) {
      const client = await querySingle<any>(`SELECT * FROM clients WHERE id = $1`, [ev.client_id]);
      const paidRes = await querySingle<any>(
        `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE event_id = $1 AND paid = true`,
        [eventId]
      );
      const paidTotal = Number(paidRes?.paid) || 0;
      const amount = opts.invoiceAmount ?? Number(ev.total_pvp || 0);
      if (amount > 0) {
        const invoice = await createInvoice(pool as any, {
          orderId: order.id,
          eventId,
          clientId: ev.client_id,
          fiscalName: client?.fiscal_name || client?.name || ev.client_name || 'Cliente',
          fiscalNif: client?.fiscal_nif || '',
          fiscalAddress: client?.fiscal_address || null,
          subtotal: amount,
          ivaPct: Number(ev.iva_pct || 10),
          paymentsTotal: Math.min(amount, paidTotal),
        });
        effects.push(`Factura ${invoice.invoice_number} generada (${amount.toFixed(2)} €)`);
      } else {
        effects.push('Sin importe cobrado todavía: factura pendiente de generación manual');
      }
    }
  }

  // 4. Deducción de stock real (idempotente vía events.stock_deducted)
  if (!ev.stock_deducted) {
    const ded = await deductStockForEvent(eventId);
    effects.push(`Stock deducido (${ded?.deducted ?? 0} ingredientes)`);
    if (ded?.traceGaps?.length) effects.push(...ded.traceGaps.map((g) => `⚠ Trazabilidad: ${g}`));
  }

  // 5. Estado → completed (siempre, vía la fuente única domain/eventState)
  await setEventStatus(eventId, 'completed', {
    extraWhereSql: `AND status NOT IN ('paid','cancelled','lost')`,
  });
  effects.push('Evento cerrado');

  // 6. audit_log (siempre; antes solo lo escribía fwd4)
  await pool.query(
    `INSERT INTO audit_log (event_id, entity_type, entity_id, action, from_status, to_status, actor, motivo, metadata)
     VALUES ($1, 'event', $1, 'CLOSE', $2, 'completed', 'admin', $3, $4)`,
    [eventId, ev.status, opts.motivo ?? null, JSON.stringify({ effects })]
  );

  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [eventId]);
  return { event: updated, effects };
}
