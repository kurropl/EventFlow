/**
 * GET /api/mapa-mesas/[eventId]/assignments — Listar asignaciones
 * PUT /api/mapa-mesas/[eventId]/assignments — Guardar asignaciones
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const result = await query(
      `SELECT ta.id, ta.table_id, ta.guest_id, ta.guest_name, ta.seat_number, ta.dietary_notes,
              g.dietary
       FROM table_assignments ta
       LEFT JOIN guests g ON g.id = ta.guest_id
       WHERE ta.event_id = $1
       ORDER BY ta.table_id, ta.seat_number`,
      [params.eventId]
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const body = await req.json();
    const { assignments } = body;

    if (!Array.isArray(assignments)) {
      return NextResponse.json({ success: false, error: 'assignments debe ser un array' }, { status: 400 });
    }

    await query('DELETE FROM table_assignments WHERE event_id = $1', [params.eventId]);

    for (const a of assignments) {
      await query(
        `INSERT INTO table_assignments (event_id, table_id, guest_id, guest_name, seat_number, dietary_notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [params.eventId, a.table_id, a.guest_id || null, a.guest_name, a.seat_number || 0, a.dietary_notes || null]
      );
    }

    // Actualizar contadores de ocupados en el mapa
    const occupiedMap: Record<string, number> = {};
    for (const a of assignments) {
      occupiedMap[a.table_id] = (occupiedMap[a.table_id] || 0) + 1;
    }

    const floorResult = await query(
      `SELECT data FROM event_floorplans WHERE event_id = $1 LIMIT 1`,
      [params.eventId]
    );

    if (floorResult.rows.length > 0) {
      const data: any = floorResult.rows[0].data;
      if (data?.tables) {
        for (const tbl of data.tables) {
          tbl.occupied = occupiedMap[tbl.id] || 0;
        }
        await query(
          `UPDATE event_floorplans SET data = $1::jsonb, updated_at = NOW() WHERE event_id = $2`,
          [JSON.stringify(data), params.eventId]
        );
      }
    }

    return NextResponse.json({ success: true, count: assignments.length });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}