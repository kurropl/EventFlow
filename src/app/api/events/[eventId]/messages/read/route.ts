/**
 * EventFlow — Mark Messages as Read API (WP-30)
 * POST /api/events/[eventId]/messages/read — Marcar mensajes como leídos
 *
 * Endpoint autenticado (JWT admin) para marcar mensajes del cliente como leídos.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';

// ============================================================
// POST — Marcar mensajes como leídos
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    if (!isValidUUID(eventId)) {
      return NextResponse.json(
        { success: false, error: 'ID de evento inválido' },
        { status: 422 }
      );
    }

    const body = await request.json();
    const { message_ids, sender } = body;

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let updatedCount = 0;

      if (message_ids && Array.isArray(message_ids) && message_ids.length > 0) {
        // Marcar mensajes específicos como leídos
        const validIds = message_ids.filter((id: string) => isValidUUID(id));
        if (validIds.length > 0) {
          const placeholders = validIds.map((_: string, i: number) => `$${i + 2}`).join(',');
          const result = await client.query(
            `UPDATE event_messages 
             SET read_at = now() 
             WHERE event_id = $1 
               AND id IN (${placeholders})
               AND read_at IS NULL`,
            [eventId, ...validIds]
          );
          updatedCount = result.rowCount || 0;
        }
      } else if (sender && ['cliente', 'equipo'].includes(sender)) {
        // Marcar todos los mensajes de un sender como leídos
        const result = await client.query(
          `UPDATE event_messages 
           SET read_at = now() 
           WHERE event_id = $1 
             AND sender = $2 
             AND read_at IS NULL`,
          [eventId, sender]
        );
        updatedCount = result.rowCount || 0;
      } else {
        // Marcar todos los mensajes no leídos como leídos
        const result = await client.query(
          `UPDATE event_messages 
           SET read_at = now() 
           WHERE event_id = $1 
             AND read_at IS NULL`,
          [eventId]
        );
        updatedCount = result.rowCount || 0;
      }

      await client.query('COMMIT');

      // Obtener contadores actualizados
      const unreadCounts = await client.query(
        `SELECT 
          COUNT(*) FILTER (WHERE sender = 'cliente' AND read_at IS NULL) AS unread_from_cliente,
          COUNT(*) FILTER (WHERE sender = 'equipo' AND read_at IS NULL) AS unread_from_equipo
         FROM event_messages 
         WHERE event_id = $1`,
        [eventId]
      );

      return NextResponse.json({
        success: true,
        data: {
          updated: updatedCount,
          unread: {
            from_cliente: unreadCounts.rows[0]?.unread_from_cliente || 0,
            from_equipo: unreadCounts.rows[0]?.unread_from_equipo || 0,
          },
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
