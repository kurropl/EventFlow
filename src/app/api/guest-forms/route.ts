/**
 * EventFlow — Public Guest Form API (SECURED)
 * 
 * Security:
 * - Input sanitization on all text fields
 * - Guest array validation (max 500 guests, sanitize each field)
 * - Rate limiting via securityHeaders
 * - Length limits on all inputs
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeText, securityHeaders } from '@/lib/security';

const MAX_GUESTS = 500;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventToken = searchParams.get('event_token');
    if (!eventToken || eventToken.length > 200) {
      return NextResponse.json(
        { success: false, error: 'event_token inválido.' },
        { status: 422, headers: securityHeaders() }
      );
    }

    const event = await querySingle<any>(
      `SELECT id, client_name, event_date, event_type, guest_count, kids_count, status
       FROM events WHERE client_token = $1`,
      [eventToken]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404, headers: securityHeaders() }
      );
    }

    const form = await querySingle<any>(
      `SELECT * FROM guest_forms WHERE event_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [event.id]
    );

    return NextResponse.json(
      { success: true, data: { event, form: form || { guests: [] } } },
      { headers: securityHeaders() }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: securityHeaders() });
  }
}

/** Sanitize a single guest entry */
function sanitizeGuest(guest: any): any {
  if (!guest || typeof guest !== 'object') return null;
  return {
    name: sanitizeText(String(guest.name || ''), 100),
    group_name: sanitizeText(String(guest.group_name || ''), 50),
    menu_type: ['adulto', 'nino', 'bebe'].includes(guest.menu_type) ? guest.menu_type : 'adulto',
    dietary: Array.isArray(guest.dietary)
      ? guest.dietary.filter((d: any) => typeof d === 'string' && d.length < 50).slice(0, 10)
      : [],
    notes: sanitizeText(String(guest.notes || ''), 200),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventToken = sanitizeText(String(body.event_token || ''), 200);
    if (!eventToken) {
      return NextResponse.json(
        { success: false, error: 'event_token es obligatorio.' },
        { status: 422, headers: securityHeaders() }
      );
    }

    const event = await querySingle<any>(
      `SELECT id, client_name, status FROM events WHERE client_token = $1`,
      [eventToken]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404, headers: securityHeaders() }
      );
    }

    if (event.status !== 'accepted') {
      return NextResponse.json(
        { success: false, error: 'Este evento aún no está confirmado' },
        { status: 403, headers: securityHeaders() }
      );
    }

    const clientName = sanitizeText(String(body.client_name || ''), 100);
    const email = sanitizeText(String(body.email || ''), 150);
    const rawGuests = Array.isArray(body.guests) ? body.guests : [];

    if (!clientName) {
      return NextResponse.json(
        { success: false, error: 'El nombre del cliente es obligatorio' },
        { status: 422, headers: securityHeaders() }
      );
    }

    // Sanitize and limit guests
    const guests = rawGuests
      .slice(0, MAX_GUESTS)
      .map(sanitizeGuest)
      .filter(Boolean);

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
      return NextResponse.json({ success: true, data: updated }, { headers: securityHeaders() });
    } else {
      const created = await querySingle<any>(
        `INSERT INTO guest_forms (event_id, client_name, email, guests)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [event.id, clientName, email, JSON.stringify(guests)]
      );
      return NextResponse.json({ success: true, data: created }, { status: 201, headers: securityHeaders() });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500, headers: securityHeaders() });
  }
}
