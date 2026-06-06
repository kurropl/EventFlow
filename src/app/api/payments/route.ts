/**
 * EventFlow — Payments (Cobros) API
 * GET  /api/payments?event_id= — List payments (optionally for one event), with event context
 * POST /api/payments — Create a payment / cobro line
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const params: any[] = [];
    let where = '';
    if (eventId) {
      params.push(eventId);
      where = `WHERE p.event_id = $1`;
    }
    const rows = await queryMany<any>(
      `SELECT p.*, e.client_name, e.event_date, e.event_type
       FROM payments p
       JOIN events e ON e.id = p.event_id
       ${where}
       ORDER BY p.paid ASC, p.due_date ASC NULLS LAST, p.created_at ASC`,
      params
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.event_id) {
      return NextResponse.json({ success: false, error: 'event_id es obligatorio' }, { status: 422 });
    }
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ success: false, error: 'Importe inválido' }, { status: 422 });
    }
    const created = await querySingle<any>(
      `INSERT INTO payments (event_id, concept, amount, due_date, paid, paid_date, method, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        body.event_id,
        (body.concept ?? 'Pago').trim() || 'Pago',
        amount,
        body.due_date || null,
        Boolean(body.paid),
        body.paid ? body.paid_date || new Date().toISOString().slice(0, 10) : null,
        body.method || null,
        body.notes ?? null,
      ]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
