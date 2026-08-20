/**
 * EventFlow — Staffing Assignments API Route (for a specific line)
 * GET    /api/staffing/lines/[id]/assignments — List assignments for this line ordered by position
 * POST   /api/staffing/lines/[id]/assignments — Accept an offer (create assignment, concurrent-safe)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────


// ── GET: List assignments for this line ────────────────────────────

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

    const assignments = await queryMany<any>(
      `SELECT sa.id, sa.staffing_line_id, sa.worker_id, sa.offer_id,
              sa.confirmed_at, sa.position, sa.created_at,
              w.name AS worker_name, w.phone AS worker_phone, w.roles AS worker_roles,
              w.default_uniform
       FROM staffing_assignments sa
       JOIN workers w ON w.id = sa.worker_id
       WHERE sa.staffing_line_id = $1
       ORDER BY sa.position ASC`,
      [id]
    );

    return NextResponse.json({ success: true, data: assignments });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ── POST: Accept an offer (create assignment, concurrent-safe) ─────

export async function POST(
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
    const offerId = body.offer_id;

    if (!offerId || !isValidUUID(offerId)) {
      return NextResponse.json(
        { success: false, error: 'offer_id válido es obligatorio.' },
        { status: 422 }
      );
    }

    // Verify offer belongs to this line
    const offer = await querySingle<any>(
      `SELECT id, worker_id, status FROM staffing_offers WHERE id = $1 AND staffing_line_id = $2`,
      [offerId, id]
    );

    if (!offer) {
      return NextResponse.json(
        { success: false, error: 'Oferta no encontrada para esta línea.' },
        { status: 404 }
      );
    }

    if (offer.status === 'accepted') {
      return NextResponse.json(
        { success: false, error: 'Esta oferta ya fue aceptada.' },
        { status: 409 }
      );
    }

    // Concurrent-safe assignment using transaction with FOR UPDATE lock
    const result = await transaction(async (client) => {
      // Lock the staffing_line row
      const lineRow = (await client.query(
        'SELECT id, slots_needed, status FROM staffing_lines WHERE id = $1 FOR UPDATE',
        [id]
      )).rows[0];

      if (!lineRow) {
        throw new Error('Línea de staffing no encontrada.');
      }

      if (lineRow.status === 'filled') {
        throw new Error('La línea ya está completa.');
      }

      // Check current assignment count
      const countRes = (await client.query(
        'SELECT COUNT(*)::int as cnt FROM staffing_assignments WHERE staffing_line_id = $1',
        [id]
      )).rows[0];

      const currentCount: number = countRes.cnt;
      const slotsNeeded: number = lineRow.slots_needed;

      if (currentCount >= slotsNeeded) {
        // Line is full — expire remaining offers and update status
        await client.query(
          `UPDATE staffing_lines SET status = 'filled' WHERE id = $1`,
          [id]
        );
        await client.query(
          `UPDATE staffing_offers SET status = 'expired'
           WHERE staffing_line_id = $1 AND status = 'sent'`,
          [id]
        );
        throw new Error('La línea ya está completa. La oferta no pudo ser aceptada.');
      }

      // Check if this worker already has an assignment on this line
      const existingAssignment = (await client.query(
        'SELECT id FROM staffing_assignments WHERE staffing_line_id = $1 AND worker_id = $2',
        [id, offer.worker_id]
      )).rows[0];

      if (existingAssignment) {
        throw new Error('Este trabajador ya está asignado a esta línea.');
      }

      // Insert assignment with position = count + 1
      const newPosition = currentCount + 1;
      const assignment = (await client.query(
        `INSERT INTO staffing_assignments (staffing_line_id, worker_id, offer_id, confirmed_at, position)
         VALUES ($1, $2, $3, now(), $4)
         RETURNING *`,
        [id, offer.worker_id, offerId, newPosition]
      )).rows[0];

      // Update offer status to accepted
      await client.query(
        `UPDATE staffing_offers SET status = 'accepted', responded_at = now() WHERE id = $1`,
        [offerId]
      );

      // If line is now filled, update status and expire remaining offers
      if (newPosition >= slotsNeeded) {
        await client.query(
          `UPDATE staffing_lines SET status = 'filled' WHERE id = $1`,
          [id]
        );
        await client.query(
          `UPDATE staffing_offers SET status = 'expired'
           WHERE staffing_line_id = $1 AND status = 'sent'`,
          [id]
        );
      }

      return { assignment, newPosition, filled: newPosition >= slotsNeeded };
    });

    return NextResponse.json({
      success: true,
      data: result.assignment,
      meta: {
        position: result.newPosition,
        filled: result.filled,
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
