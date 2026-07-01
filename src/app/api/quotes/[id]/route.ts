/**
 * EventFlow — Single Quote API
 * GET /api/quotes/[id]       — Get quote details
 * PUT /api/quotes/[id]       — Update quote (price, status)
 *                            When status → 'accepted': creates event_order + payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { isCancellation, canCancel, canEditOnlyPriceAndGuests, toPhase, PHASE_LABEL } from '@/lib/quoteWorkflow';
import { acceptQuote, AcceptQuoteError } from '@/lib/domain/acceptQuote';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const quote = await querySingle<any>(
      `SELECT q.*, e.*, e.id AS event_id, e.status AS event_status
       FROM quotes q JOIN events e ON e.id = q.event_id
       WHERE q.id = $1`, [params.id]
    );
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    return NextResponse.json({
      data: quote,
      workflow: {
        phase: toPhase(quote.status),
        phase_label: PHASE_LABEL[toPhase(quote.status)],
        can_cancel: canCancel(quote.status),                          // FR-A04
        edit_only_price_and_guests: canEditOnlyPriceAndGuests(quote.status), // FR-A02
      },
    });
  } catch (error) {
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { base_pvp, bar_price, extras_pvp, extras_cost, iva_pct, status, notes, cancel_reason } = body;

    // Reglas del workflow de presupuestos (FR-A03/A04).
    if (isCancellation(status)) {
      const current = await querySingle<any>(`SELECT status FROM quotes WHERE id = $1`, [params.id]);
      if (!current) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
      // FR-A04: un presupuesto aceptado no se cancela (se gestiona por incidencia/realizado).
      if (!canCancel(current.status)) {
        return NextResponse.json({ error: 'No se puede cancelar un presupuesto aceptado' }, { status: 400 });
      }
      // FR-A03: cancelar exige indicar motivo.
      if (!cancel_reason || !String(cancel_reason).trim()) {
        return NextResponse.json({ error: 'Debes indicar el motivo de la cancelación' }, { status: 400 });
      }
    }

    // When accepting: delegar en el dominio (única implementación, R1/D1).
    if (status === 'accepted') {
      try {
        const result = await acceptQuote(params.id);
        return NextResponse.json({
          success: true,
          data: result.quote,
          eventOrder: result.eventOrder,
          payments: result.payments,
          // G2: el aviso de faltante de stock (antes "stockWarnings" era una
          // funcionalidad muerta — quotes PUT nunca la devolvía pese a que
          // LeadsCRM.tsx y transitions::fwd3 ya la leían). Top-level, no
          // anidado bajo `data`, para que ambos consumidores existentes
          // sigan funcionando sin tocarlos.
          stockWarnings: result.stockWarnings,
        });
      } catch (err) {
        if (err instanceof AcceptQuoteError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // Non-accepting update: just update the quote
    const quote = await querySingle<any>(
      `UPDATE quotes SET
        base_pvp = COALESCE($1, base_pvp),
        bar_price = COALESCE($2, bar_price),
        extras_pvp = COALESCE($3, extras_pvp),
        extras_cost = COALESCE($4, extras_cost),
        iva_pct = COALESCE($5, iva_pct),
        status = COALESCE($6, status),
        notes = COALESCE($7, notes),
        cancel_reason = COALESCE($9, cancel_reason),
        sent_at = CASE WHEN $6 = 'sent' AND sent_at IS NULL THEN now() ELSE sent_at END,
        accepted_at = CASE WHEN $6 = 'accepted' AND accepted_at IS NULL THEN now() ELSE accepted_at END
       WHERE id = $8 RETURNING *`,
      [base_pvp ?? null, bar_price ?? null, extras_pvp ?? null, extras_cost ?? null,
       iva_pct ?? null, status || null, notes !== undefined ? notes : null, params.id,
       cancel_reason ?? null]
    );
    if (!quote) return NextResponse.json({ error: 'Quote not found' }, { status: 404 });

    // Send email when quote is sent to client
    if (status === 'sent' && quote.total_pvp) {
      try {
        const event = await querySingle<any>(`SELECT client_name, client_email FROM events WHERE id = $1`, [quote.event_id]);
        if (event?.client_email) {
          const { sendEmail, templates } = await import('@/lib/email');
          const validUntil = quote.valid_until ? new Date(quote.valid_until).toLocaleDateString('es-ES') : 'No especificada';
          const tpl = await templates.quoteSent(event.client_name, event.client_email, quote.id, Number(quote.total_pvp), validUntil);
          await sendEmail({ to: event.client_email, subject: tpl.subject, html: tpl.html });
        }
      } catch (e) {
        console.warn('[EMAIL] Failed to send quote email:', e);
      }
    }

    // S2.3: Auto-sync lead status ↔ quote status.
    // Relación real: quotes.lead_id → leads.id (events NO tiene lead_id).
    // 'accepted' se gestiona en acceptQuote() (delega arriba); aquí solo 'sent'.
    if (status === 'sent' && quote.lead_id) {
      try {
        await querySingle(
          `UPDATE leads SET status = 'presupuestado', updated_at = NOW() WHERE id = $1`,
          [quote.lead_id]
        );
      } catch (e) {
        console.warn('[SYNC] Failed to sync lead status:', e);
      }
    }

    return NextResponse.json({ data: quote });
  } catch (error) {
    console.error('[quotes PUT] error:', error);
    return NextResponse.json({ error: sanitizeError(error) }, { status: 500 });
  }
}
