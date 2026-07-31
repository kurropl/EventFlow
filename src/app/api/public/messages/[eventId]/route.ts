/**
 * EventFlow — Public Messages API (WP-30)
 * POST /api/public/messages/[eventId] — Enviar mensaje desde el portal del cliente
 *
 * Endpoint público (sin JWT). El cliente se autentica con su email registrado en el evento.
 * Retorna mensaje enviado y actualiza la interacción CRM.
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';

// ============================================================
// POST — Enviar mensaje del cliente
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
    const { email, body: messageBody, sender_name } = body;

    // Validaciones
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email es obligatorio' },
        { status: 422 }
      );
    }

    if (!messageBody || typeof messageBody !== 'string' || messageBody.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'El mensaje no puede estar vacío' },
        { status: 422 }
      );
    }

    const sanitizedBody = sanitizeText(messageBody.trim(), 2000);
    const normalizedEmail = email.toLowerCase().trim();

    // Verificar que el evento existe y el email coincide
    const event = await querySingle<any>(
      `SELECT id, client_name, client_email, client_id, lead_id
       FROM events 
       WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el email coincide (case-insensitive)
    const eventEmail = (event.client_email || '').toLowerCase().trim();
    if (eventEmail !== normalizedEmail) {
      return NextResponse.json(
        { success: false, error: 'Email no autorizado para este evento' },
        { status: 403 }
      );
    }

    // Insertar mensaje del cliente
    const message = await querySingle<any>(
      `INSERT INTO event_messages (event_id, sender, sender_name, body)
       VALUES ($1, 'cliente', $2, $3)
       RETURNING *`,
      [
        eventId,
        sender_name || event.client_name || 'Cliente',
        sanitizedBody,
      ]
    );

    // Crear interacción CRM automáticamente
    try {
      // Buscar lead_id del evento (si existe)
      const leadId = event.lead_id;
      const clientId = event.client_id;

      if (leadId || clientId) {
        await querySingle<any>(
          `INSERT INTO interactions (lead_id, event_id, type, notes, created_by)
           VALUES ($1, $2, 'nota', $3, NULL)`,
          [
            leadId || null,
            eventId,
            `[Mensaje del cliente] ${sanitizedBody}`,
          ]
        );
      }
    } catch (interactionError) {
      // No fallar si la interacción CRM falla, pero registrar
      console.error('[messages] Error creando interacción CRM:', interactionError);
    }

    return NextResponse.json({
      success: true,
      data: message,
      message: 'Mensaje enviado correctamente',
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// GET — Listar mensajes del cliente (solo los suyos)
// ============================================================

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email es obligatorio' },
        { status: 422 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verificar que el email coincide
    const event = await querySingle<any>(
      `SELECT id, client_email FROM events WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    const eventEmail = (event.client_email || '').toLowerCase().trim();
    if (eventEmail !== normalizedEmail) {
      return NextResponse.json(
        { success: false, error: 'Email no autorizado' },
        { status: 403 }
      );
    }

    // Obtener mensajes
    const messages = await queryMany<any>(
      `SELECT 
        em.id,
        em.sender,
        em.sender_name,
        em.body,
        em.read_at,
        em.created_at
       FROM event_messages em
       WHERE em.event_id = $1
       ORDER BY em.created_at DESC`,
      [eventId]
    );

    // Contar no leídos del equipo
    const unreadFromEquipo = await querySingle<any>(
      `SELECT COUNT(*)::INT AS count
       FROM event_messages 
       WHERE event_id = $1 AND sender = 'equipo' AND read_at IS NULL`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      data: {
        messages,
        unread_from_equipo: unreadFromEquipo?.count || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
