/**
 * EventFlow — Staffing Worker by ID API Route
 * GET    /api/staffing/workers/[id] — Get single worker with assignment history
 * PUT    /api/staffing/workers/[id] — Update worker fields
 * DELETE /api/staffing/workers/[id] — Soft delete (set active=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) {
    return { authenticated: false, error: 'No autenticado' };
  }
  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, error: 'Token inválido o expirado' };
  }
  return { authenticated: true };
}

// ── GET: Single worker with assignment history ─────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(_request);
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

    const worker = await querySingle<any>(
      `SELECT id, name, phone, roles, default_uniform, availability,
              active, created_at, updated_at
       FROM workers
       WHERE id = $1`,
      [id]
    );

    if (!worker) {
      return NextResponse.json(
        { success: false, error: 'Trabajador no encontrado.' },
        { status: 404 }
      );
    }

    // Get assignment history
    const assignments = await queryMany<any>(
      `SELECT sa.id, sa.staffing_line_id, sa.offer_id, sa.confirmed_at, sa.position, sa.created_at,
              sl.role, sl.start_time, sl.end_time, sl.location, sl.status as line_status,
              e.client_name as event_name, e.event_date
       FROM staffing_assignments sa
       JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
       JOIN events e ON e.id = sl.event_id
       WHERE sa.worker_id = $1
       ORDER BY sa.created_at DESC`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: { ...worker, assignments }
    });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── PUT: Update worker fields ──────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(request);
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
      name:           { transform: (v) => sanitizeText(String(v), 200) },
      phone:          { transform: (v) => sanitizeText(String(v), 50) },
      roles:          { transform: (v) => Array.isArray(v) ? v.map((r: string) => sanitizeText(r, 50)).filter(Boolean) : v },
      default_uniform:{ transform: (v) => sanitizeText(String(v), 200) || null },
      availability:   { transform: (v) => v },
      active:         { transform: (v) => Boolean(v) },
    };

    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, { transform }] of Object.entries(allowed)) {
      if (key in body && body[key] !== undefined) {
        if (key === 'roles') {
          sets.push(`${key} = $${idx++}`);
          values.push(transform(body[key]));
        } else if (key === 'availability') {
          sets.push(`${key} = $${idx++}::jsonb`);
          values.push(body[key] != null ? JSON.stringify(body[key]) : null);
        } else {
          sets.push(`${key} = $${idx++}`);
          values.push(transform(body[key]));
        }
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
      `UPDATE workers SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Trabajador no encontrado.' },
        { status: 404 }
      );
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

// ── DELETE: Soft delete (set active=false) ──────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(_request);
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

    const updated = await querySingle<any>(
      `UPDATE workers SET active = false WHERE id = $1 AND active = true RETURNING id`,
      [id]
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Trabajador no encontrado o ya desactivado.' },
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
