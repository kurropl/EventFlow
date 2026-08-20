/**
 * EventFlow — Staffing Lines API Routes
 * GET    /api/staffing/lines    — List staffing lines (filter by ?event_id=X)
 * POST   /api/staffing/lines    — Create a new staffing line
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText, toSafeInt } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────


// ── GET: List staffing lines ───────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (eventId) {
      if (!isValidUUID(eventId)) {
        return NextResponse.json(
          { success: false, error: 'event_id inválido.' },
          { status: 422 }
        );
      }
      conditions.push(`sl.event_id = $${idx++}`);
      values.push(eventId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await queryMany<any>(
      `SELECT sl.id, sl.event_id, sl.role, sl.slots_needed,
              sl.start_time, sl.end_time, sl.location, sl.uniform, sl.notes,
              sl.status, sl.created_at, sl.updated_at,
              e.client_name AS event_name, e.event_date,
              (SELECT COUNT(*)::int FROM staffing_assignments sa WHERE sa.staffing_line_id = sl.id) AS assigned_count,
              (SELECT COUNT(*)::int FROM staffing_offers so WHERE so.staffing_line_id = sl.id AND so.status = 'sent') AS offers_sent
       FROM staffing_lines sl
       JOIN events e ON e.id = sl.event_id
       ${where}
       ORDER BY e.event_date ASC, sl.role ASC`,
      values
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── POST: Create a staffing line ───────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const eventId = body.event_id;
    const role = body.role ? sanitizeText(body.role, 100) : '';
    const slotsNeeded = toSafeInt(body.slots_needed, 1, 100);

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { success: false, error: 'event_id válido es obligatorio.' },
        { status: 422 }
      );
    }
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'El rol es obligatorio.' },
        { status: 422 }
      );
    }

    const startTime = body.start_time || null;
    const endTime = body.end_time || null;
    const location = body.location ? sanitizeText(body.location, 300) : null;
    const uniform = body.uniform ? sanitizeText(body.uniform, 200) : null;
    const notes = body.notes ? sanitizeText(body.notes, 1000) : null;

    const created = await querySingle<any>(
      `INSERT INTO staffing_lines (event_id, role, slots_needed, start_time, end_time, location, uniform, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
       RETURNING *`,
      [eventId, role, slotsNeeded, startTime, endTime, location, uniform, notes]
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
