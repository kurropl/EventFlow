/**
 * EventFlow — WP-23: Facturación por Hitos
 *
 * Servicio canónico para generar:
 * - Factura de anticipo por hito pagado (advance invoice)
 * - Factura final que deduce anticipos (final invoice)
 *
 * Respetar la numeración F-YYYY-NNNN existente (createInvoice.ts).
 * IVA correcto: subtotal × iva_pct / 100.
 * Campos Verifactu: preparados (columnas existentes), sin implementar lógica.
 */
import type { PoolClient } from 'pg';
import { createInvoice, nextInvoiceNumber } from './createInvoice';

// ============================================================
// Interfaces
// ============================================================

export interface MilestoneRow {
  id: string;
  plan_id: string;
  kind: string;
  label: string;
  amount: number;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  payment_id: string | null;
  invoiced_at: string | null;
  invoice_id: string | null;
}

export interface AdvanceInvoiceResult {
  invoice: any;
  milestone: MilestoneRow;
}

export interface FinalInvoiceResult {
  invoice: any;
  advancesDeducted: number;
  advanceInvoices: Array<{ id: string; invoice_number: string; amount: number }>;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Redondea a 2 decimales (regla fiscal estándar).
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Calcula IVA de un importe base.
 */
function calcIVA(base: number, ivaPct: number): { ivaAmount: number; total: number } {
  const ivaAmount = round2(base * ivaPct / 100);
  const total = round2(base + ivaAmount);
  return { ivaAmount, total };
}

// ============================================================
// Factura de anticipo por hito pagado
// ============================================================

/**
 * Genera una factura de anticipo para un hito pagado.
 *
 * Restricciones:
 * - El hito debe existir, estar en estado 'pagado', y NO estar ya facturado.
 * - El importe de la factura = importe del hito.
 * - Se marca el hito con invoiced_at y invoice_id.
 * - Se emite evento de dominio si existe emitDomainEvent.
 *
 * @param client - PoolClient de la transacción activa
 * @param milestoneId - ID del payment_milestone a facturar
 * @returns { invoice, milestone } - La factura creada y el hito actualizado
 */
export async function createAdvanceInvoice(
  client: PoolClient,
  milestoneId: string
): Promise<AdvanceInvoiceResult> {
  // 1. Obtener el hito con su plan
  const msResult = await client.query(
    `SELECT pm.*, pp.event_id, pp.quote_id, pp.total AS plan_total
     FROM payment_milestones pm
     JOIN payment_plans pp ON pp.id = pm.plan_id
     WHERE pm.id = $1`,
    [milestoneId]
  );
  const milestone = msResult.rows[0] as MilestoneRow & { event_id: string; quote_id: string; plan_total: number };
  if (!milestone) throw new Error('Hito de pago no encontrado');
  if (milestone.status !== 'pagado') throw new Error(`El hito está en estado '${milestone.status}', se requiere 'pagado'`);
  if (milestone.invoice_id) throw new Error('El hito ya tiene una factura asociada');

  // 2. Obtener datos del evento y cliente para la factura
  const evResult = await client.query(
    `SELECT e.id AS event_id, e.client_id, e.client_name, e.iva_pct,
            c.fiscal_name, c.fiscal_nif, c.fiscal_address,
            eo.id AS order_id
     FROM events e
     LEFT JOIN clients c ON c.id = e.client_id
     LEFT JOIN event_orders eo ON eo.event_id = e.id
     WHERE e.id = $1`,
    [milestone.event_id]
  );
  const ev = evResult.rows[0];
  if (!ev) throw new Error('Evento no encontrado');
  if (!ev.fiscal_nif) throw new Error('Datos fiscales del cliente incompletos');
  if (!ev.order_id) throw new Error('El evento no tiene pedido asociado');

  // 3. Crear la factura de anticipo
  const ivaPct = Number(ev.iva_pct) || 10;
  const subtotal = round2(Number(milestone.amount));
  const { ivaAmount, total } = calcIVA(subtotal, ivaPct);

  const invoice = await createInvoice(client, {
    orderId: ev.order_id,
    eventId: milestone.event_id,
    clientId: ev.client_id,
    fiscalName: ev.fiscal_name || ev.client_name || 'Cliente',
    fiscalNif: ev.fiscal_nif || '',
    fiscalAddress: ev.fiscal_address || null,
    subtotal,
    ivaPct,
    paymentsTotal: subtotal, // El anticipo se considera "pagado" al generar la factura
  });

  // 4. Actualizar la factura con tipo 'anticipo' y milestone_id
  await client.query(
    `UPDATE invoices SET
       invoice_type = 'anticipo',
       milestone_id = $1,
       verifactu_status = 'no_enviado'
     WHERE id = $2`,
    [milestoneId, invoice.id]
  );

  // 5. Marcar el hito como facturado
  await client.query(
    `UPDATE payment_milestones SET
       invoiced_at = now(),
       invoice_id = $1
     WHERE id = $2`,
    [invoice.id, milestoneId]
  );

  // 6. Emitir evento de dominio (si existe el helper)
  try {
    const eventsMod = await import(/* webpackIgnore: true */ '../../domain/events').catch(() => null);
    if (eventsMod?.emitDomainEventStandalone) {
      await eventsMod.emitDomainEventStandalone('invoice.advance_created', 'event', milestone.event_id, {
        milestone_id: milestoneId,
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        amount: subtotal,
        iva_pct: ivaPct,
        total,
      });
    }
  } catch {
    // Si el outbox no está disponible, no bloquear la factura
  }

  return {
    invoice: { ...invoice, invoice_type: 'anticipo', milestone_id: milestoneId },
    milestone: { ...milestone, invoiced_at: new Date().toISOString(), invoice_id: invoice.id },
  };
}

// ============================================================
// Factura final que deduce anticipos
// ============================================================

/**
 * Genera la factura final de un evento, deduciendo los anticipos ya facturados.
 *
 * Lógica:
 * 1. Total del evento = confirmed_price del event_order
 * 2. Anticipos = SUM de facturas de tipo 'anticipo' del mismo evento (no canceladas)
 * 3. Base imponible final = Total evento - Anticipos
 * 4. IVA se calcula sobre la base imponible final
 *
 * Restricciones:
 * - El evento debe tener pedido asociado y datos fiscales.
 * - No permite factura final si ya existe una factura final no cancelada.
 *
 * @param client - PoolClient de la transacción activa
 * @param eventId - ID del evento
 * @returns { invoice, advancesDeducted, advanceInvoices }
 */
export async function createFinalInvoice(
  client: PoolClient,
  eventId: string
): Promise<FinalInvoiceResult> {
  // 1. Verificar que no existe ya una factura final no cancelada
  const existingFinal = await client.query(
    `SELECT id, invoice_number FROM invoices
     WHERE event_id = $1 AND invoice_type = 'final' AND status != 'cancelled'`,
    [eventId]
  );
  if (existingFinal.rows.length > 0) {
    const existing = existingFinal.rows[0];
    throw new Error(
      `Ya existe una factura final (${existing.invoice_number}). ` +
      `Cancele la existente antes de generar una nueva.`
    );
  }

  // 2. Obtener datos del evento, pedido y cliente
  const evResult = await client.query(
    `SELECT e.id AS event_id, e.client_id, e.client_name, e.iva_pct,
            c.fiscal_name, c.fiscal_nif, c.fiscal_address,
            eo.id AS order_id, eo.confirmed_price, eo.extra_consumptions
     FROM events e
     LEFT JOIN clients c ON c.id = e.client_id
     LEFT JOIN event_orders eo ON eo.event_id = e.id
     WHERE e.id = $1`,
    [eventId]
  );
  const ev = evResult.rows[0];
  if (!ev) throw new Error('Evento no encontrado');
  if (!ev.fiscal_nif) throw new Error('Datos fiscales del cliente incompletos');
  if (!ev.order_id) throw new Error('El evento no tiene pedido asociado');

  const confirmedPrice = Number(ev.confirmed_price) || 0;
  const extrasTotal = (ev.extra_consumptions || []).reduce(
    (s: number, ex: any) => s + (ex.amount || 0), 0
  );
  const eventTotal = round2(confirmedPrice + extrasTotal);

  // 3. Calcular anticipos ya facturados (facturas de tipo anticipo, no canceladas)
  const advancesResult = await client.query(
    `SELECT id, invoice_number, subtotal
     FROM invoices
     WHERE event_id = $1 AND invoice_type = 'anticipo' AND status != 'cancelled'`,
    [eventId]
  );
  const advanceInvoices = advancesResult.rows.map((r: any) => ({
    id: r.id,
    invoice_number: r.invoice_number,
    amount: Number(r.subtotal),
  }));
  const advancesDeducted = round2(advanceInvoices.reduce((s, a) => s + a.amount, 0));

  // 4. Base imponible final = Total evento - Anticipos deducidos
  const finalSubtotal = round2(Math.max(0, eventTotal - advancesDeducted));

  // 5. Crear la factura final
  const ivaPct = Number(ev.iva_pct) || 10;
  const { ivaAmount, total } = calcIVA(finalSubtotal, ivaPct);

  const invoice = await createInvoice(client, {
    orderId: ev.order_id,
    eventId,
    clientId: ev.client_id,
    fiscalName: ev.fiscal_name || ev.client_name || 'Cliente',
    fiscalNif: ev.fiscal_nif || '',
    fiscalAddress: ev.fiscal_address || null,
    subtotal: finalSubtotal,
    ivaPct,
    extrasPvp: 0, // Extras ya incluidos en confirmed_price según el modelo actual
    paymentsTotal: 0, // La factura final es el saldo pendiente
  });

  // 6. Actualizar la factura con tipo 'final'
  await client.query(
    `UPDATE invoices SET
       invoice_type = 'final',
       verifactu_status = 'no_enviado'
     WHERE id = $1`,
    [invoice.id]
  );

  // 7. Emitir evento de dominio
  try {
    const eventsMod = await import(/* webpackIgnore: true */ '../../domain/events').catch(() => null);
    if (eventsMod?.emitDomainEventStandalone) {
      await eventsMod.emitDomainEventStandalone('invoice.final_created', 'event', eventId, {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        event_total: eventTotal,
        advances_deducted: advancesDeducted,
        advance_invoice_ids: advanceInvoices.map(a => a.id),
        final_subtotal: finalSubtotal,
        iva_pct: ivaPct,
        iva_amount: ivaAmount,
        total,
      });
    }
  } catch {
    // Si el outbox no está disponible, no bloquear la factura
  }

  return {
    invoice: { ...invoice, invoice_type: 'final' },
    advancesDeducted,
    advanceInvoices,
  };
}

// ============================================================
// Consulta de hitos de un evento (para UI)
// ============================================================

/**
 * Obtiene los hitos de un evento con su estado de facturación.
 */
export async function getMilestonesWithInvoiceStatus(
  client: PoolClient,
  eventId: string
): Promise<Array<MilestoneRow & { event_id: string; invoice_number?: string }>> {
  const result = await client.query(
    `SELECT pm.*,
            pp.event_id,
            i.invoice_number,
            i.status AS invoice_status,
            i.total AS invoice_total
     FROM payment_milestones pm
     JOIN payment_plans pp ON pp.id = pm.plan_id
     LEFT JOIN invoices i ON i.id = pm.invoice_id
     WHERE pp.event_id = $1
     ORDER BY pm.due_date ASC NULLS LAST, pm.created_at ASC`,
    [eventId]
  );
  return result.rows;
}
