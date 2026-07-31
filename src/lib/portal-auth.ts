/**
 * EventFlow — Portal Authentication Helper
 *
 * Autentica peticiones del portal del cliente usando el client_token
 * que ya existe en la tabla events. No requiere la tabla client_portals
 * de WP-25; se puede integrar con ella cuando esté disponible.
 *
 * Patrón: mismo que /api/contract/public/[token]/ y /api/guest-forms/decor/
 */

import { querySingle } from '@/lib/db';
import { sanitizeText } from '@/lib/security';

export interface PortalAuthResult {
  eventId: string;
  clientName: string;
  eventDate: string;
  eventStatus: string;
  isFrozen: boolean;
}

/**
 * Valida un token de portal y devuelve el evento asociado.
 * @param token - El client_token del evento
 * @returns PortalAuthResult o null si el token no es válido
 */
export async function validatePortalToken(
  token: string
): Promise<PortalAuthResult | null> {
  const cleanToken = sanitizeText(token, 200);

  if (!cleanToken || cleanToken.length < 8) {
    return null;
  }

  const event = await querySingle<{
    id: string;
    client_name: string;
    event_date: string;
    status: string;
  }>(
    `SELECT id, client_name, event_date, status
     FROM events
     WHERE client_token = $1`,
    [cleanToken]
  );

  if (!event) {
    return null;
  }

  // Determinar si el portal está congelado
  // Un portal se congela 14 días antes del evento
  const eventDate = new Date(event.event_date);
  const freezeDate = new Date(eventDate);
  freezeDate.setDate(freezeDate.getDate() - 14);
  const isFrozen = new Date() >= freezeDate;

  return {
    eventId: event.id,
    clientName: event.client_name,
    eventDate: event.event_date,
    eventStatus: event.status,
    isFrozen,
  };
}

/**
 * Middleware wrapper para rutas del portal.
 * Si el token no es válido, retorna NextResponse con error.
 * Si es válido, retorna el contexto de autenticación.
 */
export async function withPortalAuth(
  token: string,
  handler: (auth: PortalAuthResult) => Promise<Response>
): Promise<Response> {
  const auth = await validatePortalToken(token);

  if (!auth) {
    return Response.json(
      { success: false, error: 'Enlace no válido o expirado' },
      { status: 401 }
    );
  }

  // Si el portal está congelado, solo permitir lectura
  return handler(auth);
}

/**
 * Verifica si el portal permite escritura (no congelado).
 * Retorna error 423 si está congelado.
 */
export function checkWritable(auth: PortalAuthResult): Response | null {
  if (auth.isFrozen) {
    return Response.json(
      {
        success: false,
        error: 'El portal está congelado. No se permiten modificaciones.',
        frozen: true,
      },
      { status: 423 }
    );
  }
  return null;
}
