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
import { createInvoice } from '@/lib/domain/createInvoice';
import { recordPayment } from '@/lib/domain/recordPayment';
import { VALID_TRANSITIONS, assertTransition, EventStateError, setEventStatus, NOW } from '@/lib/domain/eventState';
import { releaseVenue } from '@/lib/domain/venueBooking';
import { releaseInventoryCommitments } from '@/lib/domain/inventoryCommitment';
import { closeEvent, CloseEventError } from '@/lib/domain/closeEvent';

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
      case 'FWD-4': return await fwd4(event, motivo, body.invoiceAmount);
      case 'INV-1': return await inv1(event, motivo);
      case 'INV-2': return await inv2(event, motivo);
      case 'INV-3': return await inv3(event, motivo);
      case 'INV-4': return await inv4(event, motivo);
      case 'INV-5': return await inv5(event, motivo);
      case 'OPC-5': return await opc5(event, motivo);
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
  // G19: vía la FK real (quotes.lead_id), no LOWER(name) difuso — mismo fix ya
  // aplicado en acceptQuote.ts (T4.2), propagado aquí.
  if (quote.lead_id) {
    await querySingle(
      `UPDATE leads SET status = 'presupuestado' WHERE id = $1 AND status = 'nuevo'`,
      [quote.lead_id]
    );
  }

  await audit(event.id, 'event', event.id, 'FWD-2', 'draft', 'sent', 'admin', motivo);
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'FWD-2' });
}

// ═══════════════════════════════════════════════════════════════
// FWD-3: Aceptar presupuesto (sent → accepted) — delegates to existing logic
// ═══════════════════════════════════════════════════════════════
async function fwd3(event: any, motivo: string | undefined, req: NextRequest) {
  const pool = await getPool();
  const cli = await pool.connect();
  let quote: any = null;
  try {
    await cli.query('BEGIN');

    const eventRow = await cli.query(
      `SELECT * FROM events WHERE id = $1`, [event.id]
    );
    if (!eventRow.rows.length) throw new Error('Event not found');
    const ev = eventRow.rows[0];

    // 1. Accept quote atomically
    const quoteRes = await cli.query(
      `UPDATE quotes SET status = 'accepted', accepted_at = now()
       WHERE event_id = $1 AND status IN ('sent','draft')
       RETURNING *`, [event.id]
    );
    if (!quoteRes.rows.length) throw new Error('No quote to accept');

    // 2. If quote has deposit_*, also create the payments (40/60)
    quote = quoteRes.rows[0];
    if (quote.deposit_pct && quote.deposit_pct > 0) {
      const totalCost = parseFloat(quote.total_cost || quote.total_price || 0);
      const depositAmount = totalCost * (quote.deposit_pct / 100);

      const existingPayment = await cli.query(
        `SELECT id FROM payments WHERE event_id = $1 AND type = 'deposit'`, [event.id]
      );
      if (!existingPayment.rows.length) {
        await cli.query(
          `INSERT INTO payments (event_id, type, amount, method, notes)
           VALUES ($1, 'deposit', $2, 'transfer', 'Señal automática')`,
          [event.id, depositAmount]
        );
      }

      await cli.query(
        `UPDATE quotes SET deposit_paid = true, deposit_amount = $1 WHERE id = $2`,
        [depositAmount, quote.id]
      );
    }

    await cli.query('COMMIT');
    cli.release();

    await audit(event.id, 'event', event.id, 'FWD-3', 'sent', 'accepted', 'admin', motivo, { quote_id: quote.id });

    // Auto-generate escandallo from recipe_items
    try {
      const { recalcEventEscandallo } = await import('@/lib/recalcEscandallo');
      await recalcEventEscandallo(event.id);
    } catch (e: any) {
      console.warn('[FWD-3] Escandallo recalc skipped:', e.message);
    }

    const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
    return NextResponse.json({ success: true, data: updated, transition: 'FWD-3', stockWarnings: [] });
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    cli.release();
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════
// FWD-4: Realizar evento (accepted → completed) ★ ATOMIC
// ═══════════════════════════════════════════════════════════════
async function fwd4(event: any, motivo?: string, invoiceAmount?: number) {
  // G16/G20 (Sprint 4): delega en domain/closeEvent.ts — única implementación
  // de "cerrar un evento", compartida con /api/events/[id]/close. Antes esta
  // función tenía su propia copia divergente (freeze inline más pobre,
  // forzaba TODOS los pagos a paid=true antes de facturar, no escribía
  // event_cost_deviations, y facturaba con client?.nif — columna inexistente,
  // NIF fiscal siempre vacío). E-B5: closeEvent nunca fuerza pagos.
  try {
    const result = await closeEvent(event.id, { invoiceAmount, motivo });
    await audit(event.id, 'event', event.id, 'FWD-4', 'accepted', 'completed', 'admin', motivo, { effects: result.effects });
    return NextResponse.json({ success: true, data: result.event, transition: 'FWD-4', effects: result.effects });
  } catch (e: any) {
    if (e instanceof CloseEventError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    throw e;
  }
}

// ═══════════════════════════════════════════════════════════════
// INV-1: Marcar perdido (sent → lost)
// ═══════════════════════════════════════════════════════════════
async function inv1(event: any, motivo?: string) {
  if (!motivo) return NextResponse.json({ success: false, error: 'motivo required' }, { status: 400 });

  await setEventStatus(event.id, 'lost', { extra: { lost_at: NOW, lost_reason: motivo } });
  await releaseVenue(getPool(), event.id);  // G1: el salón vuelve a estar libre
  await releaseInventoryCommitments(getPool() as any, event.id);  // G2 (no-op si nunca se aceptó)
  // G19: vía la FK real (events.quote_id -> quotes.lead_id), no LOWER(name) difuso.
  await querySingle(
    `UPDATE leads SET status = 'perdido'
     WHERE id = (SELECT lead_id FROM quotes WHERE id = $1) AND status IN ('nuevo','presupuestado')`,
    [event.quote_id]
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

  const pool = await getPool();
  const cli = await pool.connect();
  try {
    await cli.query('BEGIN');

    // 1. Anular payments
    await cli.query(`UPDATE payments SET paid = false, paid_date = NULL, concept = 'anulado' WHERE event_id = $1 AND paid = true`, [event.id]);

    // 2. Delete event_order and generated shopping items
    await cli.query(`DELETE FROM event_shopping_items WHERE event_id = $1`, [event.id]);
    await cli.query(`DELETE FROM event_orders WHERE event_id = $1`, [event.id]);

    // 3. Revoke guest link
    await cli.query(`UPDATE events SET client_token = NULL WHERE id = $1`, [event.id]);

    // 4. Delete staffing lines for this event
    await cli.query(`DELETE FROM staffing_lines WHERE event_id = $1`, [event.id]);

    // 5. Event back to sent
    await cli.query(
      `UPDATE events SET status = 'sent', total_pvp = 0 WHERE id = $1 RETURNING *`, [event.id]
    );

    await cli.query('COMMIT');
    cli.release();

    // Non-transactional after commit
    await releaseInventoryCommitments(getPool() as any, event.id);
    await recalcEventCost(event.id);

    // 6. Lead back to presupuestado — non-transactional (different aggregate)
    await querySingle(
      `UPDATE leads SET status = 'presupuestado'
       WHERE id = (SELECT lead_id FROM quotes WHERE id = $1) AND status = 'convertido'`,
      [event.quote_id]
    );

    // 7. Restore quote — non-transactional
    await querySingle(`UPDATE quotes SET status = 'draft', accepted_at = NULL WHERE event_id = $1 AND status = 'accepted'`, [event.id]);

    await audit(event.id, 'event', event.id, 'INV-2', 'accepted', 'sent', 'admin', motivo);
    const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
    return NextResponse.json({ success: true, data: updated, transition: 'INV-2' });
  } catch (e) {
    await cli.query('ROLLBACK').catch(() => {});
    cli.release();
    throw e;
  }
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
  await releaseVenue(getPool(), event.id);  // G1: el salón cancelado vuelve a estar libre
  await releaseInventoryCommitments(getPool() as any, event.id);  // G2: stock ya no comprometido

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
// OPC-5: Cierre contable (cerrado_operativo → cerrado_contable)
// Congela la fila de cierre económico y emite event.financially_closed
// ═══════════════════════════════════════════════════════════════
async function opc5(event: any, motivo?: string) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar que existe un cierre económico previo
    const closureResult = await client.query(
      `SELECT id, frozen FROM event_financial_closures WHERE event_id = $1`,
      [event.id]
    );

    if (!closureResult.rows[0]) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'No hay cierre económico registrado. Ejecuta primero el cierre operativo.' },
        { status: 400 }
      );
    }

    if (closureResult.rows[0].frozen) {
      await client.query('ROLLBACK');
      return NextResponse.json(
        { success: false, error: 'El cierre económico ya está congelado.' },
        { status: 409 }
      );
    }

    // 2. Congelar la fila de cierre económico
    await client.query(
      `UPDATE event_financial_closures
       SET frozen = true, closed_by = (SELECT id FROM admins LIMIT 1), closed_at = now(), updated_at = now()
       WHERE event_id = $1`,
      [event.id]
    );

    // 3. Cambiar estado del evento a cerrado_contable
    await client.query(
      `UPDATE events SET status = 'cerrado_contable', updated_at = now()
       WHERE id = $1 AND status = 'cerrado_operativo'`,
      [event.id]
    );

    await client.query('COMMIT');

    // 4. Emitir event.financially_closed (fuera de la transacción principal)
    const { emitDomainEvent } = await import('@/domain/events');
    const closure = closureResult.rows[0];
    const closureData = await client.query(
      `SELECT real_margin_pct FROM event_financial_closures WHERE event_id = $1`,
      [event.id]
    );
    const marginPct = closureData.rows[0]?.real_margin_pct || 0;

    await emitDomainEvent(
      client,
      'event.financially_closed',
      'event',
      event.id,
      { event_id: event.id, real_margin_pct: marginPct }
    );

    // 5. Audit log
    await audit(event.id, 'event', event.id, 'OPC-5', 'cerrado_operativo', 'cerrado_contable', 'admin', motivo, {
      frozen: true,
      real_margin_pct: marginPct
    });

    const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
    return NextResponse.json({ success: true, data: updated, transition: 'OPC-5', frozen: true });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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
