import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { generateProductionSheet } from '@/lib/cocinaSheets';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const pool = getPool();
    const { eventId } = await params;

    // Verify event exists
    const eventResult = await pool.query(
      `SELECT id, client_name AS name, status FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventResult.rowCount === 0) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const sheet = await generateProductionSheet(eventId);

    // Obtener recetas con sus pasos de elaboración
    const recipesResult = await pool.query(
      `SELECT DISTINCT r.id, r.name, r.preparation_steps
       FROM escandallos e
       JOIN escandallo_lines el ON el.escandallo_id = e.id
       JOIN recipes r ON r.catalog_item_id = el.catalog_item_id
       WHERE e.event_id = $1 AND r.preparation_steps IS NOT NULL AND jsonb_array_length(r.preparation_steps) > 0`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      data: { event: eventResult.rows[0], sheet, recipes: recipesResult.rows },
    });
  } catch (error) {
    console.error('Error generating production sheet:', error);
    return NextResponse.json(
      { success: false, error: 'Error al generar hoja de producción' },
      { status: 500 }
    );
  }
}