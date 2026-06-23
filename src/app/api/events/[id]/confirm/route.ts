/**
 * EventFlow — Confirm Event API
 * POST /api/events/[id]/confirm
 *
 * Registra la señal como pagada, confirma el evento,
 * activa el enlace de invitados.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Get event + quote
    const evRes = await query(
      `SELECT e.*, q.id as quote_id, q.deposit_pct, q.deposit_amount, q.deposit_paid,
              q.total_pvp as quote_total, q.status as quote_status, q.lead_id
       FROM events e
       LEFT JOIN quotes q ON q.id = e.quote_id
       WHERE e.id = $1`,
      [eventId]
    );
    if (!evRes.rows?.[0]) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }
    const ev = evRes.rows[0] as any;

    // 1. Register signal payment
    const depositAmount = body.amount
      || Number(ev.deposit_amount)
      || (Number(ev.quote_total || 0) * Number(ev.deposit_pct || 40) / 100);

    const method = body.method || null;
    const paidDate = body.paid_date || new Date().toISOString().slice(0, 10);

    const payment = await querySingle(
      `INSERT INTO payments (event_id, concept, amount, paid, paid_date, method)
       VALUES ($1, $2, $3, true, $4, $5) RETURNING *`,
      [eventId, `Señal (${ev.deposit_pct || 40}%)`, depositAmount, paidDate, method]
    );

    // 2. Mark quote deposit as paid
    if (ev.quote_id) {
      await query(
        `UPDATE quotes SET deposit_paid = true, deposit_amount = $1 WHERE id = $2`,
        [depositAmount, ev.quote_id]
      );
    }

    // 3. Update event status
    await query(
      `UPDATE events SET status = 'accepted' WHERE id = $1 AND status NOT IN ('completed','paid','cancelled','lost')`,
      [eventId]
    );

    // 4. Update quote + lead
    if (ev.quote_id) {
      await query(
        `UPDATE quotes SET status = 'accepted', accepted_at = now() WHERE id = $1 AND status != 'accepted'`,
        [ev.quote_id]
      );
    }
    if (ev.lead_id) {
      await query(`UPDATE leads SET status = 'convertido' WHERE id = $1`, [ev.lead_id]);
    }

    // 5. Guest invitation link
    const guestLink = ev.client_token
      ? `${req.nextUrl.origin}/invitados/${ev.client_token}`
      : null;

    return NextResponse.json({
      success: true,
      data: { payment, deposit_amount: depositAmount, guest_link: guestLink, client_token: ev.client_token },
      message: 'Evento confirmado. Señal registrada + enlace invitados activado.',
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}