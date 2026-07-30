/**
 * EventFlow — API de Vajilla  ·  WP-20
 * GET /api/cocina/event/[eventId]/vajilla — Necesidades de vajilla para un evento
 */

import { NextRequest, NextResponse } from 'next/server';
import { calculateVajilla } from '@/lib/vajilla';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const result = await calculateVajilla(eventId);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado o sin datos de vajilla' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error calculating vajilla:', error);
    return NextResponse.json(
      { success: false, error: 'Error al calcular necesidades de vajilla' },
      { status: 500 }
    );
  }
}
