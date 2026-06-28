/**
 * EventFlow — Public Quote Reject
 * POST /api/quotes/public/[id]/reject
 * Rejects a quote from the public page (no auth). Mirrors accept/route.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { setEventStatus } from '@/lib/domain/eventState';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    const quote = await querySingle<any>(`SELECT id, status, event_id, lead_id FROM quotes WHERE id = $1`, [id]);
    if (!quote) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }
    if (quote.status !== 'sent') {
      return NextResponse.json({ success: false, error: 'Este presupuesto no esta disponible para rechazar' }, { status: 400 });
    }

    const updatedQuote = await querySingle<any>(
      `UPDATE quotes SET status = 'rejected' WHERE id = $1 RETURNING *`,
      [id]
    );

    // Espejo de events.status (R3, única vía: domain/eventState). INV-1: sent → lost.
    await setEventStatus(quote.event_id, 'lost', { extraWhereSql: `AND status = 'sent'` });

    if (quote.lead_id) {
      await querySingle(
        `UPDATE leads SET status = 'perdido', updated_at = NOW() WHERE id = $1`,
        [quote.lead_id]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Presupuesto rechazado correctamente',
      data: { status: updatedQuote.status },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
