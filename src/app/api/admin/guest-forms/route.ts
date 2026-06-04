/**
 * EventFlow — Guest Forms Admin API
 * GET /api/admin/guest-forms?event_id= — Get guest form data for an event
 * GET /api/admin/guest-forms — Get all guest forms
 * PATCH /api/admin/guest-forms/:id — Admin can add/edit guests (merge with form data)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (eventId) {
      // Get guest form data for specific event
      const form = await querySingle<any>(
        `SELECT gf.*, e.client_name, e.event_date, e.event_type, e.guest_count, e.kids_count, e.client_token
         FROM guest_forms gf
         JOIN events e ON e.id = gf.event_id
         WHERE gf.event_id = $1
         ORDER BY gf.updated_at DESC
         LIMIT 1`,
        [eventId]
      );
      return NextResponse.json({ success: true, data: form || { guests: [], client_name: '', email: '' } });
    }

    // Get all guest forms
    const forms = await queryMany<any>(
      `SELECT gf.*, e.client_name, e.event_date, e.event_type, e.guest_count, e.kids_count, e.client_token
       FROM guest_forms gf
       JOIN events e ON e.id = gf.event_id
       ORDER BY gf.updated_at DESC`
    );
    return NextResponse.json({ success: true, data: forms });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const eventId = body.event_id;
    const guests = Array.isArray(body.guests) ? body.guests : [];

    if (!eventId) {
      return NextResponse.json({ success: false, error: 'event_id es obligatorio' }, { status: 422 });
    }

    // Upsert: find existing form or create new
    const existing = await querySingle<any>(
      `SELECT id FROM guest_forms WHERE event_id = $1`,
      [eventId]
    );

    if (existing) {
      const updated = await querySingle<any>(
        `UPDATE guest_forms
         SET guests = $2, updated_at = now()
         WHERE event_id = $1
         RETURNING *`,
        [eventId, JSON.stringify(guests)]
      );
      return NextResponse.json({ success: true, data: updated });
    } else {
      const created = await querySingle<any>(
        `INSERT INTO guest_forms (event_id, guests)
         VALUES ($1, $2)
         RETURNING *`,
        [eventId, JSON.stringify(guests)]
      );
      return NextResponse.json({ success: true, data: created }, { status: 201 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
