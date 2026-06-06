/**
 * EventFlow — Quotes API
 * GET  /api/quotes?event_id=xxx — List quotes for an event
 * POST /api/quotes             — Create quote from event
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const leadId = searchParams.get('lead_id');

    let sql = `SELECT q.*, e.client_name, e.client_email, e.event_date,
      e.guest_count, e.kids_count, e.event_type
      FROM quotes q JOIN events e ON e.id = q.event_id`;
    const params: any[] = [];
    const conds: string[] = [];

    if (eventId) { conds.push(`q.event_id = $${params.length + 1}`); params.push(eventId); }
    if (leadId) { conds.push(`q.lead_id = $${params.length + 1}`); params.push(leadId); }

    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY q.created_at DESC`;

    const rows = await queryMany<any>(sql, params);
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event_id, base_pvp, base_cost, bar_price, iva_pct, lead_id } = body;

    if (!event_id) return NextResponse.json({ error: 'event_id required' }, { status: 400 });

    // Get event data to auto-fill pricing
    const event = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [event_id]);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const quote = await querySingle<any>(
      `INSERT INTO quotes (event_id, lead_id, base_pvp, base_cost, bar_price, iva_pct)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        event_id,
        lead_id || null,
        base_pvp ?? event.total_pvp ?? 0,
        base_cost ?? event.total_cost ?? 0,
        bar_price ?? event.bar_price ?? 0,
        iva_pct ?? event.iva_pct ?? 10,
      ]
    );

    // Update event status to 'sent' when a quote is created
    await querySingle(`UPDATE events SET status = 'sent' WHERE id = $1`, [event_id]);

    return NextResponse.json({ data: quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
