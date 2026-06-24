/**
 * EventFlow — Event Orders API
 * GET  /api/event-orders — List or get by event_id
 * POST /api/event-orders — Create event order from accepted quote
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const status = searchParams.get('status');

    let sql = `SELECT DISTINCT ON (e.id)
      COALESCE(eo.id, gen_random_uuid()) as id,
      e.id as event_id, e.client_name, e.client_email, e.event_type,
      e.guest_count, e.kids_count, e.event_date, e.selected_items, e.client_token, e.service_type,
      c.name as client_name_fiscal, c.fiscal_nif,
      eo.confirmed_price, COALESCE(eo.status, e.status) as status,
      eo.tables_suggested, eo.waiters_suggested, eo.created_at
      FROM events e
      LEFT JOIN event_orders eo ON eo.event_id = e.id
      LEFT JOIN clients c ON c.id = eo.client_id
      LEFT JOIN staffing_lines sl ON sl.event_id = e.id
      WHERE (e.status != 'cancelled' AND e.status != 'draft')
      OR sl.id IS NOT NULL`;
    const params: any[] = [];
    const conds: string[] = [];

    if (eventId) { conds.push(`e.id = $${params.length + 1}`); params.push(eventId); }
    if (status) { conds.push(`COALESCE(eo.status, e.status) = $${params.length + 1}`); params.push(status); }

    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY e.id, e.event_date DESC NULLS LAST`;

    const rows = await queryMany<any>(sql, params);

    // Fetch shopping list for each order (only for real event_orders)
    for (const row of rows) {
      if (row.confirmed_price != null) {
        try {
          const shop = await queryMany<any>(`SELECT * FROM shopping_list WHERE order_id = $1`, [row.id]);
          row.shopping_list = shop || [];
        } catch { row.shopping_list = []; }
      } else {
        row.shopping_list = [];
      }
    }

    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { quote_id, client_id } = body;
    if (!quote_id) return NextResponse.json({ error: 'quote_id required' }, { status: 400 });

    // Get the quote with event data
    const quote = await querySingle<any>(
      `SELECT q.*, e.id as eid, e.guest_count, e.kids_count
       FROM quotes q JOIN events e ON e.id = q.event_id WHERE q.id = $1`,
      [quote_id]
    );
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    // Auto-calculate tables and waiters
    const guests = quote.guest_count || 1;
    const tables_suggested = Math.ceil(guests / 8);
    const waiters_suggested = Math.max(1, Math.round(guests / 12));

    const order = await querySingle<any>(
      `INSERT INTO event_orders (event_id, quote_id, client_id, confirmed_price, status, tables_suggested, waiters_suggested)
       VALUES ($1, $2, $3, $4, 'in_progress', $5, $6) RETURNING *`,
      [quote.eid, quote_id, client_id || null, quote.total_pvp, tables_suggested, waiters_suggested]
    );

    // Update event status to in_progress
    await querySingle(`UPDATE events SET status = 'in_progress' WHERE id = $1`, [quote.eid]);

    // Update quote status to accepted
    await querySingle(`UPDATE quotes SET status = 'accepted', accepted_at = now() WHERE id = $1`, [quote_id]);

    return NextResponse.json({ data: order }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
