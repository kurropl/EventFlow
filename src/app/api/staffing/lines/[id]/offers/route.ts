/**
 * EventFlow — Staffing Offers API Routes (for a specific line)
 * GET    /api/staffing/lines/[id]/offers — List all offers for this line with worker details
 * POST   /api/staffing/lines/[id]/offers — Broadcast offers for a staffing line
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
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

// ── GET: List all offers for this line ─────────────────────────────

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

    const offers = await queryMany<any>(
      `SELECT so.id, so.staffing_line_id, so.worker_id, so.status,
              so.sent_at, so.responded_at, so.created_at,
              w.name AS worker_name, w.phone AS worker_phone, w.roles AS worker_roles
       FROM staffing_offers so
       JOIN workers w ON w.id = so.worker_id
       WHERE so.staffing_line_id = $1
       ORDER BY so.sent_at DESC`,
      [id]
    );

    return NextResponse.json({ success: true, data: offers });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── POST: Broadcast offers for a staffing line ─────────────────────

export async function POST(
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

    // Fetch the line to know its role
    const line = await querySingle<any>(
      `SELECT id, role, status, slots_needed FROM staffing_lines WHERE id = $1`,
      [id]
    );

    if (!line) {
      return NextResponse.json(
        { success: false, error: 'Línea de staffing no encontrada.' },
        { status: 404 }
      );
    }

    if (line.status === 'filled') {
      return NextResponse.json(
        { success: false, error: 'La línea ya está completa. No se pueden enviar más ofertas.' },
        { status: 409 }
      );
    }

    const body = await request.json();
    let workerIds: string[] = Array.isArray(body.worker_ids) ? body.worker_ids : [];

    // If no worker_ids provided, auto-select active workers with matching role
    if (workerIds.length === 0) {
      const matchingWorkers = await queryMany<any>(
        `SELECT id FROM workers WHERE active = true AND $1 = ANY(roles)`,
        [line.role]
      );
      workerIds = matchingWorkers.map(w => w.id);
    }

    if (workerIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se encontraron trabajadores disponibles con el rol requerido.' },
        { status: 404 }
      );
    }

    const createdOffers: any[] = [];
    const skippedWorkers: string[] = [];

    for (const workerId of workerIds) {
      if (!isValidUUID(workerId)) {
        skippedWorkers.push(workerId);
        continue;
      }

      // Check no existing offer for this line+worker
      const existingOffer = await querySingle<any>(
        `SELECT id FROM staffing_offers WHERE staffing_line_id = $1 AND worker_id = $2`,
        [id, workerId]
      );

      if (existingOffer) {
        skippedWorkers.push(workerId);
        continue;
      }

      // Create the offer
      const offer = await querySingle<any>(
        `INSERT INTO staffing_offers (staffing_line_id, worker_id, status, sent_at)
         VALUES ($1, $2, 'sent', now())
         RETURNING *`,
        [id, workerId]
      );

      if (offer) {
        createdOffers.push(offer);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        offers_created: createdOffers,
        skipped_count: skippedWorkers.length,
        total_sent: createdOffers.length,
      }
    }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
