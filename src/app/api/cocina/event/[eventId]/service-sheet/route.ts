/**
 * GET /api/cocina/event/[eventId]/service-sheet — Hoja de Servicio del evento
 *
 * Devuelve los datos completos de la hoja de servicio:
 * - Timing / Cronograma
 * - Distribución por zonas (mesas + invitados)
 * - Turnos confirmados (staffing)
 * - Dietas especiales
 *
 * Accesible a todos los roles operativos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateServiceSheet } from '@/lib/serviceSheet';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'eventId es obligatorio' },
        { status: 400 }
      );
    }

    const sheet = await generateServiceSheet(eventId);

    if (!sheet) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: sheet });
  } catch (error) {
    console.error('Error generating service sheet:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar hoja de servicio' },
      { status: 500 }
    );
  }
}
