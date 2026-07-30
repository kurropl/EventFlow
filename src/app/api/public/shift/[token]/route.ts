/**
 * EventFlow — Public Shift Confirmation API
 * GET  /api/public/shift/[token] — Get shift details by token (public, no auth)
 * POST /api/public/shift/[token] — Accept or reject shift (public, no auth)
 *
 * This endpoint is used by the public /turno/[token] page.
 * Workers can accept or reject their assigned shifts without logging in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

// ============================================================
// Types
// ============================================================

interface ShiftDetails {
  id: string;
  worker_name: string;
  worker_phone: string;
  role: string;
  event_name: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  status: string;
}

// ============================================================
// GET: Fetch shift details by token
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Token inválido.' },
        { status: 400 }
      );
    }

    // Fetch shift details by offer_token
    const shift = await querySingle<ShiftDetails>(
      `SELECT 
        so.id,
        w.name AS worker_name,
        w.phone AS worker_phone,
        sl.role,
        COALESCE(e.client_name, 'Evento') AS event_name,
        TO_CHAR(e.event_date, 'DD/MM/YYYY') AS event_date,
        TO_CHAR(sl.start_time, 'HH24:MI') AS start_time,
        TO_CHAR(sl.end_time, 'HH24:MI') AS end_time,
        sl.location,
        so.status
       FROM staffing_offers so
       JOIN workers w ON w.id = so.worker_id
       JOIN staffing_lines sl ON sl.id = so.staffing_line_id
       JOIN events e ON e.id = sl.event_id
       WHERE so.offer_token = $1`,
      [token]
    );

    if (!shift) {
      return NextResponse.json(
        { success: false, error: 'Turno no encontrado o token inválido.' },
        { status: 404 }
      );
    }

    // Check if shift is still pending (can be accepted/rejected)
    if (shift.status !== 'sent') {
      return NextResponse.json(
        { 
          success: true, 
          data: shift,
          message: `Este turno ya ha sido ${shift.status === 'accepted' ? 'aceptado' : 'rechazado'}.`
        }
      );
    }

    return NextResponse.json({ success: true, data: shift });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Accept or reject shift
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Token inválido.' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Acción inválida. Use "accept" o "reject".' },
        { status: 400 }
      );
    }

    // Find the offer by token
    const offer = await querySingle<any>(
      `SELECT so.id, so.status, so.staffing_line_id, so.worker_id,
              sl.event_id, sl.role, sl.slots_needed,
              (SELECT COUNT(*)::int FROM staffing_assignments sa 
               WHERE sa.staffing_line_id = so.staffing_line_id) AS assigned_count
       FROM staffing_offers so
       JOIN staffing_lines sl ON sl.id = so.staffing_line_id
       WHERE so.offer_token = $1`,
      [token]
    );

    if (!offer) {
      return NextResponse.json(
        { success: false, error: 'Turno no encontrado o token inválido.' },
        { status: 404 }
      );
    }

    // Check if already responded
    if (offer.status !== 'sent') {
      return NextResponse.json(
        { success: false, error: `Este turno ya ha sido ${offer.status}.` },
        { status: 409 }
      );
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    // Update the offer status
    const { getPool } = await import('@/lib/db');
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Update offer status
      await client.query(
        `UPDATE staffing_offers 
         SET status = $1, responded_at = now() 
         WHERE id = $2`,
        [newStatus, offer.id]
      );

      // If accepted, create assignment
      if (action === 'accept') {
        // Check if there's still space
        if (offer.assigned_count >= offer.slots_needed) {
          await client.query('ROLLBACK');
          return NextResponse.json(
            { success: false, error: 'Este turno ya está completo.' },
            { status: 409 }
          );
        }

        // Check for duplicate assignment
        const existingAssignment = await client.query(
          `SELECT id FROM staffing_assignments 
           WHERE staffing_line_id = $1 AND worker_id = $2`,
          [offer.staffing_line_id, offer.worker_id]
        );

        if (existingAssignment.rows.length === 0) {
          // Get next position
          const posResult = await client.query(
            `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos 
             FROM staffing_assignments 
             WHERE staffing_line_id = $1`,
            [offer.staffing_line_id]
          );
          const nextPos = posResult.rows[0].next_pos;

          // Create assignment
          await client.query(
            `INSERT INTO staffing_assignments (staffing_line_id, worker_id, offer_id, position)
             VALUES ($1, $2, $3, $4)`,
            [offer.staffing_line_id, offer.worker_id, offer.id, nextPos]
          );
        }

        // Update staffing line status if filled
        const totalAssigned = await client.query(
          `SELECT COUNT(*)::int AS count 
           FROM staffing_assignments 
           WHERE staffing_line_id = $1`,
          [offer.staffing_line_id]
        );

        if (totalAssigned.rows[0].count >= offer.slots_needed) {
          await client.query(
            `UPDATE staffing_lines SET status = 'filled' WHERE id = $1`,
            [offer.staffing_line_id]
          );
        }
      }

      await client.query('COMMIT');

      // Emit domain event (best-effort, outside transaction)
      try {
        const { emitDomainEventStandalone } = await import('@/domain/events');
        const eventType = action === 'accept' ? 'shift.confirmed' : 'shift.rejected';
        await emitDomainEventStandalone(
          eventType,
          'event',
          offer.event_id,
          {
            shift_id: offer.id,
            worker_id: offer.worker_id,
            staffing_line_id: offer.staffing_line_id,
            role: offer.role,
            action
          }
        );
      } catch (eventError) {
        console.error('[shift] Failed to emit domain event:', eventError);
        // Don't fail the request if event emission fails
      }

      return NextResponse.json({
        success: true,
        message: action === 'accept' 
          ? 'Turno aceptado correctamente.' 
          : 'Turno rechazado.',
        data: { status: newStatus }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
