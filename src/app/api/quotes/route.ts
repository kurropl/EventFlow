/**
 * EventFlow — Quotes API
 * GET  /api/quotes?event_id=xxx — List quotes for an event
 * POST /api/quotes             — Create quote from event
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { z } from 'zod';

// ── Types ───────────────────────────────────────────────────────

interface Quote {
  id: string;
  event_id: string;
  lead_id: string | null;
  status: string;
  base_pvp: number;
  base_cost: number;
  bar_price: number;
  iva_pct: number;
  total_pvp: number | null;
  total_cost: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  client_name?: string;
  client_email?: string;
  event_date?: string;
  guest_count?: number;
  kids_count?: number;
  event_type?: string;
}

interface EventRow {
  id: string;
  total_pvp: number | null;
  total_cost: number | null;
  bar_price: number | null;
  iva_pct: number | null;
}

// ── Validation ──────────────────────────────────────────────────

const CreateQuoteSchema = z.object({
  event_id: z.string().uuid('event_id must be a valid UUID'),
  lead_id: z.string().uuid('lead_id must be a valid UUID').optional().nullable(),
  base_pvp: z.number().min(0, 'base_pvp must be >= 0').optional(),
  base_cost: z.number().min(0, 'base_cost must be >= 0').optional(),
  bar_price: z.number().min(0).optional(),
  iva_pct: z.number().min(0).max(100).optional(),
});

// ── Handlers ────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const leadId = searchParams.get('lead_id');

    // G13 (Sprint 4): assigned_to derivado por join (fuente única en leads).
    let sql = `SELECT q.*, e.client_name, e.client_email, e.event_date,
      e.guest_count, e.kids_count, e.event_type,
      l.assigned_to, a.name AS assigned_to_name
      FROM quotes q JOIN events e ON e.id = q.event_id
      LEFT JOIN leads l ON l.id = q.lead_id
      LEFT JOIN admins a ON a.id = l.assigned_to`;
    const params: string[] = [];
    const conds: string[] = [];

    if (eventId) { conds.push(`q.event_id = $${params.length + 1}`); params.push(eventId); }
    if (leadId) { conds.push(`q.lead_id = $${params.length + 1}`); params.push(leadId); }

    if (conds.length) sql += ` WHERE ${conds.join(' AND ')}`;
    sql += ` ORDER BY q.created_at DESC`;

    const rows = await queryMany<Quote>(sql, params);
    return NextResponse.json({ data: rows });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateQuoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 400 }
      );
    }

    const { event_id, base_pvp, base_cost, bar_price, iva_pct, lead_id } = parsed.data;

    // Get event data to auto-fill pricing
    const event = await querySingle<EventRow>(`SELECT * FROM events WHERE id = $1`, [event_id]);
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const quote = await querySingle<Quote>(
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

    // NOTE: Event stays 'draft' until FWD-2 transition is explicitly triggered.
    // The old code auto-set status='sent' on quote creation, bypassing the state machine.

    return NextResponse.json({ success: true, data: quote }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
