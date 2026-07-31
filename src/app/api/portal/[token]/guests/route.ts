/**
 * EventFlow — Portal Guests API
 * GET /api/portal/[token]/guests — Ver invitados del evento
 *
 * Acceso: cliente con token válido (client_token de events)
 * Solo lectura desde el portal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validatePortalToken } from '@/lib/portal-auth';
import { queryMany } from '@/lib/db';
import { sanitizeError, securityHeaders } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const auth = await validatePortalToken(token);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido o expirado' },
        { status: 401, headers: securityHeaders() }
      );
    }

    const guests = await queryMany(
      `SELECT id, name, group_name, rsvp, menu_type, dietary, notes
       FROM guests
       WHERE event_id = $1
       ORDER BY group_name NULLS LAST, name ASC`,
      [auth.eventId]
    );

    return NextResponse.json(
      { success: true, data: guests },
      { headers: securityHeaders() }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}
