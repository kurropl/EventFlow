/**
 * EventFlow — Public Guest Form API
 * GET  /api/guest-forms?event_token= — Get event info for public form
 * POST /api/guest-forms — Save guest form submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, querySingleWithDefault } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventToken = searchParams.get('event_token');
    if (!eventToken) {
      return NextResponse.json({ success: false, error: 'event_token es obligatorio' }, { status: 422 });
    }

    // Fetch event by client_token
    const event = await querySingle<any>(
      `SELECT id, client_name, event_date, event_type, guest_count, kids_count, status
       FROM events WHERE client_token = $1`,
      [eventToken]
    );

    if (!event) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }

    // Fetch existing form submission
    const form = await querySingle<any>(
      `SELECT * FROM guest_forms WHERE event_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [event.id]
    );

    return NextResponse.json({ success: true, data: { event, form: form || { guests: [] } } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventToken = body.event_token;
    if (!eventToken) {
      return NextResponse.json({ success: false, error: 'event_token es obligatorio' }, { status: 422 });
    }

    // Find event by token
    const event = await querySingle<any>(
      `SELECT id, client_name, status FROM events WHERE client_token = $1`,
      [eventToken]
    );

    if (!event) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }

    if (event.status !== 'accepted') {
      return NextResponse.json({ success: false, error: 'Este evento aún no está confirmado' }, { status: 403 });
    }

    const clientName = (body.client_name || '').trim();
    const email = (body.email || '').trim();
    const guests = Array.isArray(body.guests) ? body.guests : [];

    if (!clientName) {
      return NextResponse.json({ success: false, error: 'El nombre del cliente es obligatorio' }, { status: 422 });
    }

    // Upsert: find existing form or create new
    const existing = await querySingle<any>(
      `SELECT id FROM guest_forms WHERE event_id = $1`,
      [event.id]
    );

    if (existing) {
      const updated = await querySingle<any>(
        `UPDATE guest_forms
         SET client_name = $2, email = $3, guests = $4, updated_at = now()
         WHERE event_id = $1
         RETURNING *`,
        [event.id, clientName, email, JSON.stringify(guests)]
      );
      return NextResponse.json({ success: true, data: updated });
    } else {
      const created = await querySingle<any>(
        `INSERT INTO guest_forms (event_id, client_name, email, guests)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [event.id, clientName, email, JSON.stringify(guests)]
      );
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
