/**
 * POST /api/events/[id]/transitions
 *
 * Central state machine for all event transitions.
 * Body: { transition: 'FWD-2'|'FWD-3'|'FWD-4'|'INV-1'|'INV-2'|'INV-3'|'INV-4'|'INV-5', motivo?: string }
 * Every transition is ATOMIC. Every transition is logged to audit_log.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, getPool } from '@/lib/db';
import { recalcEventCost } from '@/lib/domain/recalcEventCost';
import { generateEscandallo } from '@/lib/domain/generateEscandallo';
import { createInvoice } from '@/lib/domain/createInvoice';
import { recordPayment } from '@/lib/domain/recordPayment';
import { VALID_TRANSITIONS, assertTransition, EventStateError, setEventStatus, NOW } from '@/lib/domain/eventState';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: eventId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { transition, motivo } = body;

  if (!transition || !VALID_TRANSITIONS[transition]) {
    return NextResponse.json(
      { success: false, error: `Invalid transition: ${transition}. Valid: ${Object.keys(VALID_TRANSITIONS).join(', ')}` },
      { status: 400 }
    );
  }

  try {
    const event = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [eventId]);
    if (!event) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    assertTransition(event.status, transition);

    switch (transition) {
      case 'FWD-2': return await fwd2(event, motivo);
      case 'FWD-3': return await fwd3(event, motivo, req);
      case 'FWD-4': return await fwd4(event, motivo);
      case 'INV-1': return await inv1(event, motivo);
      case 'INV-2': return await inv2(event, motivo);
      case 'INV-3': return await inv3(event, motivo);
      case 'INV-4': return await inv4(event, motivo);
      case 'INV-5': return await inv5(event, motivo);
      default:
        return NextResponse.json({ success: false, error: 'Not implemented' }, { status: 501 });
    }
  } catch (error: any) {
    if (error instanceof EventStateError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error(`[transition ${transition}] Error:`, error);
    return NextResponse.json({ success: false, error: error.message || 'Transition failed' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

async function audit(eventId: string | null, entity: string, entityId: string, action: string, from: string | null, to: string, actor = 'admin', motivo?: string, meta: Record<string, any> = {}) {
  await querySingle(
    `INSERT INTO audit_log (event_id, entity_type, entity_id, action, from_status, to_status, actor, motivo, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [eventId, entity, entityId, action, from, to, actor, motivo || null, JSON.stringify(meta)]
  );
}

// ═══════════════════════════════════════════════════════════════
// FWD-2: Enviar presupuesto (draft → sent)
// ═══════════════════════════════════════════════════════════════
async function fwd2(event: any, motivo?: string) {
  const quote = await querySingle<any>(
    `SELECT * FROM quotes WHERE event_id = $1 AND status = 'draft' LIMIT 1`, [event.id]
  );
  if (!quote) return NextResponse.json({ success: false, error: 'No draft quote found' }, { status: 400 });

  await setEventStatus(event.id, 'sent');
  await querySingle(`UPDATE quotes SET status = 'sent', sent_at = now() WHERE id = $1 AND status = 'draft'`, [quote.id]);
  await querySingle(
    `UPDATE leads SET status = 'presupuestado' WHERE LOWER(name) = LOWER($1) AND status = 'nuevo'`,
    [event.client_name]
  );

  await audit(event.id, 'event', event.id, 'FWD-2', 'draft', 'sent', 'admin', motivo);
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'FWD-2' });
}

// ═══════════════════════════════════════════════════════════════
// FWD-3: Aceptar presupuesto (sent → accepted) — delegates to existing logic
// ═══════════════════════════════════════════════════════════════
async function fwd3(event: any, motivo: string | undefined, req: NextRequest) {
  const quote = await querySingle<any>(
    `SELECT * FROM quotes WHERE event_id = $1 AND status IN ('sent','draft') LIMIT 1`, [event.id]
  );
  if (!quote) return NextResponse.json({ success: false, error: 'No quote found' }, { status: 400 });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const cookie = req.headers.get('cookie') || '';
  const res = await fetch(`${baseUrl}/api/quotes/${quote.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ status: 'accepted' }),
  });
  const data = await res.json();
  if (!data.success) return NextResponse.json({ success: false, error: data.error }, { status: res.status });

  await audit(event.id, 'event', event.id, 'FWD-3', 'sent', 'accepted', 'admin', motivo, { quote_id: quote.id });

  // Auto-generate escandallo from recipe_items
  try {
    const { recalcEventEscandallo } = await import('@/lib/recalcEscandallo');
    await recalcEventEscandallo(event.id);
  } catch (e: any) {
    console.warn('[FWD-3] Escandallo recalc skipped:', e.message);
  }

  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'FWD-3', stockWarnings: data.stockWarnings });
}

// ═══════════════════════════════════════════════════════════════
// FWD-4: Realizar evento (accepted → completed) ★ ATOMIC
// ═══════════════════════════════════════════════════════════════
async function fwd4(event: any, motivo?: string) {
  const payments = await queryMany<any>(`SELECT * FROM payments WHERE event_id = $1`, [event.id]);
  if (payments.length === 0) {
    return NextResponse.json({ success: false, error: 'Cannot realize: no payments exist' }, { status: 400 });
  }

  const effects: string[] = [];

  // 0. Freeze escandallo — marcar consumos reales como congelados
  try {
    const shoppingItems = await queryMany<any>(
      `SELECT id FROM event_shopping_items WHERE event_id = $1 AND frozen = false`,
      [event.id]
    );
    if (shoppingItems.length > 0) {
      await querySingle(
        `UPDATE event_shopping_items SET frozen = true, frozen_at = now() WHERE event_id = $1 AND frozen = false`,
        [event.id]
      );
      effects.push(`escandallo: ${shoppingItems.length} items frozen`);
    } else {
      // Sin filas previas: generar vía la única fuente canónica (domain/generateEscandallo,
      // misma usada por acceptQuote) y congelar el resultado.
      const order = await querySingle<any>(`SELECT id FROM event_orders WHERE event_id = $1 LIMIT 1`, [event.id]);
      const { created } = await generateEscandallo(getPool() as any, event.id, order?.id ?? null);
      if (created > 0) {
        await querySingle(
          `UPDATE event_shopping_items SET frozen = true, frozen_at = now() WHERE event_id = $1 AND frozen = false`,
          [event.id]
        );
        effects.push(`escandallo: ${created} items generated + frozen`);
      } else {
        effects.push('escandallo: no items to freeze');
      }
    }
  } catch (e: any) {
    effects.push(`escandallo: failed (${e.message})`);
  }

  // 1. Event → completed
  await setEventStatus(event.id, 'completed');
  effects.push('event→completed');

  // 2. Close operations
  await querySingle(`UPDATE event_orders SET status = 'completed' WHERE event_id = $1 AND status != 'completed'`, [event.id]);
  effects.push('operations→closed');

  // 3. Complete unpaid payments
  const unpaid = payments.filter(p => !p.paid);
  for (const p of unpaid) {
    await querySingle(`UPDATE payments SET paid = true, paid_date = now() WHERE id = $1`, [p.id]);
  }
  if (unpaid.length > 0) effects.push(`${unpaid.length} payments completed`);

  // 4. Generate invoice if not exists
  const existingInv = await querySingle<any>(`SELECT id FROM invoices WHERE event_id = $1 LIMIT 1`, [event.id]);
  if (!existingInv) {
    const order = await querySingle<any>(`SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`, [event.id]);
    if (order) {
      const client = await querySingle<any>(`SELECT * FROM clients WHERE id = $1`, [order.client_id]);
      const totalPaid = payments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount || 0), 0);
      const subtotal = Number(order.confirmed_price || event.total_pvp || 0);

      const invoice = await createInvoice(getPool() as any, {
        orderId: order.id,
        eventId: event.id,
        clientId: order.client_id,
        fiscalName: client?.name || event.client_name,
        fiscalNif: client?.nif || '',
        fiscalAddress: client?.address || '',
        subtotal,
        paymentsTotal: totalPaid,
      });
      effects.push(`invoice ${invoice.invoice_number}`);
    }
  }

  // 5. Deduct stock
  try {
    const { deductStockForEvent } = await import('@/lib/stockDeduct');
    const r = await deductStockForEvent(event.id);
    if (r.deducted > 0) effects.push(`stock: ${r.deducted} items`);
  } catch (e: any) {
    effects.push(`stock: failed (${e.message})`);
  }

  await audit(event.id, 'event', event.id, 'FWD-4', 'accepted', 'completed', 'admin', motivo, { effects });
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'FWD-4', effects });
}

// ═══════════════════════════════════════════════════════════════
// INV-1: Marcar perdido (sent → lost)
// ═══════════════════════════════════════════════════════════════
async function inv1(event: any, motivo?: string) {
  if (!motivo) return NextResponse.json({ success: false, error: 'motivo required' }, { status: 400 });

  await setEventStatus(event.id, 'lost', { extra: { lost_at: NOW, lost_reason: motivo } });
  await querySingle(
    `UPDATE leads SET status = 'perdido' WHERE LOWER(name) = LOWER($1) AND status IN ('nuevo','presupuestado')`,
    [event.client_name]
  );

  await audit(event.id, 'event', event.id, 'INV-1', 'sent', 'lost', 'admin', motivo);
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'INV-1' });
}

// ═══════════════════════════════════════════════════════════════
// INV-2: Revertir aceptación (accepted → sent) — signal returned
// ═══════════════════════════════════════════════════════════════
async function inv2(event: any, motivo?: string) {
  const inv = await querySingle<any>(`SELECT id FROM invoices WHERE event_id = $1 LIMIT 1`, [event.id]);
  if (inv) return NextResponse.json({ success: false, error: 'Cannot revert: invoice exists. Cancel instead.' }, { status: 409 });

  // 1. Anular payments
  await querySingle(`UPDATE payments SET paid = false, paid_date = NULL, concept = 'anulado' WHERE event_id = $1 AND paid = true`, [event.id]);

  // 2. Delete event_order and generated shopping items
  await querySingle(`DELETE FROM event_shopping_items WHERE event_id = $1`, [event.id]);
  await querySingle(`DELETE FROM event_orders WHERE event_id = $1`, [event.id]);

  // 3. Revoke guest link
  await querySingle(`UPDATE events SET client_token = NULL WHERE id = $1`, [event.id]);

  // 4. Delete staffing lines for this event
  await querySingle(`DELETE FROM staffing_lines WHERE event_id = $1`, [event.id]);

  // 5. Event back to sent — total_cost se recalcula vía la fuente única (R2):
  // sin escandallo queda en Σ gastos previos (no se pierden al revertir).
  await setEventStatus(event.id, 'sent', { extra: { total_pvp: 0 } });
  await recalcEventCost(event.id);

  // 6. Lead back to presupuestado (linked via client_name matching)
  await querySingle(
    `UPDATE leads SET status = 'presupuestado' WHERE LOWER(name) = LOWER($1) AND status = 'convertido'`,
    [event.client_name]
  );

  // 7. Restore quote
  await querySingle(`UPDATE quotes SET status = 'draft', accepted_at = NULL WHERE event_id = $1 AND status = 'accepted'`, [event.id]);

  await audit(event.id, 'event', event.id, 'INV-2', 'accepted', 'sent', 'admin', motivo);
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'INV-2' });
}

// ═══════════════════════════════════════════════════════════════
// INV-3: Cancelar evento (accepted → cancelled) — signal retained as penalty
// ═══════════════════════════════════════════════════════════════
async function inv3(event: any, motivo?: string) {
  if (!motivo) return NextResponse.json({ success: false, error: 'motivo required' }, { status: 400 });

  const inv = await querySingle<any>(`SELECT id FROM invoices WHERE event_id = $1 LIMIT 1`, [event.id]);
  if (inv) return NextResponse.json({ success: false, error: 'Cannot cancel: invoice exists.' }, { status: 409 });

  // 1. Reclassify partial payment as penalty (RETAIN, don't refund)
  await querySingle(
    `UPDATE payments SET concept = 'penalizacion_por_cancelacion', notes = $2 WHERE event_id = $1 AND concept = 'senal'`,
    [event.id, `Penalización por cancelación: ${motivo}`]
  );

  // 2. Delete guest link
  await querySingle(`UPDATE events SET client_token = NULL WHERE id = $1`, [event.id]);

  // 3. Event → cancelled
  await setEventStatus(event.id, 'cancelled', {
    extra: { cancelled_at: NOW, cancelled_by: 'admin', cancel_reason: motivo },
  });

  // Lead stays as 'convertido' for cancelled events (they are still a client)
  await audit(event.id, 'event', event.id, 'INV-3', 'accepted', 'cancelled', 'admin', motivo);
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'INV-3' });
}

// ═══════════════════════════════════════════════════════════════
// INV-4: Reabrir operaciones (completed → reopened)
// ═══════════════════════════════════════════════════════════════
async function inv4(event: any, motivo?: string) {
  if (!motivo) return NextResponse.json({ success: false, error: 'motivo required' }, { status: 400 });

  // Snapshot current operations state
  const order = await querySingle<any>(
    `SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`, [event.id]
  );
  const shoppingItems = await queryMany<any>(
    `SELECT * FROM event_shopping_items WHERE event_id = $1`, [event.id]
  );
  const snapshot = { order, shopping_items: shoppingItems, captured_at: new Date().toISOString() };

  await setEventStatus(event.id, 'reopened', {
    extra: { reopened_at: NOW, reopened_by: 'admin', reopen_reason: motivo, snapshot_previo: JSON.stringify(snapshot) },
  });

  // Block new invoice generation
  await querySingle(`UPDATE event_orders SET status = 'reopened' WHERE event_id = $1`, [event.id]);

  await audit(event.id, 'event', event.id, 'INV-4', 'completed', 'reopened', 'admin', motivo, { has_snapshot: true });
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'INV-4' });
}

// ═══════════════════════════════════════════════════════════════
// INV-5: Recerrar evento (reopened → completed) — generates rectificativa if needed
// ═══════════════════════════════════════════════════════════════
async function inv5(event: any, motivo?: string) {
  // Compare snapshot with current state
  const snapshot = event.snapshot_previo;
  const currentOrder = await querySingle<any>(
    `SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`, [event.id]
  );
  const currentShopping = await queryMany<any>(
    `SELECT * FROM event_shopping_items WHERE event_id = $1`, [event.id]
  );

  let diffAmount = 0;
  if (snapshot?.order && currentOrder) {
    const oldPrice = Number(snapshot.order.confirmed_price || 0);
    const newPrice = Number(currentOrder.confirmed_price || 0);
    diffAmount = newPrice - oldPrice;
  }

  const effects: string[] = [];

  // Generate rectificativa if amount changed
  if (Math.abs(diffAmount) > 0.01) {
    const originalInv = await querySingle<any>(
      `SELECT * FROM invoices WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1`, [event.id]
    );
    if (originalInv && currentOrder) {
      const rectificativa = await createInvoice(getPool() as any, {
        orderId: currentOrder.id,
        eventId: event.id,
        clientId: originalInv.client_id,
        fiscalName: originalInv.fiscal_name,
        fiscalNif: originalInv.fiscal_nif,
        subtotal: Math.abs(diffAmount),
        rectificativaOf: originalInv.id,
      });
      effects.push(`rectificativa ${rectificativa.invoice_number}: ${diffAmount > 0 ? '+' : ''}${diffAmount}€`);

      // Adjust payment
      if (diffAmount > 0) {
        await recordPayment(getPool() as any, {
          eventId: event.id,
          concept: 'ajuste_rectificativa',
          amount: diffAmount,
        });
      }
    }
  }

  // 1. Close operations again
  await querySingle(`UPDATE event_orders SET status = 'completed' WHERE event_id = $1`, [event.id]);

  // 2. Event → completed (y limpia el snapshot a la vez)
  await setEventStatus(event.id, 'completed', { extra: { snapshot_previo: null } });
  effects.push('event→completed');

  await audit(event.id, 'event', event.id, 'INV-5', 'reopened', 'completed', 'admin', motivo, { effects, diff_amount: diffAmount });
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'INV-5', effects });
}
