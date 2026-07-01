/**
 * EventFlow — Contrato del evento (admin) (SPEC Sprint 3, G8)
 * GET /api/events/[id]/contract — devuelve el contrato activo (pending/signed)
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'event id inválido' }, { status: 422 });
    }

    const contract = await querySingle<any>(
      `SELECT * FROM event_contracts WHERE event_id = $1 AND status != 'voided' LIMIT 1`,
      [params.id]
    );
    if (!contract) {
      return NextResponse.json({ success: false, error: 'No hay contrato generado para este evento' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: contract });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
