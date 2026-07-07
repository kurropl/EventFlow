/**
 * POST /api/event-flow/[eventId]/calculate — Cálculos automáticos
 *
 * Calcula mesas y camareros vía src/lib/operations.ts (fuente única, FR-A05)
 * y actualiza event_orders con los valores.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { calcMesas, calcCamareros, calcMesasInfantiles, type ServiceType } from '@/lib/operations';
import { getOperationRatios } from '@/lib/domain/operationRatios';
import { upsertEventOrderStaffing } from '@/lib/domain/upsertEventOrderStaffing';
import { upsertStaffingLines } from '@/lib/domain/staffingSizing';

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
    const kidsCount = Number((ev.rows[0] as any).kids_count) || 0;
    const adultCount = Math.max(1, guestCount - kidsCount);
    const serviceType: ServiceType = (ev.rows[0] as any).service_type === 'coctel' ? 'coctel' : 'menu';
    const ratios = await getOperationRatios();
    const adultTables = calcMesas(adultCount, ratios);
    const kidsTables = calcMesasInfantiles(kidsCount, ratios);
    const tablesNeeded = adultTables + kidsTables;
    const waitersNeeded = calcCamareros(guestCount, serviceType, ratios);

    await upsertEventOrderStaffing(getPool(), {
      eventId,
      tablesSuggested: tablesNeeded,
      waitersSuggested: waitersNeeded,
    });

    // G10 (Sprint 4): fuente única — antes solo regeneraba 'camarero' (con un
    // ON CONFLICT DO NOTHING que nunca podía disparar, así que cada llamada
    // insertaba una fila duplicada) y dejaba cocinero/metre obsoletos.
    await upsertStaffingLines(getPool(), eventId, guestCount, serviceType, ratios);

    return NextResponse.json({
      success: true,
      data: {
        guest_count: guestCount,
        kids_count: kidsCount,
        adult_tables: adultTables,
        kids_tables: kidsTables,
        tables_needed: tablesNeeded,
        waiters_needed: waitersNeeded,
        capacity_used: Math.round((guestCount / (tablesNeeded * 10)) * 100),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
