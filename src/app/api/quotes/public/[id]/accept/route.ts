/**
 * EventFlow — Public Quote Accept
 * POST /api/quotes/public/[id]/accept
 * Accepts a quote from the public page (no auth).
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    // Get quote
    const quote = await querySingle<any>(
      `SELECT q.*, e.id AS event_id, e.client_name, e.client_email, e.event_type
      FROM quotes q
      JOIN events e ON e.id = q.event_id
      WHERE q.id = $1`,
      [id]
    );

    if (!quote) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    // Validate: can only accept 'sent' quotes
    if (quote.status !== 'sent') {
      return NextResponse.json({ success: false, error: 'Este presupuesto no esta disponible para aceptar' }, { status: 400 });
    }

    // Validate: not expired
    if (quote.valid_until && new Date(quote.valid_until) < new Date()) {
      return NextResponse.json({ success: false, error: 'Este presupuesto ha expirado' }, { status: 400 });
    }

    // Accept the quote
    await querySingle(
      `UPDATE quotes SET status = 'accepted', accepted_at = NOW() WHERE id = $1`,
      [id]
    );

    // Update event status
    await querySingle(
      `UPDATE events SET status = 'accepted' WHERE id = $1`,
      [quote.event_id]
    );

    // Sync lead status (S2.3)
    try {
      const event = await querySingle<any>(`SELECT lead_id FROM events WHERE id = $1`, [quote.event_id]);
      if (event?.lead_id) {
        await querySingle(
          `UPDATE leads SET status = 'confirmado', updated_at = NOW() WHERE id = $1`,
          [event.lead_id]
        );
      }
    } catch {}

    return NextResponse.json({ success: true, message: 'Presupuesto aceptado correctamente' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
