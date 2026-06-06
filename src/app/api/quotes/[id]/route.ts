/**
 * EventFlow — Single Quote API
 * GET /api/quotes/[id]       — Get quote details
 * PUT /api/quotes/[id]       — Update quote (price, status)
 *                            When status → 'accepted': creates event_order + payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quote = await querySingle<any>(
      `SELECT q.*, e.*, e.id AS event_id, e.status AS event_status
       FROM quotes q JOIN events e ON e.id = q.event_id
       WHERE q.id = $1`, [params.id]
    );
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    return NextResponse.json({ data: quote });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { base_pvp, bar_price, extras_pvp, extras_cost, iva_pct, status, notes } = body;

    // When accepting, create event_order + payments in a transaction
    if (status === 'accepted') {
      const result = await transaction(async (client) => {
        // Get the quote with event data
        const quoteRow = (await client.query(
          `SELECT q.*, e.guest_count, e.event_date, e.total_pvp, e.bar_price, e.iva_pct
           FROM quotes q JOIN events e ON e.id = q.event_id
           WHERE q.id = $1`, [params.id]
        )).rows[0];

        if (!quoteRow) throw new Error('Quote not found');

        // Check if event_order already exists
        const existingOrder = (await client.query(
          `SELECT id FROM event_orders WHERE quote_id = $1 LIMIT 1`, [params.id]
        )).rows[0];

        if (existingOrder) {
          // Just update the quote status
          const updated = (await client.query(
            `UPDATE quotes SET status = 'accepted', accepted_at = now() WHERE id = $1 RETURNING *`,
            [params.id]
          )).rows[0];
          return { quote: updated, eventOrder: null, payments: [] };
        }

        // Update quote status
        const updatedQuote = (await client.query(
          `UPDATE quotes SET status = 'accepted', accepted_at = now() WHERE id = $1 RETURNING *`,
          [params.id]
        )).rows[0];

        // Update event status + totals
        await client.query(
          `UPDATE events SET status = 'accepted', total_pvp = $2, total_cost = $3 WHERE id = $1`,
          [quoteRow.event_id, updatedQuote.total_pvp, updatedQuote.total_cost]
        );

        const guests = Number(quoteRow.guest_count) || 0;
        const pvpTotal = Number(updatedQuote.total_pvp) || 0;
        const costTotal = Number(updatedQuote.total_cost) || 0;
        const tablesSuggested = Math.max(1, Math.ceil(guests / 10));
        const waitersSuggested = Math.max(1, Math.ceil(guests / 15));

        // Get client_id from event
        const eventRow = (await client.query(
          `SELECT client_id FROM events WHERE id = $1`, [quoteRow.event_id]
        )).rows[0];

        // Create event_order
        const eventOrder = (await client.query(
          `INSERT INTO event_orders (event_id, quote_id, client_id, confirmed_price, status,
            tables_suggested, tables_confirmed, waiters_suggested, waiters_confirmed)
           VALUES ($1, $2, $3, $4, 'in_progress', $5, $5, $6, $6)
           RETURNING *`,
          [quoteRow.event_id, params.id, eventRow?.client_id || null, pvpTotal, tablesSuggested, waitersSuggested]
        )).rows[0];

        // Create payments: 40% deposit + 60% final
        const payments: any[] = [];

        // Deposit (40%, due in 7 days)
        const depositAmount = Math.round(pvpTotal * 0.4 * 100) / 100;
        const depositDue = new Date();
        depositDue.setDate(depositDue.getDate() + 7);
        const deposit = (await client.query(
          `INSERT INTO payments (event_id, concept, amount, due_date, paid)
           VALUES ($1, 'Señal (40% del presupuesto)', $2, $3::date, false)
           RETURNING *`,
          [quoteRow.event_id, depositAmount, depositDue.toISOString().split('T')[0]]
        )).rows[0];
        payments.push(deposit);

        // Final payment (60%, due on event date)
        const finalAmount = Math.round(pvpTotal * 0.6 * 100) / 100;
        const eventDateStr = quoteRow.event_date
          ? new Date(quoteRow.event_date).toISOString().split('T')[0]
          : depositDue.toISOString().split('T')[0];
        const finalPayment = (await client.query(
          `INSERT INTO payments (event_id, concept, amount, due_date, paid)
           VALUES ($1, 'Saldo (60% del presupuesto)', $2, $3::date, false)
           RETURNING *`,
          [quoteRow.event_id, finalAmount, eventDateStr]
        )).rows[0];
        payments.push(finalPayment);

        // Update lead status
        const leadId = quoteRow.lead_id;
        if (leadId) {
          await client.query(
            `UPDATE leads SET status = 'presupuestado' WHERE id = $1`,
            [leadId]
          );
        }

        return { quote: updatedQuote, eventOrder, payments };
      });

      return NextResponse.json({ data: result.quote, eventOrder: result.eventOrder, payments: result.payments });
    }

    // Non-accepting update: just update the quote
    const quote = await querySingle<any>(
      `UPDATE quotes SET
        base_pvp = COALESCE($1, base_pvp),
        bar_price = COALESCE($2, bar_price),
        extras_pvp = COALESCE($3, extras_pvp),
        extras_cost = COALESCE($4, extras_cost),
        iva_pct = COALESCE($5, iva_pct),
        status = COALESCE($6, status),
        notes = COALESCE($7, notes),
        sent_at = CASE WHEN $6 = 'sent' AND sent_at IS NULL THEN now() ELSE sent_at END,
        accepted_at = CASE WHEN $6 = 'accepted' AND accepted_at IS NULL THEN now() ELSE accepted_at END
       WHERE id = $8 RETURNING *`,
      [base_pvp ?? null, bar_price ?? null, extras_pvp ?? null, extras_cost ?? null,
       iva_pct ?? null, status || null, notes !== undefined ? notes : null, params.id]
    );
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    return NextResponse.json({ data: quote });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
