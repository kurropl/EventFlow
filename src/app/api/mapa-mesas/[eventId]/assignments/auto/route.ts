/**
 * POST /api/mapa-mesas/[eventId]/assignments/auto
 * Auto-asigna invitados confirmados a las mesas disponibles
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function POST(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    // Obtener invitados confirmados (columna real: rsvp, no `status` — T6.3)
    const guestsResult = await query(
      `SELECT id, name FROM guests
       WHERE event_id = $1 AND rsvp = 'confirmado'
       ORDER BY random()`,
      [params.eventId]
    );

    // Obtener mesas del plano
    const floorResult = await query(
      `SELECT data, name FROM event_floorplans WHERE event_id = $1 LIMIT 1`,
      [params.eventId]
    );

    if (floorResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay plano de mesas' }, { status: 400 });
    }

    const row = floorResult.rows[0] as { data: any; name: string };
    const data = row.data;
    const tables: Array<{ id: string; seats: number; label: string }> =
      (data?.tables || []).sort((a: any, b: any) => b.seats - a.seats);

    if (tables.length === 0) {
      return NextResponse.json({ success: false, error: 'No hay mesas en el plano' }, { status: 400 });
    }

    const guests = guestsResult.rows as Array<{ id: string; name: string }>;
    let guestIdx = 0;
    const assignments: Array<{
      table_id: string;
      guest_id: string;
      guest_name: string;
      seat_number: number;
    }> = [];

    for (const table of tables) {
      for (let seat = 1; seat <= table.seats && guestIdx < guests.length; seat++) {
        assignments.push({
          table_id: table.id,
          guest_id: guests[guestIdx].id,
          guest_name: guests[guestIdx].name,
          seat_number: seat,
        });
        guestIdx++;
      }
    }

    // Limpiar y guardar
    await query('DELETE FROM table_assignments WHERE event_id = $1', [params.eventId]);

    for (const a of assignments) {
      await query(
        `INSERT INTO table_assignments (event_id, table_id, guest_id, guest_name, seat_number)
         VALUES ($1, $2, $3, $4, $5)`,
        [params.eventId, a.table_id, a.guest_id, a.guest_name, a.seat_number]
      );
    }

    // Actualizar contadores
    const occupiedMap: Record<string, number> = {};
    for (const a of assignments) {
      occupiedMap[a.table_id] = (occupiedMap[a.table_id] || 0) + 1;
    }
    if (data?.tables) {
      for (const tbl of data.tables) {
        tbl.occupied = occupiedMap[tbl.id] || 0;
      }
      await query(
        `UPDATE event_floorplans SET data = $1::jsonb, updated_at = NOW() WHERE event_id = $2`,
        [JSON.stringify(data), params.eventId]
      );
    }

    return NextResponse.json({
      success: true,
      count: assignments.length,
      totalGuests: guests.length,
      assigned: assignments.length,
      unassigned: guests.length - assignments.length,
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}