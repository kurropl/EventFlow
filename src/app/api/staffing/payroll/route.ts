/**
 * EventFlow — Payroll Summary (across all events)
 * GET /api/staffing/payroll?event_id=X  — Single event payroll
 * GET /api/staffing/payroll             — All events summary per worker
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return { authenticated: false, error: 'No autenticado' };
  const user = verifyToken(token);
  if (!user) return { authenticated: false, error: 'Token inválido' };
  return { authenticated: true };
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (eventId) {
      // Single event payroll
      const rows = await queryMany<any>(
        `SELECT wep.id, wep.worker_id, wep.event_id, wep.hours, wep.hourly_rate, wep.total_pay, wep.notes,
                w.name AS worker_name, w.phone AS worker_phone, w.roles AS worker_roles,
                e.client_name AS event_name, e.event_date
         FROM worker_event_pay wep
         JOIN workers w ON w.id = wep.worker_id
         JOIN events e ON e.id = wep.event_id
         WHERE wep.event_id = $1
         ORDER BY w.name`,
        [eventId]
      );
      const totalHours = rows.reduce((sum, r) => sum + Number(r.hours || 0), 0);
      const totalPay = rows.reduce((sum, r) => sum + Number(r.total_pay || 0), 0);
      return NextResponse.json({ success: true, data: rows, meta: { totalHours, totalPay, count: rows.length } });
    }

    // All events summary grouped by worker
    const rows = await queryMany<any>(
      `SELECT w.id AS worker_id, w.name AS worker_name, w.phone AS worker_phone, w.roles AS worker_roles,
              COUNT(wep.id)::int AS event_count,
              COALESCE(SUM(wep.hours), 0)::numeric AS total_hours,
              COALESCE(SUM(wep.total_pay), 0)::numeric AS total_pay,
              COALESCE(AVG(wep.hourly_rate), 0)::numeric AS avg_rate
       FROM workers w
       LEFT JOIN worker_event_pay wep ON wep.worker_id = w.id
       LEFT JOIN events e ON e.id = wep.event_id AND e.status NOT IN ('cancelled', 'lost')
       WHERE w.active = true
       GROUP BY w.id, w.name, w.phone, w.roles
       ORDER BY w.name`
    );

    const grandTotalPay = rows.reduce((sum, r) => sum + Number(r.total_pay || 0), 0);
    const grandTotalHours = rows.reduce((sum, r) => sum + Number(r.total_hours || 0), 0);

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { totalWorkers: rows.length, totalPay: grandTotalPay, totalHours: grandTotalHours }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
