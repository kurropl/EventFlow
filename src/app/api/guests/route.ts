/**
 * EventFlow — Guests (Invitados) API
 * GET  /api/guests?event_id= — List guests for an event
 * POST /api/guests — Add a guest
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

const RSVP = ['pendiente', 'confirmado', 'rechazado'];
const MENU = ['adulto', 'nino', 'bebe'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'event_id es obligatorio' }, { status: 422 });
    }
    const rows = await queryMany<any>(
      `SELECT * FROM guests WHERE event_id = $1 ORDER BY group_name NULLS LAST, name ASC`,
      [eventId]
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.event_id) {
      return NextResponse.json({ success: false, error: 'event_id es obligatorio' }, { status: 422 });
    }
    const name = (body.name ?? '').trim();
    if (!name) {
      return NextResponse.json({ success: false, error: 'El nombre es obligatorio' }, { status: 422 });
    }
    const rsvp = RSVP.includes(body.rsvp) ? body.rsvp : 'pendiente';
    const menu = MENU.includes(body.menu_type) ? body.menu_type : 'adulto';
    const dietary = Array.isArray(body.dietary) ? body.dietary : [];
    const created = await querySingle<any>(
      `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [body.event_id, name, body.group_name || null, rsvp, menu, JSON.stringify(dietary), body.notes ?? null]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
