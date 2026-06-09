/**
 * EventFlow — Worker-Event Pay (Salary per Event)
 * GET    /api/staffing/pay?event_id=X          — List pay for an event
 * POST   /api/staffing/pay                     — Create/update pay
 * DELETE /api/staffing/pay?id=X                — Delete pay entry
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, toSafeFloat } from '@/lib/security';
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

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ success: false, error: 'event_id válido es obligatorio' }, { status: 422 });
    }

    const rows = await queryMany<any>(
      `SELECT wep.id, wep.worker_id, wep.event_id, wep.hours, wep.hourly_rate, wep.total_pay, wep.notes,
              w.name AS worker_name, w.phone AS worker_phone, w.roles AS worker_roles
       FROM worker_event_pay wep
       JOIN workers w ON w.id = wep.worker_id
       WHERE wep.event_id = $1
       ORDER BY w.name`,
      [eventId]
    );

    // Calculate totals
    const totalHours = rows.reduce((sum, r) => sum + Number(r.hours || 0), 0);
    const totalPay = rows.reduce((sum, r) => sum + Number(r.total_pay || 0), 0);

    return NextResponse.json({ success: true, data: rows, meta: { totalHours, totalPay, count: rows.length } });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const body = await request.json();
    const { worker_id, event_id, hours, hourly_rate, notes } = body;

    if (!worker_id || !isValidUUID(worker_id)) {
      return NextResponse.json({ success: false, error: 'worker_id válido es obligatorio' }, { status: 422 });
    }
    if (!event_id || !isValidUUID(event_id)) {
      return NextResponse.json({ success: false, error: 'event_id válido es obligatorio' }, { status: 422 });
    }

    const h = toSafeFloat(hours, 0, 24);
    const rate = toSafeFloat(hourly_rate, 0, 1000);
    const totalPay = Math.round(h * rate * 100) / 100;

    const created = await querySingle<any>(
      `INSERT INTO worker_event_pay (worker_id, event_id, hours, hourly_rate, total_pay, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (worker_id, event_id) 
       DO UPDATE SET hours = $3, hourly_rate = $4, total_pay = $5, notes = $6, updated_at = now()
       RETURNING *`,
      [worker_id, event_id, h, rate, totalPay, notes || null]
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'id válido es obligatorio' }, { status: 422 });
    }

    await querySingle<any>(`DELETE FROM worker_event_pay WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
