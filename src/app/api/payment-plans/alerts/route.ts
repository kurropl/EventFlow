/**
 * EventFlow — Payment Plan Alerts API (WP-21)
 * GET /api/payment-plans/alerts — Hitos pendientes/vencidos para dashboard
 *
 * Retorna los hitos que requieren atención: vencidos primero,
 * luego los próximos a vencer. Usado por el dashboard y el sidebar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMilestoneAlerts } from '@/lib/domain/paymentPlan';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const alerts = await getMilestoneAlerts();

    const summary = {
      total: alerts.length,
      overdue: alerts.filter(a => a.milestone_status === 'vencido').length,
      upcoming: alerts.filter(a => a.milestone_status === 'pendiente').length,
      total_pending_amount: alerts.reduce((sum, a) => sum + Number(a.milestone_amount), 0),
      overdue_amount: alerts
        .filter(a => a.milestone_status === 'vencido')
        .reduce((sum, a) => sum + Number(a.milestone_amount), 0),
    };

    return NextResponse.json({ success: true, data: { summary, alerts } });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
