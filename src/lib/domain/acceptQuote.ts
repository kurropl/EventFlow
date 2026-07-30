/**
 * EventFlow — Dominio: aceptación de presupuesto (Spec 001, R1, D1)
 *
 * Única implementación canónica de "aceptar un presupuesto". Reemplaza las
 * 3+ copias divergentes que existían en:
 *   - quotes/[id]/route.ts (PUT status=accepted)
 *   - quotes/public/[id]/accept/route.ts (cliente, sin auth)
 *   - events/[id]/route.ts (PUT status=accepted)
 *   - events/[id]/confirm/route.ts
 *
 * Transacción única, idempotente: cada paso comprueba existencia antes de
 * escribir, así que llamar dos veces con el mismo quoteId no duplica nada.
 */

import { transaction } from '@/lib/db';
import { calcMesas, calcCamareros, type ServiceType } from '@/lib/operations';
import { getOperationRatios } from './operationRatios';
import { generateEscandallo } from './generateEscandallo';
import { recalcEventCost } from './recalcEventCost';
import { setEventStatus } from './eventState';
import { reserveVenue, toDateStr, VenueConflictError } from './venueBooking';
import { commitInventoryForEvent, checkInventoryShortages, type ShortageRow } from './inventoryCommitment';
import { generateSupplierOrdersForEvent } from './generateSupplierOrders';
import { upsertStaffingLines } from './staffingSizing';
import { generatePaymentPlan } from './paymentPlan';

export interface AcceptQuoteResult {
  quote: any;
  event: any;
  eventOrder: any;
  payments: any[];
  paymentPlan: any;  // WP-21: plan de pago con hitos
  clientToken: string;
  stockWarnings: ShortageRow[];
}

export class AcceptQuoteError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Acepta el presupuesto `quoteId`: marca quote+event como accepted, crea
 * event_order, pagos 40/60, client_token, escandallo, recalcula el coste
 * del evento desde el escandallo y genera la sugerencia de staffing.
 */
export async function acceptQuote(quoteId: string): Promise<AcceptQuoteResult> {
  return transaction(async (client) => {
    const quote = (await client.query(
      `SELECT q.*, e.guest_count, e.event_date, e.service_type, e.client_id
       FROM quotes q JOIN events e ON e.id = q.event_id
       WHERE q.id = $1`,
      [quoteId]
    )).rows[0];

    if (!quote) throw new AcceptQuoteError('Presupuesto no encontrado', 404);
    if (quote.status === 'rejected' || quote.status === 'cancelled' || quote.status === 'expired') {
      throw new AcceptQuoteError(`No se puede aceptar un presupuesto ${quote.status}`, 400);
    }
    if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
      throw new AcceptQuoteError('El presupuesto ha expirado', 400);
    }

    // WP-03: Defensa en profundidad — rechazar si ya hay un presupuesto
    // aceptado/pagado para el mismo evento (el constraint DB lo bloquea
    // también, pero este chequeo da un error 409 claro al usuario).
    const eventId = quote.event_id;
    const existingAccepted = (await client.query(
      `SELECT id FROM quotes
       WHERE event_id = $1 AND status IN ('accepted', 'paid') AND id != $2
       LIMIT 1`,
      [eventId, quoteId]
    )).rows[0];
    if (existingAccepted) {
      throw new AcceptQuoteError(
        'Ya existe un presupuesto aceptado para este evento. ' +
        'Solo se permite un presupuesto aceptado por evento.',
        409
      );
    }
    const ratios = await getOperationRatios();

    // 1) Marcar quote accepted (idempotente: no-op si ya lo estaba)
    const updatedQuote = (await client.query(
      `UPDATE quotes SET status = 'accepted', accepted_at = COALESCE(accepted_at, now())
       WHERE id = $1 RETURNING *`,
      [quoteId]
    )).rows[0];

    const pvpTotal = Number(updatedQuote.total_pvp) || 0;

    // Proyectar total_pvp a events; total_cost lo fija recalcEventCost al final.
    await client.query(
      `UPDATE events SET total_pvp = $2 WHERE id = $1`,
      [eventId, pvpTotal]
    );

    // 2) event_order — idempotente por quote_id (1 order por quote)
    let eventOrder = (await client.query(
      `SELECT * FROM event_orders WHERE quote_id = $1 LIMIT 1`,
      [quoteId]
    )).rows[0];

    if (!eventOrder) {
      const guests = Number(quote.guest_count) || 0;
      const serviceType: ServiceType = quote.service_type === 'coctel' ? 'coctel' : 'menu';
      const tablesSuggested = Math.max(1, calcMesas(guests, ratios));
      const waitersSuggested = Math.max(1, calcCamareros(guests, serviceType, ratios));

      eventOrder = (await client.query(
        `INSERT INTO event_orders (event_id, quote_id, client_id, confirmed_price, final_price, status,
          extra_consumptions, tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
         VALUES ($1, $2, $3, $4, $4, 'in_progress', '[]', $5, $5, $6, $6)
         RETURNING *`,
        [eventId, quoteId, quote.client_id || null, pvpTotal, tablesSuggested, waitersSuggested]
      )).rows[0];
    }

    // 3) Pagos 40/60 — idempotente por (event_id, concept) + Plan de pagos (WP-21)
    const payments: any[] = [];
    const depositConcept = 'Señal (40% del presupuesto)';
    const finalConcept = 'Saldo (60% del presupuesto)';

    let deposit = (await client.query(
      `SELECT * FROM payments WHERE event_id = $1 AND concept = $2 LIMIT 1`,
      [eventId, depositConcept]
    )).rows[0];
    if (!deposit) {
      const depositAmount = Math.round(pvpTotal * 0.4 * 100) / 100;
      const depositDue = new Date();
      depositDue.setDate(depositDue.getDate() + 7);
      deposit = (await client.query(
        `INSERT INTO payments (event_id, concept, amount, due_date, paid)
         VALUES ($1, $2, $3, $4::date, false)
         RETURNING *`,
        [eventId, depositConcept, depositAmount, depositDue.toISOString().split('T')[0]]
      )).rows[0];
    }
    payments.push(deposit);

    let finalPayment = (await client.query(
      `SELECT * FROM payments WHERE event_id = $1 AND concept = $2 LIMIT 1`,
      [eventId, finalConcept]
    )).rows[0];
    if (!finalPayment) {
      const finalAmount = Math.round(pvpTotal * 0.6 * 100) / 100;
      const eventDateStr = quote.event_date
        ? new Date(quote.event_date).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      finalPayment = (await client.query(
        `INSERT INTO payments (event_id, concept, amount, due_date, paid)
         VALUES ($1, $2, $3, $4::date, false)
         RETURNING *`,
        [eventId, finalConcept, finalAmount, eventDateStr]
      )).rows[0];
    }
    payments.push(finalPayment);

    // 3.5) WP-21: Generar plan de pago con hitos configurables
    const eventDateForPlan = quote.event_date
      ? new Date(quote.event_date).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];
    const paymentPlan = await generatePaymentPlan(
      client, eventId, quoteId, pvpTotal, eventDateForPlan
    );

    // 4) client_token — idempotente (solo se genera si falta)
    let event = (await client.query(`SELECT * FROM events WHERE id = $1`, [eventId])).rows[0];
    let clientToken = event.client_token;
    if (!clientToken) {
      const { v4: uuidv4 } = await import('uuid');
      clientToken = uuidv4();
      await client.query(`UPDATE events SET client_token = $1 WHERE id = $2`, [clientToken, eventId]);
    }

    // 5) Escandallo (idempotente: generateEscandallo no duplica si ya existe)
    await generateEscandallo(client, eventId, eventOrder.id);

    // 5.5) G2 (Sprint 2): comprometer el inventario que este evento reclama
    // y comprobar faltantes contra lo ya comprometido por OTROS eventos
    // (evita que dos bodas de la misma semana se prometan el mismo stock
    // sin aviso). E1 (decisión usuario): bloqueo OPCIONAL vía
    // business_settings.block_accept_on_stock_shortage (false por defecto =
    // no bloqueante, igual que G1 si fuera desactivable). Si bloquea, nada
    // de esta transacción se confirma (rollback completo). Si no bloquea,
    // se genera un pedido borrador (E2: nunca se envía, requiere
    // confirmación humana) y se avisa vía stockWarnings.
    await commitInventoryForEvent(client, eventId);
    const stockWarnings = await checkInventoryShortages(client, eventId);
    if (stockWarnings.length > 0) {
      const settings = (await client.query(
        `SELECT block_accept_on_stock_shortage FROM business_settings LIMIT 1`
      )).rows[0];
      if (settings?.block_accept_on_stock_shortage) {
        const names = stockWarnings.map(s => s.ingredient_name).join(', ');
        throw new AcceptQuoteError(`Stock insuficiente para aceptar: ${names}`, 409);
      }
      await generateSupplierOrdersForEvent(client, eventId, stockWarnings);
    }

    // 6) Fuente única de coste (Opción B)
    await recalcEventCost(client, eventId);

    // 7) Staffing (G10, Sprint 4: fuente única domain/staffingSizing.ts,
    // idempotente vía upsert — antes solo se generaba si NO existía ninguna
    // línea, dejando cocinero/metre obsoletos tras un cambio de comensales)
    const guests = Number(quote.guest_count) || 0;
    const serviceType: ServiceType = quote.service_type === 'coctel' ? 'coctel' : 'menu';
    if (guests > 0) {
      await upsertStaffingLines(client, eventId, guests, serviceType, ratios);
    }

    // 7.5) G1 (Sprint 1): al confirmar el evento, su salón queda reservado.
    // Externo (venue_id NULL) → no-op. Si el salón ya está ocupado ese día,
    // reserveVenue lanza VenueConflictError (409) y, al estar dentro de la
    // transacción, revierte TODO (orden, pagos, escandallo…): no se confirma
    // un evento que no puede ocupar su salón.
    try {
      await reserveVenue(client, eventId, event.venue_id ?? null, toDateStr(event.event_date));
    } catch (e) {
      // Unifica el 409 bajo AcceptQuoteError para que los callers existentes
      // (que ya mapean AcceptQuoteError.status) devuelvan 409 sin cambios.
      if (e instanceof VenueConflictError) throw new AcceptQuoteError(e.message, 409);
      throw e;
    }

    // 8) Transición de estado a 'accepted' (R3, única vía: domain/eventState).
    event = await setEventStatus(client, eventId, 'accepted');

    // 9) Sincronizar lead → 'convertido' (fix T4.2: quotes.lead_id es la
    // relación real; events NO tiene lead_id, leads NO tiene event_id).
    if (quote.lead_id) {
      await client.query(
        `UPDATE leads SET status = 'convertido', updated_at = NOW() WHERE id = $1`,
        [quote.lead_id]
      );
    }

    return { quote: updatedQuote, event, eventOrder, payments, paymentPlan, clientToken, stockWarnings };
  });
}
