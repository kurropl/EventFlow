/**
 * EventFlow — Anular el contrato del evento (admin) (SPEC Sprint 3, G8)
 * POST /api/events/[id]/contract/void  { reason }
 *
 * Libera el hueco (índice único parcial idx_event_contracts_active) para que
 * un futuro POST .../contract/generate cree uno nuevo — útil si el evento se
 * renegocia (p.ej. tras INV-4 reabrir con cambio de precio).
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'event id inválido' }, { status: 422 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = body?.reason ? sanitizeText(String(body.reason), 500) : null;

    const existing = await querySingle<any>(
      `SELECT id FROM event_contracts WHERE event_id = $1 AND status != 'voided' LIMIT 1`,
      [params.id]
    );
    if (!existing) {
      return NextResponse.json({ success: false, error: 'No hay contrato activo para anular' }, { status: 404 });
    }

    const updated = await querySingle<any>(
      `UPDATE event_contracts
       SET status = 'voided', voided_at = now(), voided_reason = $1
       WHERE id = $2 RETURNING *`,
      [reason, existing.id]
    );

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
