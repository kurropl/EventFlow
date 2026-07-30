/**
 * EventFlow — WP-23: Hitos de pago de un evento
 * GET /api/events/[id]/milestones — Lista hitos con estado de facturación
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, getPool } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { getMilestonesWithInvoiceStatus } from '@/lib/domain/invoiceByMilestone';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'event id inválido' }, { status: 422 });
    }

    // Verificar que el evento existe
    const event = await querySingle<any>(
      `SELECT id, client_name, status FROM events WHERE id = $1`,
      [params.id]
    );
    if (!event) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }

    const pool = getPool();
    const milestones = await getMilestonesWithInvoiceStatus(pool as any, params.id);

    return NextResponse.json({
      success: true,
      data: milestones,
      event: { id: event.id, client_name: event.client_name, status: event.status },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
