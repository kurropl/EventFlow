/**
 * EventFlow — Invoices API
 * GET  /api/invoices — List invoices
 * POST /api/invoices — Generate invoice from completed event order
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `FE-${year}-${rand}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const eventOrderId = searchParams.get('event_order_id');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10);

    let sql = `SELECT i.*, e.client_name, e.client_email, e.event_type, e.event_date, e.guest_count,
      c.fiscal_name, c.fiscal_nif, c.fiscal_address
      FROM invoices i 
      JOIN events e ON e.id = i.event_id
      LEFT JOIN clients c ON c.id = i.client_id`;
    const params: any[] = [];
    const conds: string[] = [];

    if (status) { conds.push(`i.status = $${params.length + 1}`); params.push(status); }
    if (eventOrderId) { conds.push(`i.event_order_id = $${params.length + 1}`); params.push(eventOrderId); }

    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await queryMany<any>(sql, params);
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_order_id } = body;
    if (!event_order_id) return NextResponse.json({ error: 'event_order_id required' }, { status: 400 });

    // Get order with full data
    const order = await querySingle<any>(
      `SELECT eo.*, e.client_name, e.client_email, e.client_phone, e.event_type, e.event_date,
        e.guest_count, e.kids_count, e.bar_hours, e.bar_price, e.iva_pct, e.selected_items,
        c.fiscal_name, c.fiscal_nif, c.fiscal_address, c.id as client_id
       FROM event_orders eo
       JOIN events e ON e.id = eo.event_id
       LEFT JOIN clients c ON c.id = eo.client_id
       WHERE eo.id = $1`, [event_order_id]
    );
    if (!order) return NextResponse.json({ error: 'Event order not found' }, { status: 404 });
    if (!order.fiscal_nif) return NextResponse.json({ error: 'Client fiscal data missing. Complete the client fiscal info first.' }, { status: 400 });

    // Calculate invoice amounts
    const extrasTotal = (order.extra_consumptions || []).reduce((s: number, ex: any) => s + (ex.amount || 0), 0);
    const subtotal = Number(order.confirmed_price) || 0;
    const ivaPct = Number(order.iva_pct) || 10;
    const ivaAmount = Math.round((subtotal + extrasTotal) * ivaPct / 100 * 100) / 100;
    const total = subtotal + extrasTotal + ivaAmount;

    // Get client total payments
    const paymentsRes = await queryMany<any>(
      `SELECT COALESCE(SUM(amount), 0) as paid FROM payments WHERE event_id = $1 AND paid = true`,
      [order.event_id]
    );
    const paidTotal = Number(paymentsRes[0]?.paid || 0);

    // Generate invoice
    let invoiceNumber;
    let attempts = 0;
    do {
      invoiceNumber = generateInvoiceNumber();
      const existing = await querySingle(`SELECT id FROM invoices WHERE invoice_number = $1`, [invoiceNumber]);
      if (!existing) break;
      attempts++;
    } while (attempts < 5);

    const invoice = await querySingle<any>(
      `INSERT INTO invoices (event_order_id, event_id, client_id, invoice_number,
        fiscal_name, fiscal_nif, fiscal_address, subtotal, iva_pct, iva_amount, total,
        extras_pvp, payments_total, balance_due, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending')
       RETURNING *`,
      [
        event_order_id, order.event_id, order.client_id, invoiceNumber,
        order.fiscal_name, order.fiscal_nif, order.fiscal_address,
        subtotal, ivaPct, ivaAmount, total,
        extrasTotal, 0, total, // payments_total = 0 initially
      ]
    );

    // Update order status to completed (if not already)
    if (order.status !== 'completed') {
      await querySingle(`UPDATE event_orders SET status = 'completed', completed_at = now() WHERE id = $1`, [event_order_id]);
    }

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
