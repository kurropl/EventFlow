/**
 * EventFlow — Close Event API
 * POST /api/events/[id]/close  { invoiceAmount?: number }
 *
 * Delega en domain/closeEvent.ts (SPEC Sprint 4, G16) — única
 * implementación de "cerrar un evento", compartida con FWD-4
 * (transitions/route.ts). E-B5: facturación parcial explícita — si no se
 * indica `invoiceAmount`, factura Σ(payments.paid=true) sin forzar nada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError } from '@/lib/security';
import { closeEvent, CloseEventError } from '@/lib/domain/closeEvent';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }
    const body = await req.json().catch(() => ({}));
    const invoiceAmount = typeof body?.invoiceAmount === 'number' ? body.invoiceAmount : undefined;

    const result = await closeEvent(eventId, { invoiceAmount });

    return NextResponse.json({
      success: true,
      data: { results: result.effects },
      message: 'Evento cerrado correctamente',
    });
  } catch (e: unknown) {
    if (e instanceof CloseEventError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
