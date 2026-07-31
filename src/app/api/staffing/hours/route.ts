/**
 * EventFlow — Work Hours API
 * 
 * GET  /api/staffing/hours — List work hours (filters: worker_id, date_from, date_to)
 * POST /api/staffing/hours — Register work hours
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const searchParams = new URL(request.url).searchParams;
    const workerId = searchParams.get('worker_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const status = searchParams.get('status');
    const eventId = searchParams.get('event_id');

    let sql = `
      SELECT wh.*, w.name as worker_name, w.phone as worker_phone,
             e.client_name as event_name
      FROM work_hours wh
      JOIN workers w ON w.id = wh.worker_id
      LEFT JOIN events e ON e.id = wh.event_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (workerId) {
      sql += ` AND wh.worker_id = $${idx++}`;
      params.push(workerId);
    }
    if (dateFrom) {
      sql += ` AND wh.date >= $${idx++}`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND wh.date <= $${idx++}`;
      params.push(dateTo);
    }
    if (status) {
      sql += ` AND wh.status = $${idx++}`;
      params.push(status);
    }
    if (eventId) {
      sql += ` AND wh.event_id = $${idx++}`;
      params.push(eventId);
    }

    sql += " ORDER BY wh.date DESC, wh.created_at DESC";

    const hours = await queryMany<any>(sql, params);
    return NextResponse.json({ success: true, data: hours });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    if (!body.worker_id || !body.date || !body.hours) {
      return NextResponse.json({ success: false, error: 'worker_id, date y hours son requeridos' }, { status: 400 });
    }

    // Get worker hourly rate
    const worker = await querySingle<any>(
      "SELECT hourly_rate FROM workers WHERE id = $1",
      [body.worker_id]
    );

    if (!worker) {
      return NextResponse.json({ success: false, error: 'Trabajador no encontrado' }, { status: 404 });
    }

    const hourlyRate = body.hourly_rate || worker.hourly_rate || 12;
    const totalPay = body.hours * hourlyRate;

    const hour = await querySingle<any>(
      `INSERT INTO work_hours (worker_id, event_id, date, start_time, end_time, hours, hourly_rate, total_pay, status, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
       RETURNING *`,
      [
        body.worker_id,
        body.event_id || null,
        body.date,
        body.start_time || null,
        body.end_time || null,
        body.hours,
        hourlyRate,
        totalPay,
        body.status || 'pending',
        body.notes || null,
      ]
    );

    return NextResponse.json({ success: true, data: hour }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}