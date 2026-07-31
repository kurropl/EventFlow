/**
 * PUT /api/public/portal/[token]/tables/assignments
 *
 * Guarda las asignaciones de invitados a mesas desde el portal del cliente.
 * Valida: solo confirmados, aforo no superable, portal no congelado.
 * Emite portal.updated.
 *
 * WP-27: Portal — Distribución de Mesas
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, querySingle, getPool } from '@/lib/db';
import { withPortalAuth, touchPortalAccess } from '@/lib/portal-auth';
import { sanitizeError } from '@/lib/security';

interface AssignmentInput {
  tableId: string;
  guestId: string;
  seatNumber?: number;
}

export async function PUT(
  req: NextRequest,
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

    // Portal congelado → solo lectura
    if (ctx.isFrozen) {
      return NextResponse.json(
        { success: false, error: 'El portal está congelado. No se permiten cambios.' },
        { status: 423 }
      );
    }

    await touchPortalAccess(ctx.portalId);

    const body = await req.json();
    const { assignments } = body as { assignments: AssignmentInput[] };

    if (!Array.isArray(assignments)) {
      return NextResponse.json(
        { success: false, error: 'assignments debe ser un array' },
        { status: 400 }
      );
    }

    // ── Validar que todos los guest_id son confirmados ──
    const guestIds = assignments.map(a => a.guestId).filter(Boolean);
    if (guestIds.length > 0) {
      const validGuests = await query<{ id: string }>(
        `SELECT id FROM guests
         WHERE event_id = $1 AND id = ANY($2::uuid[]) AND rsvp = 'confirmado'`,
        [ctx.eventId, guestIds]
      );
      const validIds = new Set(validGuests.map(g => g.id));

      for (const a of assignments) {
        if (!validIds.has(a.guestId)) {
          return NextResponse.json(
            {
              success: false,
              error: `El invitado ${a.guestId} no está confirmado y no puede ser asignado.`,
            },
            { status: 422 }
          );
        }
      }
    }

    // ── Validar aforo de mesa ──
    // Cargar capacidad de mesas desde el plano
    const floorResult = await querySingle<{ data: any }>(
      `SELECT data FROM event_floorplans WHERE event_id = $1 LIMIT 1`,
      [ctx.eventId]
    );
    const tables = floorResult?.data?.tables || [];
    const seatMap: Record<string, number> = {};
    for (const t of tables) {
      seatMap[t.id] = t.seats || 0;
    }

    // Contar asignaciones por mesa (agrupando las del body)
    const countByTable: Record<string, number> = {};
    for (const a of assignments) {
      countByTable[a.tableId] = (countByTable[a.tableId] || 0) + 1;
    }

    // Verificar que ninguna mesa supera su aforo
    for (const [tableId, count] of Object.entries(countByTable)) {
      const capacity = seatMap[tableId];
      if (capacity && count > capacity) {
        return NextResponse.json(
          {
            success: false,
            error: `La mesa ${tableId} tiene aforo máximo de ${capacity} y se intentan asignar ${count}.`,
          },
          { status: 422 }
        );
      }
    }

    // ── Guardar en transacción ──
    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Limpiar asignaciones previas del evento
      await client.query(
        'DELETE FROM table_assignments WHERE event_id = $1',
        [ctx.eventId]
      );

      // Insertar nuevas asignaciones
      let seatCounter: Record<string, number> = {};
      for (const a of assignments) {
        seatCounter[a.tableId] = (seatCounter[a.tableId] || 0) + 1;
        const seatNum = a.seatNumber || seatCounter[a.tableId];

        // Obtener nombre del invitado
        const guest = await querySingle<{ name: string }>(
          'SELECT name FROM guests WHERE id = $1',
          [a.guestId]
        );

        await client.query(
          `INSERT INTO table_assignments
             (event_id, table_id, guest_id, guest_name, seat_number)
           VALUES ($1, $2, $3, $4, $5)`,
          [ctx.eventId, a.tableId, a.guestId, guest?.name || '', seatNum]
        );
      }

      // Actualizar contadores de ocupados en el mapa
      const data = floorResult?.data;
      if (data?.tables) {
        for (const tbl of data.tables) {
          tbl.occupied = countByTable[tbl.id] || 0;
        }
        await client.query(
          `UPDATE event_floorplans SET data = $1::jsonb, updated_at = NOW() WHERE event_id = $2`,
          [JSON.stringify(data), ctx.eventId]
        );
      }

      // Emitir portal.updated
      try {
        const { emitDomainEvent } = await import('@/domain/events');
        await emitDomainEvent(
          client,
          'portal.updated',
          'event',
          ctx.eventId,
          {
            section: 'tables',
            summary: `${assignments.length} invitados asignados a mesas`,
            portal_id: ctx.portalId,
          }
        );
      } catch (eventError) {
        console.error('[portal-tables] Error emitiendo portal.updated:', eventError);
        // No fallar la request por error de evento
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        count: assignments.length,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (e: unknown) {
    return NextResponse.json(
      { success: false, error: sanitizeError(e) },
      { status: 500 }
    );
  }
}
