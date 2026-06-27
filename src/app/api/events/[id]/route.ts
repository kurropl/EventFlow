/**
 * EventFlow — Event by ID API Route
 * GET /api/events/[id] — Get single event
 * PUT /api/events/[id] — Update event (status, items, details)
 *
 * When status changes to 'accepted', auto-creates:
 *   - Quote (accepted)
 *   - Event order with table/staff calculation
 *   - 2 payments: 40% deposit (due 7d), 60% final (due event_date)
 * DELETE /api/events/[id] — Delete event
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { deductStockForEvent } from '@/lib/stockDeduct';
import { calcMesas, calcCamareros, type ServiceType } from '@/lib/operations';

const BAR_PRICE_PER_HOUR = 15; // € per person per hour

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
      SELECT e.client_id FROM events e LEFT JOIN leads l ON l.converted_to_client_id = e.client_id WHERE e.id = $2 LIMIT 1
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
    let costing: { lines: any[]; subtotal: number; margin: number; marginPercent: number; pvp: number } = { lines: [], subtotal: 0, margin: 0, marginPercent: 0, pvp: 0 };

    // Centralized costing from event_costs (same for budget/escandallo/invoice)
    if (event.status === 'draft' || event.status === 'sent') {
      // Recalcular desde catálogo
      if (items.length > 0 && pvp === 0) {
        const catalogItems = await queryMany<any>(
          `SELECT id, name, pvp, cost, category FROM catalog_items WHERE active = true`,
          []
        );
        const nameLookup = new Map<string, any>();
        const catLookup = new Map<string, any[]>();
        for (const ci of catalogItems) {
          nameLookup.set(ci.name.toLowerCase().trim(), ci);
          if (!catLookup.has(ci.category)) catLookup.set(ci.category, []);
          const catArr = catLookup.get(ci.category)!;
          catArr.push(ci);
        }
        for (const item of items) {
          const itemName = (item.name || '').toLowerCase().trim();
          const itemCat = (item.category || '').toLowerCase().trim();
          let catItem = nameLookup.get(itemName);
          if (!catItem && itemCat) {
            const catItems = catLookup.get(itemCat);
            if (catItems && catItems.length > 0) {
              catItem = catItems.reduce((min: any, ci: any) =>
                (Number(ci.pvp) || 0) < (Number(min?.pvp) || Infinity) ? ci : min
              );
            }
          }
          if (catItem) {
            const qty = Number(item.quantity) || 1;
            pvp += (Number(catItem.pvp) || 0) * qty;
            cost += (Number(catItem.cost) || 0) * qty;
          }
        }
      }
    } else if (event.status === 'accepted' || event.status === 'won') {
      // Coste congelado desde event_costs
      const eventLines = await queryMany<any>(
        `SELECT ingredient_name, quantity, unit, unit_cost, line_total FROM event_costs WHERE event_id = $1`,
        [event.id]
      );
      const subtotal = eventLines.reduce((s: number, l: any) => s + Number(l.line_total || 0), 0);
      costing = {
        lines: eventLines,
        subtotal,
        margin: subtotal * 0.2,
        marginPercent: 20,
        pvp: subtotal * 1.2,
      };
    }

    return NextResponse.json({
      success: true,
      data: { ...event, total_pvp: pvp, total_cost: cost, total_display: pvp + (Number(event.bar_price) || 0), costing },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
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
            client_name, client_email, event_type, guest_count, kids_count, event_date,
            linen_type, centerpiece } = body;

    // If selected_items provided, recalculate totals from catalog
    let calculatedPvp = total_pvp;
    let calculatedCost = total_cost;
    if (selected_items && Array.isArray(selected_items)) {
      const catalogItems = await queryMany<any>(
        `SELECT id, name, pvp, cost, category FROM catalog_items WHERE active = true`,
        []
      );
      const nameLookup = new Map<string, any>();
      const catLookup = new Map<string, any[]>();
      for (const ci of catalogItems) {
        nameLookup.set(ci.name.toLowerCase().trim(), ci);
        if (!catLookup.has(ci.category)) catLookup.set(ci.category, []);
        const catArr = catLookup.get(ci.category)!;
        catArr.push(ci);
      }
      let pvpSum = 0;
      let costSum = 0;
      for (const item of selected_items) {
        const itemName = (item.name || '').toLowerCase().trim();
        const itemCat = (item.category || '').toLowerCase().trim();
        let catItem = nameLookup.get(itemName);
        // Fallback: if name doesn't match, try category match (take cheapest in category)
        if (!catItem && itemCat) {
          const catItems = catLookup.get(itemCat);
          if (catItems && catItems.length > 0) {
            catItem = catItems.reduce((min: any, ci: any) =>
              (Number(ci.pvp) || 0) < (Number(min?.pvp) || Infinity) ? ci : min
            );
          }
        }
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
      pushIfInBody('bar_price', 'bar_price');
      pushIfInBody('client_name', 'client_name');
      pushIfInBody('client_email', 'client_email');
      pushIfInBody('event_type', 'event_type');
      pushIfInBody('guest_count', 'guest_count');
      pushIfInBody('kids_count', 'kids_count');
      pushIfInBody('event_date', 'event_date');
      pushIfInBody('linen_type', 'linen_type');
      pushIfInBody('centerpiece', 'centerpiece');
      pushIfInBody('service_type', 'service_type');
      pushIfInBody('venue_type', 'venue_type');
      pushIfInBody('location', 'location');
      pushIfInBody('venue_pdf_url', 'venue_pdf_url');

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
          const serviceType: ServiceType = event.service_type === 'coctel' ? 'coctel' : 'menu';
          const tablesSuggested = Math.max(1, calcMesas(guests));
          const waitersSuggested = Math.max(1, calcCamareros(guests, serviceType));
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
            `INSERT INTO event_orders (event_id, quote_id, client_id, confirmed_price, status,
              tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
             VALUES ($1, $2, $3, $4, 'in_progress', $5, $5, $6, $6)`,
            [id, quote.id, event.client_id || null, pvpTotal, tablesSuggested, waitersSuggested]
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

    // ── Auto-deduct stock when event moves to 'completed' or 'paid' ──
    if (status === 'completed' || status === 'paid') {
      try {
        const deductionResult = await deductStockForEvent(id);
        console.log(
          `[events PUT] Stock deducted for event ${id}: ${deductionResult.deducted} items`,
          deductionResult.details
        );
      } catch (deductError) {
        // Don't fail the event update if stock deduction fails — log and continue
        console.error('[events PUT] Stock deduction failed (non-fatal):', deductError);
      }
    }

    // ── Auto-update lead status when event is sent ──
    if (status === 'sent' && result.event?.client_email) {
      try {
        await querySingle(
          `UPDATE leads SET status = 'presupuestado', updated_at = now()
           WHERE lower(email) = lower($1) AND status IN ('nuevo', 'contactado')`,
          [result.event.client_email]
        );
      } catch (e) {
        console.error('[events PUT] Lead status update failed (non-fatal):', e);
      }
    }

    return NextResponse.json({ success: true, data: result.event });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}