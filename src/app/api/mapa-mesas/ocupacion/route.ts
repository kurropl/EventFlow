/**
 * GET /api/mapa-mesas/ocupacion — Resumen de ocupación de todos los eventos activos
 * Devuelve: evento, mesas totales, plazas totales, ocupados, libres, % ocupación
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(_req: NextRequest) {
  try {
    // Eventos activos con planos de mesas
    const result = await query(
      `SELECT e.id, e.client_name, e.event_date, e.guest_count, e.status,
              ef.data, ef.name as plan_name,
              (SELECT COUNT(*) FROM table_assignments ta WHERE ta.event_id = e.id) as assigned_count
       FROM events e
       LEFT JOIN event_floorplans ef ON ef.event_id = e.id
       WHERE e.status NOT IN ('lost', 'cancelled')
       ORDER BY e.event_date ASC`
    );

    const events = (result.rows || []).map((row: any) => {
      const data = row.data || {};
      const tables: Array<{ seats: number; occupied: number }> = data.tables || [];
      const totalSeats = tables.reduce((s: number, t: any) => s + (t.seats || 0), 0);
      const totalOccupied = tables.reduce((s: number, t: any) => s + (t.occupied || 0), 0);
      const assignedCount = Number(row.assigned_count) || 0;

      return {
        id: row.id,
        clientName: row.client_name,
        eventDate: row.event_date,
        guestCount: Number(row.guest_count) || 0,
        status: row.status,
        planName: row.plan_name || null,
        hasPlan: !!row.data,
        totalTables: tables.length,
        totalSeats,
        occupiedSeats: totalOccupied,
        freeSeats: totalSeats - totalOccupied,
        assignedGuests: assignedCount,
        occupancyPct: totalSeats > 0 ? Math.round((totalOccupied / totalSeats) * 100) : 0,
      };
    });

    return NextResponse.json({
      success: true,
      data: events,
      totals: {
        events: events.length,
        eventsWithPlan: events.filter((e: any) => e.hasPlan).length,
        totalSeats: events.reduce((s: number, e: any) => s + e.totalSeats, 0),
        totalOccupied: events.reduce((s: number, e: any) => s + e.occupiedSeats, 0),
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}