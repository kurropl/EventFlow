/**
 * EventFlow — Confirm Event API
 * POST /api/events/[id]/confirm
 *
 * Acepta el presupuesto del evento (delegando en el dominio, idempotente)
 * y registra la señal como pagada (p.ej. cobrada por transferencia/efectivo
 * antes de que el cliente acepte online). Ya NO re-crea order/quote/status
 * de forma ad-hoc: ese fan-out vive única y exclusivamente en acceptQuote.
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, transaction } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { acceptQuote, AcceptQuoteError } from '@/lib/domain/acceptQuote';

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
    const method = body.method || null;
    const paidDate = body.paid_date || new Date().toISOString().slice(0, 10);

    const event = await querySingle<any>(`SELECT id FROM events WHERE id = $1`, [eventId]);
    if (!event) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }

    // 1) Asegurar quote + aceptación completa (idempotente vía acceptQuote).
    const quoteId = await transaction(async (client) => {
      const quote = (await client.query(
        `SELECT id FROM quotes WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [eventId]
      )).rows[0];
      if (quote) return quote.id;

      const ev = (await client.query(`SELECT total_pvp, total_cost, bar_price, iva_pct FROM events WHERE id = $1`, [eventId])).rows[0];
      const created = (await client.query(
        `INSERT INTO quotes (event_id, status, base_pvp, base_cost, total_pvp, total_cost, bar_price, iva_pct, sent_at)
         VALUES ($1, 'sent', $2, $3, $2, $3, $4, $5, now())
         RETURNING id`,
        [eventId, Number(ev.total_pvp) || 0, Number(ev.total_cost) || 0, Number(ev.bar_price) || 0, Number(ev.iva_pct) || 10]
      )).rows[0];
      return created.id;
    });

    let accepted;
    try {
      accepted = await acceptQuote(quoteId);
    } catch (err) {
      if (err instanceof AcceptQuoteError) {
        return NextResponse.json({ success: false, error: err.message }, { status: err.status });
      }
      throw err;
    }

    // 2) Registrar la señal (40%) como pagada — el pago ya existe (creado por
    // acceptQuote); aquí solo lo marcamos como cobrado. Idempotente.
    const depositConcept = 'Señal (40% del presupuesto)';
    const payment = await querySingle<any>(
      `UPDATE payments SET paid = true, paid_date = COALESCE(paid_date, $2::date), method = COALESCE(method, $3)
       WHERE event_id = $1 AND concept = $4
       RETURNING *`,
      [eventId, paidDate, method, depositConcept]
    );

    const guestLink = accepted.clientToken
      ? `${req.nextUrl.origin}/invitados/${accepted.clientToken}`
      : null;

    return NextResponse.json({
      success: true,
      data: { payment, guest_link: guestLink, client_token: accepted.clientToken },
      message: 'Evento confirmado. Señal registrada + enlace invitados activado.',
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
