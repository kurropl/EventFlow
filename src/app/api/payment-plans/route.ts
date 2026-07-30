/**
 * EventFlow — Payment Plans API (WP-21)
 * GET /api/payment-plans?event_id= — List/Get payment plans
 *
 * Si se pasa event_id, retorna el plan de ese evento.
 * Sin event_id, retorna todos los planes activos con su resumen.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

interface PaymentPlanSummary {
  id: string;
  event_id: string;
  quote_id: string;
  total: number;
  status: string;
  created_at: string;
  // Joined
  client_name?: string;
  event_date?: string;
  event_type?: string;
  pending_amount?: number;
  paid_amount?: number;
  next_due_date?: string;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (eventId) {
      // Plan específico de un evento (con hitos)
      const plan = await querySingle<any>(
        `SELECT * FROM payment_plans WHERE event_id = $1`,
        [eventId]
      );
      if (!plan) {
        return NextResponse.json({ success: true, data: null });
      }

      const milestones = await queryMany<any>(
        `SELECT * FROM payment_milestones WHERE plan_id = $1 ORDER BY due_date ASC NULLS LAST, created_at`,
        [plan.id]
      );

      return NextResponse.json({ success: true, data: { ...plan, milestones } });
    }

    // Todos los planes (resumen para listado)
    const plans = await queryMany<PaymentPlanSummary>(
      `SELECT
        pp.*,
        e.client_name,
        TO_CHAR(e.event_date, 'YYYY-MM-DD') AS event_date,
        e.event_type,
        COALESCE((
          SELECT SUM(pm.amount)
          FROM payment_milestones pm
          WHERE pm.plan_id = pp.id AND pm.status = 'pendiente' AND pm.kind != 'extra'
        ), 0) AS pending_amount,
        COALESCE((
          SELECT SUM(pm.amount)
          FROM payment_milestones pm
          WHERE pm.plan_id = pp.id AND pm.status = 'pagado'
        ), 0) AS paid_amount,
        (
          SELECT MIN(pm.due_date)
          FROM payment_milestones pm
          WHERE pm.plan_id = pp.id AND pm.status = 'pendiente' AND pm.due_date IS NOT NULL
        ) AS next_due_date
      FROM payment_plans pp
      JOIN events e ON e.id = pp.event_id
      WHERE pp.status = 'active'
      ORDER BY e.event_date ASC`
    );

    return NextResponse.json({ success: true, data: plans });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
