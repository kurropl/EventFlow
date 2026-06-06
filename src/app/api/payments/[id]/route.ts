/**
 * EventFlow — Payment by ID API
 * PATCH  /api/payments/[id] — Update / mark paid
 * DELETE /api/payments/[id] — Remove a payment line
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

/**
 * When a payment is marked as paid, check if this event has an associated lead
 * that hasn't been converted yet. If so, convert the lead to a client automatically.
 */
async function autoConvertLeadToClient(payment: any) {
  try {
    // Get the event linked to this payment
    const event = await querySingle<any>(
      `SELECT id, client_name, client_email, client_phone, status FROM events WHERE id = $1`,
      [payment.event_id]
    );
    if (!event) return;

    // Find the lead linked to this event
    const lead = await querySingle<any>(
      `SELECT id, name, email, phone, status, converted_to_client_id FROM leads
       WHERE email = $1 AND status = 'nuevo' AND converted_to_client_id IS NULL
       LIMIT 1`,
      [event.client_email || '']
    );
    if (!lead) return;

    // Check if a client already exists for this lead
    const existingClient = await querySingle<any>(
      `SELECT id FROM clients WHERE lead_id = $1`,
      [lead.id]
    );
    if (existingClient) return;

    // Auto-convert: create a client record from the lead's data
    const client = await querySingle<any>(
      `INSERT INTO clients (name, email, phone, lead_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [lead.name, lead.email, event.client_phone || lead.phone, lead.id]
    );

    // Update lead status to converted
    await querySingle(
      `UPDATE leads SET status = 'convertido', converted_to_client_id = $1 WHERE id = $2`,
      [client.id, lead.id]
    );

    // Link the event to the client
    await querySingle(
      `UPDATE events SET client_id = $1 WHERE id = $2`,
      [client.id, event.id]
    );

    console.log(`[lead→client] Auto-converted lead ${lead.id} → client ${client.id} on payment for event ${event.id}`);
  } catch (e) {
    console.error('[lead→client] Auto-convert failed:', e);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const fields: string[] = [];
    const values: any[] = [];
    const allowed: Record<string, (v: any) => any> = {
      concept: (v) => String(v),
      amount: (v) => Number(v),
      due_date: (v) => v || null,
      paid: (v) => Boolean(v),
      paid_date: (v) => v || null,
      method: (v) => v || null,
      notes: (v) => v ?? null,
      receipt_url: (v) => String(v),
    };
    for (const [key, transform] of Object.entries(allowed)) {
      if (key in body) {
        fields.push(`${key} = $${fields.length + 1}`);
        values.push(transform(body[key]));
      }
    }
    // Auto-stamp paid_date when marking paid without an explicit date
    if (body.paid === true && !('paid_date' in body)) {
      fields.push(`paid_date = $${fields.length + 1}`);
      values.push(new Date().toISOString().slice(0, 10));
    }
    if (body.paid === false && !('paid_date' in body)) {
      fields.push(`paid_date = NULL`);
    }
    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 422 });
    }
    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE payments SET ${fields.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 });
    }

    // AUTO-CONVERT lead to client on first payment
    if (body.paid === true && updated.paid === true) {
      await autoConvertLeadToClient(updated);
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await querySingle<any>(`DELETE FROM payments WHERE id = $1 RETURNING id`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
