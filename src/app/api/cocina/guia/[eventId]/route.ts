/**
 * EventFlow — Guía de cocina del evento (venue-aware)  ·  FR-C01…C09 / FR-A07
 * GET /api/cocina/guia/[eventId]
 *
 * Devuelve TODO el funcionamiento de cocina del evento (antes y después),
 * condicionado por la ubicación (local Benítez vs externo).
 */
import { NextRequest, NextResponse } from 'next/server';
import { buildCocinaGuia } from '@/lib/cocinaGuia';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const guia = await buildCocinaGuia(params.eventId);
    if (!guia) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: guia });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
