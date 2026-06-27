/**
 * GET /api/event-orders/[id]/waiters
 * Returns the waiters assigned to this event order.
 */
import { NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    // Camareros confirmados para el evento de este pedido. El modelo actual es
    // staffing_lines (por evento + rol) → staffing_assignments → workers;
    // la antigua tabla staff_assignments fue eliminada (ver schema.sql §23).
    const rows = await queryMany<any>(
      `SELECT sa.id, sl.role, w.name
       FROM event_orders eo
       JOIN staffing_lines sl ON sl.event_id = eo.event_id AND sl.role = 'camarero'
       JOIN staffing_assignments sa ON sa.staffing_line_id = sl.id
       JOIN workers w ON w.id = sa.worker_id
       WHERE eo.id = $1`,
      [orderId]
    );

    // If no staff assigned, generate default waiters based on order
    let waiters = rows.map(r => ({
      id: r.id,
      name: r.name || `Camarero ${r.id.slice(0, 4)}`,
      role: r.role,
    }));

    if (waiters.length === 0) {
      // Get event order details to suggest waiters
      const order = await queryMany<any>(
        `SELECT waiters_suggested FROM event_orders WHERE id = $1`,
        [orderId]
      );
      const suggested = order.length > 0 ? order[0].waiters_suggested : 2;
      
      waiters = Array.from({ length: suggested }, (_, i) => ({
        id: `default-w${i + 1}`,
        name: `Camarero ${i + 1}`,
        role: 'camarero',
      }));
    }

    return NextResponse.json({ success: true, waiters });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}