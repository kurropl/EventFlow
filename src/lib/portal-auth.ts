/**
 * EventFlow — Portal Auth Helper
 *
 * Resuelve token de portal → event_id.
 * Usado por todas las rutas del portal del cliente.
 *
 * WP-27: Portal — Distribución de Mesas
 */

import { querySingle } from '@/lib/db';

// ============================================================
// Types
// ============================================================

export interface PortalContext {
  eventId: string;
  portalId: number;
  status: string;
  freezeDate: string;
  isFrozen: boolean;
}

// ============================================================
// withPortalAuth — Resuelve token → event_id
// ============================================================

/**
 * Resuelve un token de portal y devuelve el contexto del evento.
 * Retorna null si el token es inválido.
 *
 * @param token - Token de acceso del portal (≥32 bytes)
 * @returns PortalContext o null si no existe
 */
export async function withPortalAuth(token: string): Promise<PortalContext | null> {
  if (!token || token.length < 10) {
    return null;
  }

  const portal = await querySingle<{
    id: number;
    event_id: string;
    status: string;
    freeze_date: string;
  }>(
    `SELECT id, event_id, status, freeze_date::text
     FROM client_portals
     WHERE access_token = $1`,
    [token]
  );

  if (!portal) {
    return null;
  }

  const now = new Date();
  const freezeDate = new Date(portal.freeze_date);
  const isFrozen = portal.status === 'congelado' || portal.status === 'cerrado' || now >= freezeDate;

  return {
    eventId: portal.event_id,
    portalId: portal.id,
    status: portal.status,
    freezeDate: portal.freeze_date,
    isFrozen,
  };
}

/**
 * Actualiza last_access_at del portal.
 */
export async function touchPortalAccess(portalId: number): Promise<void> {
  const { getPool } = await import('@/lib/db');
  await getPool().query(
    `UPDATE client_portals SET last_access_at = now() WHERE id = $1`,
    [portalId]
  );
}
