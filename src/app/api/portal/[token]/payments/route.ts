/**
 * EventFlow — Portal Payments API
 * GET /api/portal/[token]/payments — Get payments for the event
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPortalAuth } from '@/lib/portalAuth';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const auth = await withPortalAuth(request);
    if (auth.response) return auth.response;

    const { eventId } = auth.context;

    // Get payments
    const payments = await queryMany<{
      id: string;
      concept: string;
      amount: number;
      paid: boolean;
      paid_date: string | null;
      method: string | null;
      notes: string | null;
      created_at: string;
    }>(
      `SELECT id, concept, amount, paid, paid_date, method, notes, created_at
       FROM payments
       WHERE event_id = $1
       ORDER BY created_at DESC`,
      [eventId]
    );

    // Get milestones
    const milestones = await queryMany<{
      id: string;
      kind: string;
      label: string;
      amount: number;
      due_date: string | null;
      status: string;
      paid_at: string | null;
      accumulated: number;
    }>(
      `SELECT pm.id, pm.kind, pm.label, pm.amount, pm.due_date, pm.status, pm.paid_at, pm.accumulated
       FROM payment_milestones pm
       JOIN payment_plans pp ON pp.id = pm.plan_id
       WHERE pp.event_id = $1
       ORDER BY pm.due_date NULLS LAST`,
      [eventId]
    );

    // Get total paid and pending
    const totals = await querySingle<{
      total_paid: number;
      total_pending: number;
    }>(
      `SELECT 
        COALESCE(SUM(amount) FILTER (WHERE paid = true), 0)::numeric as total_paid,
        COALESCE(SUM(amount) FILTER (WHERE paid = false), 0)::numeric as total_pending
       FROM payments WHERE event_id = $1`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      payments,
      milestones,
      totals: {
        paid: totals?.total_paid || 0,
        pending: totals?.total_pending || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
