/**
 * POST /api/event-flow/[eventId]/calculate — Cálculos automáticos
 *
 * Calcula mesas y camareros vía src/lib/operations.ts (fuente única, FR-A05)
 * y actualiza event_orders con los valores.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { calcMesas, calcCamareros, type ServiceType } from '@/lib/operations';
import { upsertEventOrderStaffing } from '@/lib/domain/upsertEventOrderStaffing';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;

    // Get event data
    const ev = await query(`SELECT * FROM events WHERE id = $1`, [eventId]);
    if (!ev.rows?.[0]) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }

    const guestCount = Number((ev.rows[0] as any).guest_count) || 1;
    const serviceType: ServiceType = (ev.rows[0] as any).service_type === 'coctel' ? 'coctel' : 'menu';
    const tablesNeeded = calcMesas(guestCount);
    const waitersNeeded = calcCamareros(guestCount, serviceType);

    await upsertEventOrderStaffing(getPool(), {
      eventId,
      tablesSuggested: tablesNeeded,
      waitersSuggested: waitersNeeded,
      guestCount,
    });

    // Auto-create staffing lines for waiters
    await query(
      `INSERT INTO staffing_lines (event_id, role, slots_needed, status)
       VALUES ($1, 'camarero', $2, 'open')
       ON CONFLICT DO NOTHING`,
      [eventId, waitersNeeded]
    );

    return NextResponse.json({
      success: true,
      data: {
        guest_count: guestCount,
        tables_needed: tablesNeeded,
        waiters_needed: waitersNeeded,
        capacity_used: Math.round((guestCount / (tablesNeeded * 10)) * 100),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
