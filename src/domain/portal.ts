/**
 * EventFlow — Portal del Cliente: Lógica de dominio
 * Creación, resolución y gestión de portales de cliente.
 *
 * Token de acceso: ≥32 bytes aleatorios, almacenado en texto plano
 * para el usuario pero con hash SHA-256 para lookup rápido.
 */

import { randomBytes, createHash } from 'crypto';
import { querySingle, queryMany, transaction } from '@/lib/db';
import type { PoolClient } from 'pg';

// ============================================================
// Types
// ============================================================

export interface ClientPortal {
  id: string;
  event_id: string;
  access_token: string;
  token_hash: string;
  status: 'activo' | 'congelado' | 'cerrado';
  freeze_date: string | null;
  created_at: string;
  updated_at: string;
  last_access_at: string | null;
}

export interface PortalEventSummary {
  event_id: string;
  client_name: string;
  client_email: string;
  event_type: string;
  event_date: string;
  guest_count: number;
  kids_count: number;
  venue_type: string;
  location: string;
  status: string;
  total_pvp: number;
  // Payment info
  total_paid: number;
  pending_amount: number;
  milestones: Array<{
    id: string;
    kind: string;
    label: string;
    amount: number;
    due_date: string | null;
    status: string;
  }>;
}

// ============================================================
// Token helpers
// ============================================================

/** Generate a cryptographically secure random token (>=32 bytes) */
export function generateAccessToken(length = 48): string {
  return randomBytes(length).toString('hex');
}

/** Hash a token using SHA-256 for storage/lookup */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ============================================================
// Portal CRUD
// ============================================================

/**
 * Create a new client portal for an event.
 * Returns the plaintext token (to be sent via email).
 */
export async function createPortal(
  eventId: string,
  freezeDate?: string | null
): Promise<{ portal: ClientPortal; token: string }> {
  const token = generateAccessToken();
  const tokenHash = hashToken(token);

  const portal = await transaction(async (client: PoolClient) => {
    // Check if portal already exists (idempotent)
    const existing = await client.query<ClientPortal>(
      `SELECT * FROM client_portals WHERE event_id = $1`,
      [eventId]
    );
    if (existing.rows[0]) {
      return existing.rows[0];
    }

    const result = await client.query<ClientPortal>(
      `INSERT INTO client_portals (event_id, access_token, token_hash, freeze_date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [eventId, token, tokenHash, freezeDate || null]
    );
    return result.rows[0];
  });

  return { portal, token };
}

/**
 * Resolve a portal by access token.
 * Returns portal + event data if valid, null otherwise.
 */
export async function resolvePortal(token: string): Promise<{
  portal: ClientPortal;
  event: PortalEventSummary;
} | null> {
  const tokenHash = hashToken(token);

  const portal = await querySingle<ClientPortal>(
    `SELECT * FROM client_portals WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!portal) return null;

  // Update last_access_at
  await querySingle(
    `UPDATE client_portals SET last_access_at = now() WHERE id = $1`,
    [portal.id]
  );

  // Get event summary with payment info
  const event = await querySingle<PortalEventSummary>(
    `SELECT 
      e.id as event_id,
      e.client_name,
      e.client_email,
      e.event_type,
      e.event_date,
      e.guest_count,
      e.kids_count,
      e.venue_type,
      e.location,
      e.status,
      e.total_pvp,
      COALESCE(pay.total_paid, 0)::numeric as total_paid,
      (COALESCE(e.total_pvp, 0) - COALESCE(pay.total_paid, 0))::numeric as pending_amount
    FROM events e
    LEFT JOIN LATERAL (
      SELECT SUM(amount) as total_paid
      FROM payments WHERE event_id = e.id AND paid = true
    ) pay ON true
    WHERE e.id = $1`,
    [portal.event_id]
  );

  if (!event) return null;

  // Get milestones
  const milestones = await queryMany<{
    id: string;
    kind: string;
    label: string;
    amount: number;
    due_date: string | null;
    status: string;
  }>(
    `SELECT pm.id, pm.kind, pm.label, pm.amount, pm.due_date, pm.status
     FROM payment_milestones pm
     JOIN payment_plans pp ON pp.id = pm.plan_id
     WHERE pp.event_id = $1
     ORDER BY pm.due_date NULLS LAST`,
    [portal.event_id]
  );

  return {
    portal,
    event: { ...event, milestones },
  };
}

/**
 * Validate a portal token and check access.
 * Returns event_id if valid, null otherwise.
 */
export async function validatePortalAccess(
  token: string
): Promise<{ portalId: string; eventId: string; status: string } | null> {
  const tokenHash = hashToken(token);

  const portal = await querySingle<ClientPortal>(
    `SELECT id, event_id, status FROM client_portals WHERE token_hash = $1`,
    [tokenHash]
  );

  if (!portal) return null;

  return {
    portalId: portal.id,
    eventId: portal.event_id,
    status: portal.status,
  };
}

// ============================================================
// Magic Links
// ============================================================

/**
 * Create a magic link for portal access.
 * Returns the plaintext token.
 */
export async function createMagicLink(
  portalId: string,
  email: string,
  ttlHours = 24
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateAccessToken(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await querySingle(
    `INSERT INTO portal_magic_links (portal_id, token, token_hash, email, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [portalId, token, tokenHash, email, expiresAt]
  );

  return { token, expiresAt };
}

/**
 * Validate a magic link token.
 * Returns portal_id if valid, null otherwise.
 */
export async function validateMagicLink(
  token: string
): Promise<{ portalId: string } | null> {
  const tokenHash = hashToken(token);

  const link = await querySingle<{ portal_id: string; expires_at: string }>(
    `SELECT portal_id, expires_at FROM portal_magic_links
     WHERE token_hash = $1 AND used_at IS NULL`,
    [tokenHash]
  );

  if (!link) return null;

  // Check expiry
  if (new Date(link.expires_at) < new Date()) {
    return null;
  }

  // Mark as used
  await querySingle(
    `UPDATE portal_magic_links SET used_at = now() WHERE token_hash = $1`,
    [tokenHash]
  );

  return { portalId: link.portal_id };
}

// ============================================================
// Portal status management
// ============================================================

/**
 * Freeze a portal (read-only mode).
 */
export async function freezePortal(eventId: string): Promise<boolean> {
  const result = await querySingle(
    `UPDATE client_portals SET status = 'congelado'
     WHERE event_id = $1 AND status = 'activo'
     RETURNING id`,
    [eventId]
  );
  return !!result;
}

/**
 * Close a portal permanently.
 */
export async function closePortal(eventId: string): Promise<boolean> {
  const result = await querySingle(
    `UPDATE client_portals SET status = 'cerrado'
     WHERE event_id = $1 AND status IN ('activo', 'congelado')
     RETURNING id`,
    [eventId]
  );
  return !!result;
}
