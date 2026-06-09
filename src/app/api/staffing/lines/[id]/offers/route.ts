/**
 * EventFlow — Staffing Offers API Routes (for a specific line)
 * GET    /api/staffing/lines/[id]/offers — List all offers for this line with worker details
 * POST   /api/staffing/lines/[id]/offers — Broadcast offers for a staffing line (WhatsApp)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { verifyToken } from '@/lib/auth';
import { getWhatsAppClient, buildStaffingOfferMessage } from '@/lib/whatsapp';

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

// ── Availability helpers ────────────────────────────────────────────

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** Worker is available on `weekday` if they have no schedule configured (unknown
 *  → don't exclude) or the schedule for that day is non-null. */
function isAvailableOn(availability: any, weekday: string | null): boolean {
  if (!weekday) return true; // line has no date → cannot filter, include all
  if (!availability || typeof availability !== 'object') return true;
  if (Object.keys(availability).length === 0) return true;
  return availability[weekday] != null;
}

const fmtDate = (d: string | null) => {
  if (!d) return 'Por definir';
  const date = new Date(d);
  return isNaN(date.getTime()) ? 'Por definir'
    : date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};
const fmtTime = (d: string | null) => {
  if (!d) return '—';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '—'
    : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

// ── GET: List all offers for this line ─────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = requireAuth(_request);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 422 });
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
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
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
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 422 });
    }

    // Fetch the line + its event so the message can include date/place/time/uniform.
    const line = await querySingle<any>(
      `SELECT sl.id, sl.role, sl.status, sl.slots_needed,
              sl.start_time, sl.end_time, sl.location, sl.uniform,
              e.client_name, e.event_date
       FROM staffing_lines sl
       JOIN events e ON e.id = sl.event_id
       WHERE sl.id = $1`,
      [id]
    );

    if (!line) {
      return NextResponse.json({ success: false, error: 'Línea de staffing no encontrada.' }, { status: 404 });
    }
    if (line.status === 'filled') {
      return NextResponse.json(
        { success: false, error: 'La línea ya está completa. No se pueden enviar más ofertas.' },
        { status: 409 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const explicitIds: string[] = Array.isArray(body.worker_ids) ? body.worker_ids : [];

    // Weekday of the shift (for availability filtering on auto-select).
    const shiftDate = line.start_time || line.event_date || null;
    const weekday = shiftDate ? WEEKDAY_KEYS[new Date(shiftDate).getDay()] : null;

    // Candidate workers: explicit selection (admin choice, no availability filter)
    // OR auto-select by role + active + available that weekday.
    let candidates: Array<{ id: string; name: string; phone: string }> = [];
    if (explicitIds.length > 0) {
      const valid = explicitIds.filter(isValidUUID);
      if (valid.length > 0) {
        candidates = await queryMany<any>(
          `SELECT id, name, phone FROM workers WHERE id = ANY($1::uuid[]) AND active = true`,
          [valid]
        );
      }
    } else {
      const pool = await queryMany<any>(
        `SELECT id, name, phone, availability FROM workers
         WHERE active = true AND $1 = ANY(roles)`,
        [line.role]
      );
      candidates = pool.filter((w) => isAvailableOn(w.availability, weekday));
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No hay trabajadores con el rol requerido disponibles esa fecha.' },
        { status: 404 }
      );
    }

    const wa = getWhatsAppClient();
    const created: any[] = [];
    let skipped = 0;
    let messaged = 0;

    for (const worker of candidates) {
      // Skip if an offer already exists for this line+worker.
      const existing = await querySingle<any>(
        `SELECT id FROM staffing_offers WHERE staffing_line_id = $1 AND worker_id = $2`,
        [id, worker.id]
      );
      if (existing) { skipped++; continue; }

      const offer = await querySingle<any>(
        `INSERT INTO staffing_offers (staffing_line_id, worker_id, status, sent_at)
         VALUES ($1, $2, 'sent', now()) RETURNING *`,
        [id, worker.id]
      );
      if (!offer) continue;
      created.push(offer);

      // Send the WhatsApp offer (best-effort: a failed send never aborts the broadcast).
      try {
        const res = await wa.sendMessage(
          worker.phone,
          buildStaffingOfferMessage({
            workerName: worker.name,
            roleName: line.role,
            eventDate: fmtDate(line.event_date),
            startTime: fmtTime(line.start_time),
            endTime: fmtTime(line.end_time),
            location: line.location || 'Por definir',
            uniform: line.uniform || 'Uniforme estándar',
          })
        );
        if (res.success) messaged++;
      } catch (e) {
        console.error('[staffing offers] WhatsApp send failed for worker', worker.id, e);
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          offers_created: created,
          total_sent: created.length,
          messaged,
          skipped_count: skipped,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
