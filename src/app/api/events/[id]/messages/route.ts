/**
 * EventFlow — Event Messages API (WP-30)
 * GET  /api/events/[id]/messages — Listar mensajes del evento
 * POST /api/events/[id]/messages — Enviar mensaje del equipo
 *
 * Endpoint autenticado (JWT admin) para el equipo.
 * El cliente usa /api/public/messages/[id] con token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';
import { getCurrentUser } from '@/lib/auth';

// ============================================================
// GET — Listar mensajes del evento
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID de evento inválido' },
        { status: 422 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread') === 'true';
    const sender = searchParams.get('sender'); // 'cliente' | 'equipo' | null (todos)

    let query = `
      SELECT 
        em.id,
        em.event_id,
        em.sender,
        em.sender_name,
        em.body,
        em.read_at,
        em.created_by,
        em.created_at,
        a.name AS admin_name
      FROM event_messages em
      LEFT JOIN admins a ON a.id = em.created_by
      WHERE em.event_id = $1
    `;
    const qparams: any[] = [id];

    if (sender && ['cliente', 'equipo'].includes(sender)) {
      query += ` AND em.sender = $${qparams.length + 1}`;
      qparams.push(sender);
    }

    if (unreadOnly) {
      query += ` AND em.read_at IS NULL`;
    }

    query += ` ORDER BY em.created_at DESC`;

    const messages = await queryMany<any>(query, qparams);

    // Contadores de no leídos
    const unreadCounts = await querySingle<any>(
      `SELECT 
        COUNT(*) FILTER (WHERE sender = 'cliente' AND read_at IS NULL) AS unread_from_cliente,
        COUNT(*) FILTER (WHERE sender = 'equipo' AND read_at IS NULL) AS unread_from_equipo
       FROM event_messages 
       WHERE event_id = $1`,
      [id]
    );

    return NextResponse.json({
      success: true,
      data: {
        messages,
        unread: {
          from_cliente: unreadCounts?.unread_from_cliente || 0,
          from_equipo: unreadCounts?.unread_from_equipo || 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// POST — Enviar mensaje del equipo
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID de evento inválido' },
        { status: 422 }
      );
    }

    const body = await request.json();
    const { body: messageBody, sender_name } = body;

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'El mensaje no puede estar vacío' },
        { status: 422 }
      );
    }

    const sanitizedBody = sanitizeText(messageBody.trim(), 2000);

    // Obtener usuario actual (admin autenticado)
    const currentUser = await getCurrentUser();
    const createdBy = currentUser?.id && isValidUUID(currentUser.id) ? currentUser.id : null;

    // Insertar mensaje
    const message = await querySingle<any>(
      `INSERT INTO event_messages (event_id, sender, sender_name, body, created_by)
       VALUES ($1, 'equipo', $2, $3, $4)
       RETURNING *`,
      [
        id,
        sender_name || currentUser?.name || 'Equipo',
        sanitizedBody,
        createdBy,
      ]
    );

    return NextResponse.json({ success: true, data: message }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
