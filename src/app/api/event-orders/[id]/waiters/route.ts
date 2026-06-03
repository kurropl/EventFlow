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
    
    const rows = await queryMany<any>(
      `SELECT id, role, quantity, hourly_cost
       FROM staff_assignments
       WHERE event_order_id = $1 AND role = 'camarero'`,
      [orderId]
    );

    // If no staff assigned, generate default waiters based on order
    let waiters = rows.map(r => ({
      id: r.id,
      name: `Camarero ${r.id.slice(0, 4)}`,
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