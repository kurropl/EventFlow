/**
 * GET /api/rentabilidad — Dashboard de rentabilidad por evento
 *
 * Calcula margen bruto, ingresos, costes y desglose por evento.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(_req: NextRequest) {
  try {
    // Eventos con datos financieros
    const eventsResult = await query(
      `SELECT e.id, e.client_name, e.event_date, e.guest_count, e.status, e.event_type,
              e.total_pvp, e.total_cost, e.bar_price, e.bar_hours, e.iva_pct,
              e.created_at, e.notes
       FROM events e
       WHERE e.total_pvp > 0 OR e.total_cost > 0
       ORDER BY e.event_date DESC`
    );

    const events = await Promise.all(
      (eventsResult.rows || []).map(async (row: any) => {
        const eventId = row.id;

        // Pagos recibidos
        const paymentsResult = await query(
          `SELECT COALESCE(SUM(amount), 0) as total_paid,
                  COUNT(*) as payment_count,
                  COUNT(*) FILTER (WHERE paid = true) as paid_count
           FROM payments WHERE event_id = $1`,
          [eventId]
        );

        // Desglose de costes
        const costsResult = await query(
          `SELECT line_type, SUM(total) as total
           FROM cost_desglose WHERE event_id = $1
           GROUP BY line_type ORDER BY total DESC`,
          [eventId]
        );

        // Escandallo real costes de ingredientes
        const escandalloResult = await query(
          `SELECT COALESCE(SUM(estimated_cost), 0) as escandallo_total
           FROM event_shopping_items WHERE event_id = $1 AND frozen = true`,
          [eventId]
        );

        const pvp = Number(row.total_pvp) || 0;
        const cost = Number(row.total_cost) || 0;
        const guests = Number(row.guest_count) || 1;
        const paid = Number(paymentsResult.rows[0]?.total_paid || 0);
        const paymentCount = Number(paymentsResult.rows[0]?.payment_count || 0);
        const paidCount = Number(paymentsResult.rows[0]?.paid_count || 0);
        const escandalloCost = Number(escandalloResult.rows[0]?.escandallo_total || 0);

        const grossMargin = pvp - cost;
        const marginPct = pvp > 0 ? (grossMargin / pvp) * 100 : 0;
        const costPerGuest = cost / guests;
        const revenuePerGuest = pvp / guests;

        const costBreakdown: Record<string, number> = {};
        for (const c of (costsResult.rows || [])) {
          costBreakdown[(c as any).line_type] = Number((c as any).total);
        }

        return {
          id: eventId,
          clientName: row.client_name,
          eventDate: row.event_date,
          guestCount: guests,
          status: row.status,
          eventType: row.event_type,

          // Finanzas
          totalPvp: pvp,
          totalCost: cost,
          grossMargin,
          marginPct: Math.round(marginPct * 10) / 10,

          // Por comensal
          costPerGuest: Math.round(costPerGuest * 100) / 100,
          revenuePerGuest: Math.round(revenuePerGuest * 100) / 100,

          // Pagos
          totalPaid: Number(paid),
          balance: Number(paid) - pvp,
          paymentCount,
          paidCount,
          unpaidCount: paymentCount - paidCount,
          isFullyPaid: Number(paid) >= pvp,

          // Escandallo real
          escandalloTotal: escandalloCost,

          // Desglose
          costBreakdown,
          breakdownTypes: Object.keys(costBreakdown),

          // Bares
          barPrice: Number(row.bar_price) || 0,
          barHours: Number(row.bar_hours) || 0,
        };
      })
    );

    // Totales globales
    const totals = {
      totalEvents: events.length,
      totalPvp: events.reduce((s: number, e: any) => s + e.totalPvp, 0),
      totalCost: events.reduce((s: number, e: any) => s + e.totalCost, 0),
      totalMargin: events.reduce((s: number, e: any) => s + e.grossMargin, 0),
      totalPaid: events.reduce((s: number, e: any) => s + e.totalPaid, 0),
      averageMarginPct: 0,
      fullyPaidCount: events.filter((e: any) => e.isFullyPaid).length,
      eventsWithCosts: events.filter((e: any) => e.totalCost > 0).length,
    };
    totals.averageMarginPct = totals.totalPvp > 0
      ? Math.round((totals.totalMargin / totals.totalPvp) * 100 * 10) / 10
      : 0;

    return NextResponse.json({ success: true, data: events, totals });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}