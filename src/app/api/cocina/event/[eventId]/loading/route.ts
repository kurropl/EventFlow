import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { generateLoadingSheet } from '@/lib/cocinaSheets';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const pool = getPool();
    const { eventId } = await params;

    // Verify event exists
    const eventResult = await pool.query(
      `SELECT id, name, status FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventResult.rowCount === 0) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const sheet = await generateLoadingSheet(eventId);

    return NextResponse.json({
      event: eventResult.rows[0],
      sheet,
    });
  } catch (error) {
    console.error('Error generating loading sheet:', error);
    return NextResponse.json(
      { error: 'Error al generar hoja de carga' },
      { status: 500 }
    );
  }
}