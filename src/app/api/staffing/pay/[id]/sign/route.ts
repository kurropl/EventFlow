/**
 * EventFlow — Firma del trabajador tras el pago de nómina (FR-A09)
 * POST /api/staffing/pay/[id]/sign  { signature_url, signed_by }
 *
 * Solo se puede firmar un pago YA pagado (la firma confirma la recepción del
 * pago total por el trabajador).
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'id inválido' }, { status: 422 });
    }
    const { signature_url, signed_by } = await request.json();
    if (!signature_url) {
      return NextResponse.json({ success: false, error: 'signature_url es obligatorio' }, { status: 422 });
    }

    const pay = await querySingle<any>(`SELECT id, status FROM worker_event_pay WHERE id = $1`, [params.id]);
    if (!pay) return NextResponse.json({ success: false, error: 'Pago no encontrado' }, { status: 404 });
    if (pay.status !== 'paid') {
      return NextResponse.json({ success: false, error: 'Solo se puede firmar un pago ya abonado' }, { status: 400 });
    }

    const updated = await querySingle<any>(
      `UPDATE worker_event_pay
       SET signature_url = $1, signed_by = $2, signed_at = now()
       WHERE id = $3 RETURNING id, status, signature_url, signed_at, signed_by`,
      [signature_url, signed_by || null, params.id]
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
