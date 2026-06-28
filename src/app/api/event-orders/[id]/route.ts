/**
 * EventFlow — Single Event Order API
 * PUT /api/event-orders/[id] — Update order (status, tables, etc.)
 * POST /api/event-orders/[id]/complete — Mark as completed
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { setEventStatus } from '@/lib/domain/eventState';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const { tables_confirmed, waiters_confirmed, extra_consumptions, status, notes } = body;

    const order = await querySingle<any>(
      `UPDATE event_orders SET
        tables_confirmed = COALESCE($1, tables_confirmed),
        waiters_confirmed = COALESCE($2, waiters_confirmed),
        extra_consumptions = $3,
        status = COALESCE($4, status),
        notes = COALESCE($5, notes),
        completed_at = CASE WHEN $4 = 'completed' AND completed_at IS NULL THEN now() ELSE completed_at END
       WHERE id = $6 RETURNING *`,
      [
        tables_confirmed ?? null,
        waiters_confirmed ?? null,
        extra_consumptions !== undefined ? JSON.stringify(extra_consumptions) : null,
        status || null,
        notes !== undefined ? notes : null,
        params.id,
      ]
    );
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    // If completed, also update the event status
    if (status === 'completed') {
      await setEventStatus(order.event_id, 'completed');
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
