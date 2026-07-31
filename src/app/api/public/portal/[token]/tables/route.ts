/**
 * GET /api/public/portal/[token]/tables
 *
 * Devuelve el plano de mesas, invitados confirmados y asignaciones actuales
 * para el portal del cliente.
 *
 * WP-27: Portal — Distribución de Mesas
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, querySingle } from '@/lib/db';
import { withPortalAuth, touchPortalAccess } from '@/lib/portal-auth';
import { sanitizeError } from '@/lib/security';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const ctx = await withPortalAuth(token);

    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Token de portal inválido.' },
        { status: 404 }
      );
    }

    // Touch access timestamp
    await touchPortalAccess(ctx.portalId);

    // 1. Cargar plano del salón (solo lectura para el cliente)
    const floorResult = await querySingle<{ name: string; data: any; updated_at: string }>(
      `SELECT name, data, updated_at::text FROM event_floorplans WHERE event_id = $1 LIMIT 1`,
      [ctx.eventId]
    );

    const tables = floorResult?.data?.tables || [];
    const elements = floorResult?.data?.elements || [];
    const floorplanName = floorResult?.name || 'Salón de Celebraciones';

    // 2. Cargar invitados confirmados (los únicos asignables)
    const guestsResult = await query<{
      id: string;
      name: string;
      group_name: string | null;
      menu_type: string;
      dietary: any[];
      notes: string | null;
    }>(
      `SELECT id, name, group_name, menu_type, dietary, notes
       FROM guests
       WHERE event_id = $1 AND rsvp = 'confirmado'
       ORDER BY group_name NULLS LAST, name ASC`,
      [ctx.eventId]
    );

    // 3. Cargar asignaciones actuales
    const assignmentsResult = await query<{
      id: string;
      table_id: string;
      guest_id: string | null;
      guest_name: string;
      seat_number: number;
      dietary_notes: string | null;
    }>(
      `SELECT id, table_id, guest_id, guest_name, seat_number, dietary_notes
       FROM table_assignments
       WHERE event_id = $1
       ORDER BY table_id, seat_number`,
      [ctx.eventId]
    );

    // 4. Calcular ocupación por mesa
    const occupiedMap: Record<string, number> = {};
    for (const a of assignmentsResult.rows) {
      occupiedMap[a.table_id] = (occupiedMap[a.table_id] || 0) + 1;
    }

    // 5. Enriquecir mesas con ocupación
    const enrichedTables = tables.map((t: any) => ({
      ...t,
      occupied: occupiedMap[t.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      data: {
        eventId: ctx.eventId,
        floorplanName,
        tables: enrichedTables,
        elements,
        guests: guestsResult.rows.map(g => ({
          id: g.id,
          name: g.name,
          groupName: g.group_name,
          menuType: g.menu_type,
          dietary: g.dietary,
          notes: g.notes,
        })),
        assignments: assignmentsResult.rows.map(a => ({
          id: a.id,
          tableId: a.table_id,
          guestId: a.guest_id,
          guestName: a.guest_name,
          seatNumber: a.seat_number,
          dietaryNotes: a.dietary_notes,
        })),
        isFrozen: ctx.isFrozen,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: sanitizeError(e) },
      { status: 500 }
    );
  }
}
