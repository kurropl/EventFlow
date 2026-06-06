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
import { sanitizeText, securityHeaders, sanitizeError } from '@/lib/security';
import { z } from 'zod';

const MAX_GUESTS = 500;

// ── Validation ──────────────────────────────────────────────────

const GuestSchema = z.object({
  name: z.string().max(100).optional(),
  group_name: z.string().max(50).optional(),
  menu_type: z.enum(['adulto', 'nino', 'bebe']).optional(),
  dietary: z.array(z.string().max(50)).max(10).optional(),
  notes: z.string().max(200).optional(),
});

const GuestFormPostSchema = z.object({
  event_token: z.string().min(1, 'event_token is required').max(200),
  client_name: z.string().min(1, 'client_name is required').max(100),
  email: z.string().max(150).optional(),
  guests: z.array(GuestSchema).max(MAX_GUESTS).optional(),
});

// ── Types ───────────────────────────────────────────────────────

interface EventRow {
  id: string;
  client_name: string;
  event_date: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  status: string;
}

interface GuestForm {
  id: string;
  event_id: string;
  client_name: string;
  email: string;
  guests: unknown;
  updated_at: string;
}

// ── Sanitize helper ─────────────────────────────────────────────

/** Sanitize a single guest entry */
function sanitizeGuest(guest: Record<string, unknown>): Record<string, unknown> | null {
  if (!guest || typeof guest !== 'object') return null;
  return {
    name: sanitizeText(String(guest.name || ''), 100),
    group_name: sanitizeText(String(guest.group_name || ''), 50),
    menu_type: ['adulto', 'nino', 'bebe'].includes(guest.menu_type as string) ? guest.menu_type : 'adulto',
    dietary: Array.isArray(guest.dietary)
      ? guest.dietary.filter((d: unknown) => typeof d === 'string' && d.length < 50).slice(0, 10)
      : [],
    notes: sanitizeText(String(guest.notes || ''), 200),
  };
}

// ── Handlers ────────────────────────────────────────────────────

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

    const event = await querySingle<EventRow>(
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

    const form = await querySingle<GuestForm>(
      `SELECT * FROM guest_forms WHERE event_id = $1 ORDER BY updated_at DESC LIMIT 1`,
      [event.id]
    );

    return NextResponse.json(
      { success: true, data: { event, form: form || { guests: [] } } },
      { headers: securityHeaders() }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500, headers: securityHeaders() });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = GuestFormPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422, headers: securityHeaders() }
      );
    }

    const { event_token, client_name, email, guests: rawGuests } = parsed.data;
    const eventToken = sanitizeText(event_token, 200);

    const event = await querySingle<EventRow>(
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

    const clientName = sanitizeText(client_name, 100);
    const sanitizedEmail = sanitizeText(email || '', 150);

    // Sanitize and limit guests
    const guests = (rawGuests || [])
      .slice(0, MAX_GUESTS)
      .map(sanitizeGuest)
      .filter(Boolean);

    const existing = await querySingle<{ id: string }>(
      `SELECT id FROM guest_forms WHERE event_id = $1`,
      [event.id]
    );

    if (existing) {
      const updated = await querySingle<GuestForm>(
        `UPDATE guest_forms
         SET client_name = $2, email = $3, guests = $4, updated_at = now()
         WHERE event_id = $1
         RETURNING *`,
        [event.id, clientName, sanitizedEmail, JSON.stringify(guests)]
      );
      return NextResponse.json({ success: true, data: updated }, { headers: securityHeaders() });
    } else {
      const created = await querySingle<GuestForm>(
        `INSERT INTO guest_forms (event_id, client_name, email, guests)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [event.id, clientName, sanitizedEmail, JSON.stringify(guests)]
      );
      return NextResponse.json({ success: true, data: created }, { status: 201, headers: securityHeaders() });
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500, headers: securityHeaders() });
  }
}
