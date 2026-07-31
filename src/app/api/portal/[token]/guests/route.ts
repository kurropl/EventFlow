/**
 * EventFlow — Portal Guests API
 * GET    /api/portal/[token]/guests      — Ver invitados del evento
 * POST   /api/portal/[token]/guests      — Crear invitado
 * PUT    /api/portal/[token]/guests      — Editar invitado
 * DELETE /api/portal/[token]/guests      — Eliminar invitado(s)
 *
 * WP-26: Portal — Invitados y RSVP
 * Acceso: cliente con token válido (client_token de events)
 * Sincronización directa con tabla guests (misma que Sala)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, getPool } from '@/lib/db';
import { sanitizeError, securityHeaders } from '@/lib/security';
import { emitDomainEventStandalone } from '@/domain/events';

export const dynamic = 'force-dynamic';

// ============================================================
// Types
// ============================================================

interface GuestInput {
  id?: string; // Para PUT
  name: string;
  group_name?: string | null;
  rsvp?: string; // pendiente | confirmado | rechazado
  menu_type?: string; // adulto | nino | bebe
  dietary?: string[]; // Array de strings
  notes?: string | null;
}

interface PortalGuest {
  id: string;
  event_id: string;
  name: string;
  group_name: string | null;
  rsvp: string;
  menu_type: string;
  dietary: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Resolve token to event_id (same as extras route for consistency)
 */
async function resolveTokenToEventId(token: string): Promise<{
  eventId: string;
  portalId: number | null;
  status: string;
} | null> {
  // Check client_portals table (WP-25)
  const portal = await querySingle<{
    event_id: string;
    id: number;
    status: string;
  }>(
    `SELECT event_id, id, status FROM client_portals WHERE access_token = $1`,
    [token]
  );
  if (portal) {
    return {
      eventId: portal.event_id,
      portalId: portal.id,
      status: portal.status,
    };
  }

  // Fallback: check events.client_token for backward compatibility
  const event = await querySingle<{ id: string }>(
    `SELECT id FROM events WHERE client_token = $1`,
    [token]
  );
  if (event) {
    return { eventId: event.id, portalId: null, status: 'activo' };
  }

  return null;
}

/**
 * Check if portal is frozen
 */
async function isPortalFrozen(eventId: string): Promise<boolean> {
  const portal = await querySingle<{ status: string; freeze_date: string }>(
    `SELECT status, freeze_date::text FROM client_portals WHERE event_id = $1`,
    [eventId]
  );
  if (!portal) return false;
  if (portal.status === 'congelado' || portal.status === 'cerrado') return true;
  if (portal.freeze_date && new Date(portal.freeze_date) <= new Date()) return true;
  return false;
}

/**
 * Emit portal.updated event
 */
async function emitPortalUpdated(
  eventId: string,
  section: string,
  summary: string
): Promise<void> {
  try {
    await emitDomainEventStandalone('portal.updated', 'event', eventId, {
      section,
      summary,
    });
  } catch (error) {
    console.error('[portal-guests] Failed to emit portal.updated:', error);
    // Non-blocking: don't fail the request if event emission fails
  }
}

/**
 * Validate guest input
 */
function validateGuestInput(input: GuestInput): string | null {
  if (!input.name || input.name.trim().length === 0) {
    return 'El nombre del invitado es obligatorio';
  }
  if (input.name.length > 200) {
    return 'El nombre no puede exceder 200 caracteres';
  }
  if (input.rsvp && !['pendiente', 'confirmado', 'rechazado'].includes(input.rsvp)) {
    return 'RSVP inválido. Valores válidos: pendiente, confirmado, rechazado';
  }
  if (input.menu_type && !['adulto', 'nino', 'bebe'].includes(input.menu_type)) {
    return 'Tipo de menú inválido. Valores válidos: adulto, nino, bebe';
  }
  if (input.group_name && input.group_name.length > 100) {
    return 'El nombre del grupo no puede exceder 100 caracteres';
  }
  if (input.notes && input.notes.length > 1000) {
    return 'Las notas no pueden exceder 1000 caracteres';
  }
  return null;
}

// ============================================================
// GET: List guests
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const auth = await resolveTokenToEventId(token);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido o expirado' },
        { status: 401, headers: securityHeaders() }
      );
    }

    const guests = await queryMany<PortalGuest>(
      `SELECT id, event_id, name, group_name, rsvp, menu_type, dietary, notes,
              created_at::text, updated_at::text
       FROM guests
       WHERE event_id = $1
       ORDER BY group_name NULLS LAST, name ASC`,
      [auth.eventId]
    );

    // Normalize dietary JSONB
    const normalizedGuests = guests.map((g) => ({
      ...g,
      dietary: Array.isArray(g.dietary) ? g.dietary : [],
    }));

    // Get stats
    const stats = await querySingle<{
      total: number;
      confirmed: number;
      pending: number;
      declined: number;
    }>(
      `SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE rsvp = 'confirmado')::int as confirmed,
        COUNT(*) FILTER (WHERE rsvp = 'pendiente')::int as pending,
        COUNT(*) FILTER (WHERE rsvp = 'rechazado')::int as declined
       FROM guests
       WHERE event_id = $1`,
      [auth.eventId]
    );

    // Get consolidated dietary info
    const dietaryStats = await queryMany<{ dietary: string; count: number }>(
      `SELECT
        jsonb_array_elements_text(dietary) as dietary,
        COUNT(*)::int as count
       FROM guests
       WHERE event_id = $1 AND jsonb_array_length(dietary) > 0
       GROUP BY dietary
       ORDER BY count DESC`,
      [auth.eventId]
    );

    return NextResponse.json(
      {
        success: true,
        data: normalizedGuests,
        stats: stats || { total: 0, confirmed: 0, pending: 0, declined: 0 },
        dietary_summary: dietaryStats,
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    console.error('[portal-guests GET]', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}

// ============================================================
// POST: Create guest
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const auth = await resolveTokenToEventId(token);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido o expirado' },
        { status: 401, headers: securityHeaders() }
      );
    }

    // Check if frozen
    if (await isPortalFrozen(auth.eventId)) {
      return NextResponse.json(
        { success: false, error: 'Portal congelado. No se pueden agregar invitados.' },
        { status: 423, headers: securityHeaders() }
      );
    }

    const body = await request.json();
    const input: GuestInput = body;

    // Validate input
    const validationError = validateGuestInput(input);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400, headers: securityHeaders() }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query<PortalGuest>(
        `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, event_id, name, group_name, rsvp, menu_type, dietary, notes,
                   created_at::text, updated_at::text`,
        [
          auth.eventId,
          input.name.trim(),
          input.group_name?.trim() || null,
          input.rsvp || 'pendiente',
          input.menu_type || 'adulto',
          JSON.stringify(input.dietary || []),
          input.notes?.trim() || null,
        ]
      );

      await client.query('COMMIT');

      const guest = result.rows[0];

      // Emit domain event
      await emitPortalUpdated(
        auth.eventId,
        'guests',
        `Invitado "${guest.name}" agregado`
      );

      return NextResponse.json(
        {
          success: true,
          data: {
            ...guest,
            dietary: Array.isArray(guest.dietary) ? guest.dietary : [],
          },
        },
        { headers: securityHeaders() }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[portal-guests POST]', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}

// ============================================================
// PUT: Update guest
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const auth = await resolveTokenToEventId(token);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido o expirado' },
        { status: 401, headers: securityHeaders() }
      );
    }

    // Check if frozen
    if (await isPortalFrozen(auth.eventId)) {
      return NextResponse.json(
        { success: false, error: 'Portal congelado. No se pueden modificar invitados.' },
        { status: 423, headers: securityHeaders() }
      );
    }

    const body = await request.json();
    const input: GuestInput = body;

    if (!input.id) {
      return NextResponse.json(
        { success: false, error: 'ID del invitado requerido para actualización' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Validate input
    const validationError = validateGuestInput(input);
    if (validationError) {
      return NextResponse.json(
        { success: false, error: validationError },
        { status: 400, headers: securityHeaders() }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check guest exists and belongs to this event
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM guests WHERE id = $1 AND event_id = $2`,
        [input.id, auth.eventId]
      );

      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Invitado no encontrado' },
          { status: 404, headers: securityHeaders() }
        );
      }

      const result = await client.query<PortalGuest>(
        `UPDATE guests
         SET name = $1,
             group_name = $2,
             rsvp = $3,
             menu_type = $4,
             dietary = $5,
             notes = $6
         WHERE id = $7 AND event_id = $8
         RETURNING id, event_id, name, group_name, rsvp, menu_type, dietary, notes,
                   created_at::text, updated_at::text`,
        [
          input.name.trim(),
          input.group_name?.trim() || null,
          input.rsvp || 'pendiente',
          input.menu_type || 'adulto',
          JSON.stringify(input.dietary || []),
          input.notes?.trim() || null,
          input.id,
          auth.eventId,
        ]
      );

      await client.query('COMMIT');

      const guest = result.rows[0];

      // Emit domain event
      await emitPortalUpdated(
        auth.eventId,
        'guests',
        `Invitado "${guest.name}" actualizado`
      );

      return NextResponse.json(
        {
          success: true,
          data: {
            ...guest,
            dietary: Array.isArray(guest.dietary) ? guest.dietary : [],
          },
        },
        { headers: securityHeaders() }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[portal-guests PUT]', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}

// ============================================================
// DELETE: Delete guest(s)
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const auth = await resolveTokenToEventId(token);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido o expirado' },
        { status: 401, headers: securityHeaders() }
      );
    }

    // Check if frozen
    if (await isPortalFrozen(auth.eventId)) {
      return NextResponse.json(
        { success: false, error: 'Portal congelado. No se pueden eliminar invitados.' },
        { status: 423, headers: securityHeaders() }
      );
    }

    // Get IDs from query params or body
    const url = new URL(request.url);
    let guestIds: string[] = [];

    // Try query params first
    const idsParam = url.searchParams.get('ids');
    if (idsParam) {
      guestIds = idsParam.split(',').filter(Boolean);
    }

    // If no query params, try body
    if (guestIds.length === 0) {
      try {
        const body = await request.json();
        guestIds = body.ids || (body.id ? [body.id] : []);
      } catch {
        // No body or invalid JSON
      }
    }

    if (guestIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'IDs de invitados requeridos' },
        { status: 400, headers: securityHeaders() }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get names before delete for event summary
      const guestsToDelete = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM guests WHERE id = ANY($1) AND event_id = $2`,
        [guestIds, auth.eventId]
      );

      if (guestsToDelete.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Ningún invitado encontrado' },
          { status: 404, headers: securityHeaders() }
        );
      }

      // Delete guests (also deletes table_assignments via FK ON DELETE SET NULL)
      await client.query(
        `DELETE FROM guests WHERE id = ANY($1) AND event_id = $2`,
        [guestIds, auth.eventId]
      );

      await client.query('COMMIT');

      const deletedNames = guestsToDelete.rows.map((g) => g.name);

      // Emit domain event
      await emitPortalUpdated(
        auth.eventId,
        'guests',
        deletedNames.length === 1
          ? `Invitado "${deletedNames[0]}" eliminado`
          : `${deletedNames.length} invitados eliminados`
      );

      return NextResponse.json(
        {
          success: true,
          deleted: deletedNames.length,
          names: deletedNames,
        },
        { headers: securityHeaders() }
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[portal-guests DELETE]', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}
