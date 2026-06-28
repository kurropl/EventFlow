/**
 * EventFlow — Public Quote API (no auth required)
 * GET /api/quotes/public/[id]
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Validate UUID format to avoid PG cast errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    const quote = await querySingle<any>(
      `SELECT q.*,
        json_build_object(
          'client_name', e.client_name,
          'client_email', e.client_email,
          'event_type', e.event_type,
          'event_date', e.event_date,
          'guest_count', e.guest_count,
          'selected_items', e.selected_items
        ) AS event
      FROM quotes q
      JOIN events e ON e.id = q.event_id
      WHERE q.id = $1`,
      [id]
    );

    if (!quote) {
      return NextResponse.json({ success: false, error: 'Presupuesto no encontrado' }, { status: 404 });
    }

    // AC4.4: señal/saldo (40/60) y estado de pago, visibles tras la aceptación.
    const payments = await queryMany<any>(
      `SELECT concept, amount, paid, paid_date, due_date FROM payments WHERE event_id = $1 ORDER BY due_date ASC`,
      [quote.event_id]
    );

    return NextResponse.json({ success: true, data: { ...quote, payments } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
