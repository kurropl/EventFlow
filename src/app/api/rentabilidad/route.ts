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

        // Desglose de costes — F3.4: gastos previos (FR-A06) se guardan con
        // line_type='extras' y description 'Gasto previo: …'; antes se
        // fundían con el resto de extras en este desglose. Línea propia.
        const costsResult = await query(
          `SELECT CASE WHEN line_type = 'extras' AND description LIKE 'Gasto previo:%'
                       THEN 'gastos_previos' ELSE line_type END AS line_type,
                  SUM(total) as total
           FROM cost_desglose WHERE event_id = $1
           GROUP BY 1 ORDER BY total DESC`,
          [eventId]
        );

        // Coste real congelado (AC2.4): desviación del escandallo tras el cierre.
        // No sustituye a events.total_cost como fuente del margen (R2/Opción B);
        // es solo un indicador de desviación estimado→real.
        const frozenCostResult = await query(
          `SELECT COALESCE(SUM(estimated_cost), 0) as frozen_total
           FROM event_shopping_items WHERE event_id = $1 AND frozen = true`,
          [eventId]
        );

        // G3 (Sprint 1): coste de personal. D4 → el margen cuenta SOLO las
        // nóminas pagadas; el total asignado (pagado+pendiente) se refleja aparte.
        const laborResult = await query(
          `SELECT COALESCE(SUM(total_pay) FILTER (WHERE status = 'paid'), 0) AS paid,
                  COALESCE(SUM(total_pay), 0) AS total
           FROM worker_event_pay WHERE event_id = $1`,
          [eventId]
        );

        const pvp = Number(row.total_pvp) || 0;
        const cost = Number(row.total_cost) || 0;
        const guests = Number(row.guest_count) || 1;
        const paid = Number(paymentsResult.rows[0]?.total_paid || 0);
        const paymentCount = Number(paymentsResult.rows[0]?.payment_count || 0);
        const paidCount = Number(paymentsResult.rows[0]?.paid_count || 0);
        const frozenRealCost = Number(frozenCostResult.rows[0]?.frozen_total || 0);
        const laborCostPaid = Number(laborResult.rows[0]?.paid || 0);   // base del margen (D4)
        const laborCostTotal = Number(laborResult.rows[0]?.total || 0); // informativo

        // Coste total REAL = comida+extras (events.total_cost) + personal pagado.
        const totalCostFull = cost + laborCostPaid;
        const grossMargin = pvp - totalCostFull;          // ← margen real (antes pvp - cost)
        const marginPct = pvp > 0 ? (grossMargin / pvp) * 100 : 0;
        const costPerGuest = totalCostFull / guests;       // ← coste/comensal real
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
          totalCost: cost,                 // comida+extras (sin cambio de semántica, R2)
          laborCostPaid,                   // G3: personal pagado (base del margen)
          laborCostTotal,                  // G3: personal asignado total (informativo)
          laborCostPending: Math.round((laborCostTotal - laborCostPaid) * 100) / 100,
          totalCostFull,                   // G3: coste total real (= base del margen)
          grossMargin,                     // ahora descuenta personal pagado
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

          // Coste real congelado (AC2.4) — desviación, no fuente del margen
          costeRealCongelado: frozenRealCost,

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
      totalLaborCost: events.reduce((s: number, e: any) => s + (e.laborCostPaid || 0), 0),
      totalCostFull: events.reduce((s: number, e: any) => s + (e.totalCostFull || 0), 0),
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