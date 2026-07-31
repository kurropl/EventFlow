/**
 * EventFlow — Portal Menu API
 * GET /api/portal/[token]/menu — Ver menú congelado del evento
 *
 * Acceso: cliente con token válido (client_token de events)
 * Solo lectura: el cliente NO puede cambiar el menú.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validatePortalToken } from '@/lib/portal-auth';
import { getPortalMenu } from '@/domain/portal-menu';
import { sanitizeError, securityHeaders } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Autenticar portal
    const auth = await validatePortalToken(token);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido o expirado' },
        { status: 401, headers: securityHeaders() }
      );
    }

    // 2. Obtener menú congelado
    const menu = await getPortalMenu(auth.eventId);

    if (!menu) {
      return NextResponse.json(
        {
          success: false,
          error: 'Este evento no tiene un menú asignado aún.',
        },
        { status: 404, headers: securityHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ...menu,
          client_name: auth.clientName,
          event_date: auth.eventDate,
          is_frozen: auth.isFrozen,
        },
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}
