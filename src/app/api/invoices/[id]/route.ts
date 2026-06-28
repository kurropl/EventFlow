/**
 * EventFlow — Single Invoice API
 * GET /api/invoices/[id] — Get invoice details
 * PUT /api/invoices/[id] — Update invoice (status, payments)
 * POST /api/invoices/[id]/pay — Register a payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { setEventStatus } from '@/lib/domain/eventState';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const invoice = await querySingle<any>(
      `SELECT i.*, e.client_name, e.client_email, e.client_phone, e.event_type, e.event_date,
        e.guest_count, e.kids_count, e.bar_hours, e.bar_price, e.iva_pct, e.selected_items,
        eo.extra_consumptions, eo.confirmed_price, eo.final_price,
        c.fiscal_name, c.fiscal_nif, c.fiscal_address
       FROM invoices i
       JOIN events e ON e.id = i.event_id
       JOIN event_orders eo ON eo.id = i.event_order_id
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.id = $1`, [params.id]
    );
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // Get payments
    const payments = await queryMany<any>(
      `SELECT * FROM payments WHERE event_id = $1 ORDER BY created_at DESC`,
      [invoice.event_id]
    );
    invoice.payments = payments || [];

    return NextResponse.json({ data: invoice });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { status, notes } = body;

    const invoice = await querySingle<any>(
      `UPDATE invoices SET
        status = COALESCE($1, status),
        paid_at = CASE WHEN $1 = 'paid' AND paid_at IS NULL THEN now() ELSE paid_at END,
        notes = COALESCE($2, notes)
       WHERE id = $3 RETURNING *`,
      [status || null, notes !== undefined ? notes : null, params.id]
    );
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // If paid, also update event status to 'paid'
    if (status === 'paid') {
      await setEventStatus(invoice.event_id, 'paid');
    }

    return NextResponse.json({ data: invoice });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
