/**
 * EventFlow — Event by ID API Route
 * GET /api/events/[id] — Get single event
 * PUT /api/events/[id] — Update event (status, items, details)
 *
 * When status changes to 'accepted', auto-creates:
 *   - Quote (accepted)
 *   - Event order with table/staff calculation
 *   - 2 payments: 40% deposit (due 7d), 60% final (due event_date)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, transaction } from '@/lib/db';

/**
 * Generate an invoice immediately when a budget is accepted.
 * Creates invoice_number, calculates IVA, and links to the event_order.
 */
async function generateInvoiceFromAccepted(client: any, eventId: string, event: any, quoteId: string) {
  // Find the event_order that was just created for this quote
  const order = (await client.query(
    `SELECT id, confirmed_price, extra_consumptions FROM event_orders WHERE quote_id = $1 LIMIT 1`,
    [quoteId]
  )).rows[0];
  if (!order) return;

  // Check if invoice already exists
  const existingInvoice = (await client.query(
    `SELECT id FROM invoices WHERE event_order_id = $1 LIMIT 1`,
    [order.id]
  )).rows[0];
  if (existingInvoice) return;

  // Try to find a client with fiscal data linked to this event
  let fiscalName = event.client_name;
  let fiscalNif = 'PENDIENTE';
  let clientId = null;
  const clientRecord = (await client.query(
    `SELECT id, fiscal_name, fiscal_nif, name FROM clients WHERE id IN (
      SELECT client_id FROM event_orders WHERE event_id = $1 AND client_id IS NOT NULL LIMIT 1
    ) OR id IN (
      SELECT client_id FROM events e LEFT JOIN leads l ON l.converted_to_client_id = e.client_id WHERE e.id = $2 LIMIT 1
    ) LIMIT 1`,
    [eventId, eventId]
  )).rows[0];
  if (clientRecord) {
    fiscalName = clientRecord.fiscal_name || clientRecord.name;
    fiscalNif = clientRecord.fiscal_nif || 'PENDIENTE';
    clientId = clientRecord.id;
  }

  // Generate invoice number
  const year = new Date().getFullYear();
  let invoiceNumber = `FE-${year}-${Math.floor(Math.random() * 9000) + 1000}`;
  for (let attempts = 0; attempts < 5; attempts++) {
    invoiceNumber = `FE-${year}-${Math.floor(Math.random() * 9000) + 1000}`;
    const exists = (await client.query(
      `SELECT id FROM invoices WHERE invoice_number = $1`, [invoiceNumber]
    )).rows[0];
    if (!exists) break;
  }

  const extrasTotal = (order.extra_consumptions || []).reduce((s: number, ex: any) => s + (ex.amount || 0), 0);
  const subtotal = Number(order.confirmed_price) || 0;
  const ivaPct = Number(event.iva_pct) || 10;
  const ivaAmount = Math.round((subtotal + extrasTotal) * ivaPct / 100 * 100) / 100;
  const total = subtotal + extrasTotal + ivaAmount;

  await client.query(
    `INSERT INTO invoices (event_order_id, event_id, client_id, invoice_number,
      fiscal_name, fiscal_nif, subtotal, iva_pct, iva_amount, total,
      extras_pvp, payments_total, balance_due, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, $10, 'pending')`,
    [order.id, eventId, clientId, invoiceNumber, fiscalName, fiscalNif,
     subtotal, ivaPct, ivaAmount, total, extrasTotal]
  );

  console.log(`[invoice] Auto-generated ${invoiceNumber} for event ${eventId}`);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await querySingle<any>(
      `SELECT * FROM events WHERE id = $1`,
      [id]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Enrich with real prices from catalog
    const items = event.selected_items || [];
    let pvp = Number(event.total_pvp) || 0;
    let cost = Number(event.total_cost) || 0;
    if (items.length > 0 && pvp === 0) {
      const catalogItems = await queryMany<any>(
        `SELECT id, name, pvp, cost FROM catalog_items WHERE active = true`,
        []
      );
      const nameLookup = new Map<string, any>();
      for (const ci of catalogItems) {
        nameLookup.set(ci.name.toLowerCase().trim(), ci);
      }
      for (const item of items) {
        const itemName = (item.name || '').toLowerCase().trim();
        const catItem = nameLookup.get(itemName);
        if (catItem) {
          const qty = Number(item.quantity) || 1;
          pvp += (Number(catItem.pvp) || 0) * qty;
          cost += (Number(catItem.cost) || 0) * qty;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...event, total_pvp: pvp, total_cost: cost },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, total_pvp, total_cost, bar_hours, selected_items,
            client_name, client_email, event_type, guest_count, kids_count, event_date } = body;

    // If selected_items provided, recalculate totals from catalog
    let calculatedPvp = total_pvp;
    let calculatedCost = total_cost;
    if (selected_items && Array.isArray(selected_items)) {
      const catalogItems = await queryMany<any>(
        `SELECT id, name, pvp, cost FROM catalog_items WHERE active = true`,
        []
      );
      const nameLookup = new Map<string, any>();
      for (const ci of catalogItems) {
        nameLookup.set(ci.name.toLowerCase().trim(), ci);
      }
      let pvpSum = 0;
      let costSum = 0;
      for (const item of selected_items) {
        const itemName = (item.name || '').toLowerCase().trim();
        const catItem = nameLookup.get(itemName);
        if (catItem) {
          const qty = Number(item.quantity) || 1;
          pvpSum += (Number(catItem.pvp) || 0) * qty;
          costSum += (Number(catItem.cost) || 0) * qty;
        }
      }
      calculatedPvp = pvpSum;
      calculatedCost = costSum;
    }

    const result = await transaction(async (client) => {
      const fields: string[] = [];
      const vals: any[] = [];
      let p = 1;

      const push = (f: string, v: any) => {
        if (v !== undefined) {
          fields.push(`${f} = $${p++}`);
          vals.push(v);
        }
      };
      const pushIfInBody = (f: string, key: string) => {
        if (key in body) {
          push(f, body[key] ?? null);
        }
      };

      pushIfInBody('status', 'status');
      pushIfInBody('notes', 'notes');
      pushIfInBody('bar_hours', 'bar_hours');
      pushIfInBody('client_name', 'client_name');
      pushIfInBody('client_email', 'client_email');
      pushIfInBody('event_type', 'event_type');
      pushIfInBody('guest_count', 'guest_count');
      pushIfInBody('kids_count', 'kids_count');
      pushIfInBody('event_date', 'event_date');

      if (calculatedPvp !== undefined) {
        fields.push(`total_pvp = $${p++}`);
        vals.push(calculatedPvp);
      }
      if (calculatedCost !== undefined) {
        fields.push(`total_cost = $${p++}`);
        vals.push(calculatedCost);
      }
      if (selected_items !== undefined) {
        fields.push(`selected_items = $${p++}::jsonb`);
        vals.push(JSON.stringify(selected_items));
      }

      if (fields.length === 0) {
        return { event: null };
      }

      vals.push(id);
      const event = (await client.query(
        `UPDATE events SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
        vals
      )).rows[0];

      if (!event) return { event: null };

      // If status just changed to 'accepted', create quote + order + payments
      if (status === 'accepted') {
        const existing = (await client.query(
          `SELECT id FROM quotes WHERE event_id = $1 AND status = 'accepted' LIMIT 1`,
          [id]
        )).rows[0];

        if (!existing) {
          const guests = Number(event.guest_count) || 0;
          const tablesSuggested = Math.max(1, Math.ceil(guests / 10));
          const waitersSuggested = Math.max(1, Math.ceil(guests / 15));
          const pvpTotal = Number(event.total_pvp) || 0;
          const costTotal = Number(event.total_cost) || 0;
          const marginPct = pvpTotal > 0 ? Math.round(((pvpTotal - costTotal) / pvpTotal) * 100 * 100) / 100 : 0;

          const quote = (await client.query(
            `INSERT INTO quotes (event_id, status, base_pvp, base_cost, total_pvp, total_cost,
              bar_price, iva_pct, margin_pct, accepted_at)
             VALUES ($1, 'accepted', $2, $3, $2, $3, $4, $5, $6, now())
             RETURNING id`,
            [id, pvpTotal, costTotal, Number(event.bar_price) || 0, Number(event.iva_pct) || 10, marginPct]
          )).rows[0];

          await client.query(
            `INSERT INTO event_orders (event_id, quote_id, confirmed_price, status,
              tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
             VALUES ($1, $2, $3, 'in_progress', $4, $4, $5, $5)`,
            [id, quote.id, pvpTotal, tablesSuggested, waitersSuggested]
          );

          // 40% deposit (due 7 days from now)
          const depositAmount = Math.round(pvpTotal * 0.4 * 100) / 100;
          const depositDue = new Date();
          depositDue.setDate(depositDue.getDate() + 7);
          await client.query(
            `INSERT INTO payments (event_id, concept, amount, due_date, paid)
             VALUES ($1, 'Señal (40% del presupuesto)', $2, $3::date, false)`,
            [id, depositAmount, depositDue.toISOString().split('T')[0]]
          );

          // 60% final (due on event date)
          const finalAmount = Math.round(pvpTotal * 0.6 * 100) / 100;
          const eventDateStr = event.event_date
            ? new Date(event.event_date).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0];
          await client.query(
            `INSERT INTO payments (event_id, concept, amount, due_date, paid)
             VALUES ($1, 'Saldo final (60% del presupuesto)', $2, $3::date, false)`,
            [id, finalAmount, eventDateStr]
          );

          // AUTO-GENERATE INVOICE immediately
          await generateInvoiceFromAccepted(client, id, event, quote.id);
        }
      }

      return { event };
    });

    if (!result.event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result.event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}