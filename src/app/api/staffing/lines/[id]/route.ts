/**
 * EventFlow — Staffing Line by ID API Route
 * GET    /api/staffing/lines/[id] — Get single line with full details (workers, offers)
 * PUT    /api/staffing/lines/[id] — Update line fields
 * DELETE /api/staffing/lines/[id] — Delete line (CASCADE deletes offers & assignments)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText, toSafeInt } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────


// ── GET: Single line with full details ─────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuthRequest(_request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido.' },
        { status: 422 }
      );
    }

    const line = await querySingle<any>(
      `SELECT sl.id, sl.event_id, sl.role, sl.slots_needed,
              sl.start_time, sl.end_time, sl.location, sl.uniform, sl.notes,
              sl.status, sl.created_at, sl.updated_at,
              e.client_name AS event_name, e.event_date
       FROM staffing_lines sl
       JOIN events e ON e.id = sl.event_id
       WHERE sl.id = $1`,
      [id]
    );

    if (!line) {
      return NextResponse.json(
        { success: false, error: 'Línea de staffing no encontrada.' },
        { status: 404 }
      );
    }

    // Workers assigned to this line
    const assigned_workers = await queryMany<any>(
      `SELECT sa.id AS assignment_id, sa.position, sa.confirmed_at, sa.created_at AS assigned_at,
              w.id AS worker_id, w.name, w.phone, w.roles, w.default_uniform
       FROM staffing_assignments sa
       JOIN workers w ON w.id = sa.worker_id
       WHERE sa.staffing_line_id = $1
       ORDER BY sa.position ASC`,
      [id]
    );

    // Offers pending (status != 'accepted')
    const offers_pending = await queryMany<any>(
      `SELECT so.id AS offer_id, so.status, so.sent_at, so.responded_at, so.created_at,
              w.id AS worker_id, w.name, w.phone, w.roles
       FROM staffing_offers so
       JOIN workers w ON w.id = so.worker_id
       WHERE so.staffing_line_id = $1 AND so.status NOT IN ('accepted')
       ORDER BY so.sent_at DESC`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...line,
        assigned_workers,
        offers_pending,
        assigned_count: assigned_workers.length,
      }
    });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── PUT: Update line fields ────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido.' },
        { status: 422 }
      );
    }

    const body = await request.json();

    const allowed: Record<string, { transform: (v: any) => any }> = {
      role:         { transform: (v) => sanitizeText(String(v), 100) },
      slots_needed: { transform: (v) => toSafeInt(v, 1, 100) },
      start_time:   { transform: (v) => v || null },
      end_time:     { transform: (v) => v || null },
      location:     { transform: (v) => sanitizeText(String(v), 300) || null },
      uniform:      { transform: (v) => sanitizeText(String(v), 200) || null },
      notes:        { transform: (v) => sanitizeText(String(v), 1000) || null },
      status:       { transform: (v) => sanitizeText(String(v), 50) },
      event_id:     { transform: (v) => v },
    };

    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, { transform }] of Object.entries(allowed)) {
      if (key in body && body[key] !== undefined) {
        sets.push(`${key} = $${idx++}`);
        values.push(transform(body[key]));
      }
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nada que actualizar.' },
        { status: 400 }
      );
    }

    values.push(id);
    const updated = await querySingle<any>(
      `UPDATE staffing_lines SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Línea de staffing no encontrada.' },
        { status: 404 }
      );
    }

    // Auto-create pay entries when closing staffing line
    if (body.status === 'filled') {
      const assigned = await queryMany<any>(
        `SELECT sa.worker_id FROM staffing_assignments sa WHERE sa.staffing_line_id = $1`,
        [id]
      );
      for (const a of assigned) {
        // Upsert: only create if not already exists
        await querySingle<any>(
          `INSERT INTO worker_event_pay (worker_id, event_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (worker_id, event_id) DO NOTHING`,
          [a.worker_id, updated.event_id]
        );
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── DELETE: Delete line (hard delete with CASCADE) ─────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuthRequest(_request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido.' },
        { status: 422 }
      );
    }

    // First delete assignments, then offers, then the line itself
    const deleted = await querySingle<any>(
      `DELETE FROM staffing_lines WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Línea de staffing no encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
