/**
 * EventFlow — Single Quote API
 * GET /api/quotes/[id]       — Get quote details
 * PUT /api/quotes/[id]       — Update quote (price, status)
 * POST /api/quotes/[id]/accept — Accept quote → create event_order + update client
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';

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
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { base_pvp, bar_price, extras_pvp, extras_cost, iva_pct, status, notes } = body;

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
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
