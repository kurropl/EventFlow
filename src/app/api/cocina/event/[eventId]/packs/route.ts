/**
 * EventFlow — API de Packs  ·  WP-20
 * GET /api/cocina/event/[eventId]/packs — Packs necesarios para un evento
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculatePacks, getEventDietarySummary } from '@/lib/packs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const [packs, dietarySummary] = await Promise.all([
      calculatePacks(eventId),
      getEventDietarySummary(eventId),
    ]);

    if (!packs) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado o sin datos de packs' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...packs,
        dietary_summary: dietarySummary,
      },
    });
  } catch (error) {
    console.error('Error calculating packs:', error);
    return NextResponse.json(
      { success: false, error: 'Error al calcular packs' },
      { status: 500 }
    );
  }
}
