/**
 * EventFlow — Appointments (Agenda) API
 * GET  /api/appointments?from=&to= — List appointments/blocks in a date range
 * POST /api/appointments — Create a cita / bloqueo / nota
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

const KINDS = ['cita', 'bloqueo', 'nota'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const params: any[] = [];
    const conditions: string[] = [];
    if (from) {
      params.push(from);
      conditions.push(`start_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`start_date <= $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await queryMany<any>(
      `SELECT a.*, e.client_name
       FROM appointments a
       LEFT JOIN events e ON e.id = a.event_id
       ${where}
       ORDER BY start_date ASC, start_time ASC NULLS FIRST`,
      params
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const title = (body.title ?? '').trim();
    if (!title) {
      return NextResponse.json({ success: false, error: 'El título es obligatorio' }, { status: 422 });
    }
    if (!body.start_date) {
      return NextResponse.json({ success: false, error: 'La fecha es obligatoria' }, { status: 422 });
    }
    const kind = KINDS.includes(body.kind) ? body.kind : 'cita';
    const created = await querySingle<any>(
      `INSERT INTO appointments (title, kind, event_id, start_date, end_date, start_time, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, kind, body.event_id || null, body.start_date, body.end_date || null, body.start_time || null, body.notes ?? null]
    );
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
