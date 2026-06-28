/**
 * EventFlow — Public Quote Accept
 * POST /api/quotes/public/[id]/accept
 * Accepts a quote from the public page (no auth).
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { acceptQuote, AcceptQuoteError } from '@/lib/domain/acceptQuote';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    const quote = await querySingle<any>(`SELECT id, status FROM quotes WHERE id = $1`, [id]);
    if (!quote) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }
    if (quote.status !== 'sent') {
      return NextResponse.json({ success: false, error: 'Este presupuesto no esta disponible para aceptar' }, { status: 400 });
    }

    const result = await acceptQuote(id);

    return NextResponse.json({
      success: true,
      message: 'Presupuesto aceptado correctamente',
      data: { client_token: result.clientToken },
    });
  } catch (error) {
    if (error instanceof AcceptQuoteError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
