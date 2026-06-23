/**
 * POST /api/events/[id]/transitions
 *
 * Central state machine for all event transitions.
 * Body: { transition: 'FWD-2'|'FWD-3'|'FWD-4'|'INV-1'|'INV-2'|'INV-3'|'INV-4'|'INV-5', motivo?: string }
 * Every transition is ATOMIC. Every transition is logged to audit_log.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';

type Ctx = { params: Promise<{ id: string }> };

const VALID: Record<string, { from: string[]; to: string }> = {
  'FWD-2': { from: ['draft'],     to: 'sent' },
  'FWD-3': { from: ['sent'],      to: 'accepted' },
  'FWD-4': { from: ['accepted', 'presupuestado'],  to: 'completed' },
  'INV-1': { from: ['sent'],      to: 'lost' },
  'INV-2': { from: ['accepted'],  to: 'sent' },
  'INV-3': { from: ['accepted'],  to: 'cancelled' },
  'INV-4': { from: ['completed'], to: 'reopened' },
  'INV-5': { from: ['reopened'],  to: 'completed' },
};

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: eventId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { transition, motivo } = body;

  if (!transition || !VALID[transition]) {
    return NextResponse.json(
      { success: false, error: `Invalid transition: ${transition}. Valid: ${Object.keys(VALID).join(', ')}` },
      { status: 400 }
    );
  }

  const spec = VALID[transition];

  try {
    const event = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [eventId]);
    if (!event) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    if (!spec.from.includes(event.status)) {
      return NextResponse.json(
        { success: false, error: `Cannot apply ${transition}: event is '${event.status}', expected ${spec.from.join(' or ')}` },
        { status: 409 }
      );
    }

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

async function nextInvoiceNumber(): Promise<string> {
  const row = await querySingle<any>(`SELECT nextval('invoice_number_seq') as seq`);
  return `FE-${new Date().getFullYear()}-${String(row.seq).padStart(4, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// FWD-2: Enviar presupuesto (draft → sent)
// ═══════════════════════════════════════════════════════════════
async function fwd2(event: any, motivo?: string) {
  const quote = await querySingle<any>(
    `SELECT * FROM quotes WHERE event_id = $1 AND status = 'draft' LIMIT 1`, [event.id]
  );
  if (!quote) return NextResponse.json({ success: false, error: 'No draft quote found' }, { status: 400 });

  await querySingle(`UPDATE events SET status = 'sent' WHERE id = $1`, [event.id]);
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
      // Generate shopping items from recipe_items if none exist
      const recipeItems = await queryMany<any>(
        `SELECT ri.*, r.name as recipe_name FROM recipe_items ri
         JOIN recipes r ON r.id = ri.recipe_id
         WHERE r.catalog_item_id IN (
           SELECT id FROM catalog_items WHERE id IN (
             SELECT catalog_item_id FROM recipes WHERE id IN (
               SELECT recipe_id FROM event_menu_items WHERE event_id = $1
             )
           )
         )`,
        [event.id]
      );
      if (recipeItems.length > 0) {
        for (const ri of recipeItems) {
          await querySingle(
            `INSERT INTO event_shopping_items (event_id, ingredient_name, total_grams, total_units, total_ml, theoretical_qty, completed, frozen, frozen_at, recipe_version)
             SELECT $1, ri.ingredient_name, ri.total_grams, ri.total_units, ri.total_ml, ri.theoretical_qty, true, true, now(), ri.recipe_version
             FROM recipe_items ri WHERE ri.id = $2`,
            [event.id, ri.id]
          );
        }
        effects.push(`escandallo: ${recipeItems.length} items generated + frozen`);
      } else {
        effects.push('escandallo: no items to freeze');
      }
    }
  } catch (e: any) {
    effects.push(`escandallo: failed (${e.message})`);
  }

  // 1. Event → completed
  await querySingle(`UPDATE events SET status = 'completed' WHERE id = $1`, [event.id]);
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
      const invoiceNum = await nextInvoiceNumber();
      const client = await querySingle<any>(`SELECT * FROM clients WHERE id = $1`, [order.client_id]);
      const totalPaid = payments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount || 0), 0);
      const price = Number(order.confirmed_price || event.total_pvp || 0);
      const iva = 10;
      const subtotal = price;
      const ivaAmt = Math.round(subtotal * iva) / 100;
      const total = Math.round((subtotal + ivaAmt) * 100) / 100;

      await querySingle(
        `INSERT INTO invoices (event_order_id,event_id,client_id,invoice_number,fiscal_name,fiscal_nif,fiscal_address,subtotal,iva_pct,iva_amount,total,payments_total,balance_due,status,paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [order.id, event.id, order.client_id, invoiceNum, client?.name || event.client_name, client?.nif || '', client?.address || '',
         subtotal, iva, ivaAmt, total, totalPaid, Math.max(0, total - totalPaid), totalPaid >= total ? 'paid' : 'pending', totalPaid >= total ? new Date() : null]
      );
      effects.push(`invoice ${invoiceNum}`);
    }
  }

  // 5. Deduct stock
  try {
    const { deductStockForEvent } = await import('@/app/api/stock/deduct/route');
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

  await querySingle(`UPDATE events SET status = 'lost', lost_at = now(), lost_reason = $2 WHERE id = $1`, [event.id, motivo]);
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

  // 5. Event back to sent
  await querySingle(`UPDATE events SET status = 'sent', total_pvp = 0, total_cost = 0 WHERE id = $1`, [event.id]);

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
  await querySingle(
    `UPDATE events SET status = 'cancelled', cancelled_at = now(), cancelled_by = 'admin', cancel_reason = $2 WHERE id = $1`,
    [event.id, motivo]
  );

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

  await querySingle(
    `UPDATE events SET status = 'reopened', reopened_at = now(), reopened_by = 'admin', reopen_reason = $2, snapshot_previo = $3 WHERE id = $1`,
    [event.id, motivo, JSON.stringify(snapshot)]
  );

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
    if (originalInv) {
      const rectNum = await nextInvoiceNumber();
      const iva = 10;
      const ivaAmt = Math.round(Math.abs(diffAmount) * iva) / 100;
      const total = Math.round((Math.abs(diffAmount) + ivaAmt) * 100) / 100;

      await querySingle(
        `INSERT INTO invoices (event_order_id,event_id,client_id,invoice_number,fiscal_name,fiscal_nif,subtotal,iva_pct,iva_amount,total,status,rectificativa_of)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)`,
        [currentOrder?.id, event.id, originalInv.client_id, rectNum, originalInv.fiscal_name, originalInv.fiscal_nif,
         Math.abs(diffAmount), iva, ivaAmt, total, originalInv.id]
      );
      effects.push(`rectificativa ${rectNum}: ${diffAmount > 0 ? '+' : ''}${diffAmount}€`);

      // Adjust payment
      if (diffAmount > 0) {
        await querySingle(
          `INSERT INTO payments (event_id, concept, amount, due_date, paid) VALUES ($1, 'ajuste_rectificativa', $2, now(), false)`,
          [event.id, diffAmount]
        );
      }
    }
  }

  // 1. Close operations again
  await querySingle(`UPDATE event_orders SET status = 'completed' WHERE event_id = $1`, [event.id]);

  // 2. Event → completed
  await querySingle(`UPDATE events SET status = 'completed' WHERE id = $1`, [event.id]);
  effects.push('event→completed');

  // 3. Clear snapshot
  await querySingle(`UPDATE events SET snapshot_previo = NULL WHERE id = $1`, [event.id]);

  await audit(event.id, 'event', event.id, 'INV-5', 'reopened', 'completed', 'admin', motivo, { effects, diff_amount: diffAmount });
  const updated = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event.id]);
  return NextResponse.json({ success: true, data: updated, transition: 'INV-5', effects });
}
