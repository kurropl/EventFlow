/**
 * EventFlow — Worker-Event Pay (Salary per Event)
 * GET    /api/staffing/pay?event_id=X          — List pay for an event
 * POST   /api/staffing/pay                     — Create/update pay entry
 * PUT    /api/staffing/pay                     — Update status (mark as paid)
 * DELETE /api/staffing/pay?id=X                — Delete pay entry
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, getPool } from '@/lib/db';
import { sanitizeError, isValidUUID, toSafeFloat, sanitizeText } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';
import { recalcEventLaborCost } from '@/lib/domain/recalcEventLaborCost';


export async function GET(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json({ success: false, error: 'event_id válido es obligatorio' }, { status: 422 });
    }

    const rows = await queryMany<any>(
      `SELECT wep.id, wep.worker_id, wep.event_id, wep.hours, wep.hourly_rate, wep.total_pay, wep.notes,
              wep.status, wep.paid_at, wep.created_at, wep.updated_at,
              wep.signature_url, wep.signed_by, wep.signed_at,
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
    const pendingCount = rows.filter(r => r.status === 'pending').length;
    const paidCount = rows.filter(r => r.status === 'paid').length;

    return NextResponse.json({
      success: true,
      data: rows,
      meta: { totalHours, totalPay, count: rows.length, pendingCount, paidCount }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
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
      `INSERT INTO worker_event_pay (worker_id, event_id, hours, hourly_rate, total_pay, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       ON CONFLICT (worker_id, event_id) 
       DO UPDATE SET hours = $3, hourly_rate = $4, total_pay = $5, notes = $6, updated_at = now()
       RETURNING *`,
      [worker_id, event_id, h, rate, totalPay, notes || null]
    );

    // G3: resincroniza el coste de personal del evento (línea cost_desglose).
    await recalcEventLaborCost(getPool(), event_id);

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const body = await request.json();
    const { id, status, hours, hourly_rate, notes } = body;

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'id válido es obligatorio' }, { status: 422 });
    }

    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      vals.push(sanitizeText(String(status), 20));
      if (status === 'paid') {
        fields.push(`paid_at = now()`);
      }
    }
    if (hours !== undefined) {
      const h = toSafeFloat(hours, 0, 24);
      fields.push(`hours = $${idx++}`);
      vals.push(h);
    }
    if (hourly_rate !== undefined) {
      const rate = toSafeFloat(hourly_rate, 0, 1000);
      fields.push(`hourly_rate = $${idx++}`);
      vals.push(rate);
    }
    if (notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      vals.push(notes ? sanitizeText(String(notes), 1000) : null);
    }

    // Recalculate total_pay if hours or rate changed
    if (hours !== undefined || hourly_rate !== undefined) {
      const existing = await querySingle<any>(`SELECT hours, hourly_rate FROM worker_event_pay WHERE id = $1`, [id]);
      if (existing) {
        const newHours = hours !== undefined ? toSafeFloat(hours, 0, 24) : Number(existing.hours);
        const newRate = hourly_rate !== undefined ? toSafeFloat(hourly_rate, 0, 1000) : Number(existing.hourly_rate);
        const newTotal = Math.round(newHours * newRate * 100) / 100;
        fields.push(`total_pay = $${idx++}`);
        vals.push(newTotal);
      }
    }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que actualizar' }, { status: 400 });
    }

    fields.push(`updated_at = now()`);
    vals.push(id);

    const updated = await querySingle<any>(
      `UPDATE worker_event_pay SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );

    // G3: cambiar importe o estado (pagado/pendiente) recalcula el coste de personal.
    if (updated?.event_id) await recalcEventLaborCost(getPool(), updated.event_id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'id válido es obligatorio' }, { status: 422 });
    }

    // Capturar el event_id antes de borrar para poder recalcular después (G3).
    const row = await querySingle<any>(`SELECT event_id FROM worker_event_pay WHERE id = $1`, [id]);
    await querySingle<any>(`DELETE FROM worker_event_pay WHERE id = $1`, [id]);
    if (row?.event_id) await recalcEventLaborCost(getPool(), row.event_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
