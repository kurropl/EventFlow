/**
 * EventFlow — Portal Authentication Middleware
 * Valida tokens de portal y magic links, resuelve event_id,
 * y aplica restricciones de rate limit y solo-lectura.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validatePortalAccess, validateMagicLink } from '@/domain/portal';
import { checkRateLimit, getClientIp } from '@/lib/security';

// ============================================================
// Types
// ============================================================

export interface PortalAuthContext {
  portalId: string;
  eventId: string;
  status: string;  // 'activo' | 'congelado' | 'cerrado'
  isReadOnly: boolean;
}

// ============================================================
// Rate limiting config for portal routes
// ============================================================

const PORTAL_RATE_LIMIT = {
  limit: 60,        // 60 requests per window
  windowMs: 60_000, // 1 minute window
};

const MAGIC_LINK_RATE_LIMIT = {
  limit: 5,         // 5 magic link requests per window
  windowMs: 300_000, // 5 minute window
};

// ============================================================
// Middleware
// ============================================================

/**
 * Extract token from URL path.
 * Supports:
 * - /portal/[token]/...
 * - /api/portal/[token]/...
 */
function extractToken(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  
  // Find 'portal' segment and get the next one as token
  const portalIdx = segments.indexOf('portal');
  if (portalIdx === -1 || portalIdx + 1 >= segments.length) {
    return null;
  }
  
  return segments[portalIdx + 1];
}

/**
 * Portal authentication middleware.
 * Returns context if valid, or NextResponse with error.
 */
export async function withPortalAuth(
  request: NextRequest,
  options?: { requireActive?: boolean }
): Promise<{ context: PortalAuthContext; response?: never } | { context?: never; response: NextResponse }> {
  const { pathname } = request.nextUrl;
  const token = extractToken(pathname);

  if (!token) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Token de portal no proporcionado' },
        { status: 400 }
      ),
    };
  }

  // Rate limiting
  const ip = getClientIp(request);
  const rateKey = `portal:${ip}`;
  const { allowed } = checkRateLimit(rateKey, PORTAL_RATE_LIMIT.limit, PORTAL_RATE_LIMIT.windowMs);
  
  if (!allowed) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.' },
        { status: 429 }
      ),
    };
  }

  // Try portal token first
  let portalAccess = await validatePortalAccess(token);

  // If no portal token, try magic link
  if (!portalAccess) {
    const magicLink = await validateMagicLink(token);
    if (magicLink) {
      // Get portal info from magic link
      const { querySingle } = await import('@/lib/db');
      const portal = await querySingle<{ event_id: string; status: string }>(
        `SELECT event_id, status FROM client_portals WHERE id = $1`,
        [magicLink.portalId]
      );
      if (portal) {
        portalAccess = {
          portalId: magicLink.portalId,
          eventId: portal.event_id,
          status: portal.status,
        };
      }
    }
  }

  if (!portalAccess) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Token de portal inválido o expirado' },
        { status: 401 }
      ),
    };
  }

  // Check if portal is active (unless explicitly allowed)
  if (options?.requireActive && portalAccess.status !== 'activo') {
    return {
      response: NextResponse.json(
        { success: false, error: 'Portal no está activo' },
        { status: 403 }
      ),
    };
  }

  // Determine if read-only mode
  const isReadOnly = portalAccess.status === 'congelado';

  // For write operations on frozen portals, return 423
  const method = request.method;
  if (isReadOnly && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Portal congelado. Solo lectura permitida.', code: 'FROZEN' },
        { status: 423 }
      ),
    };
  }

  return {
    context: {
      portalId: portalAccess.portalId,
      eventId: portalAccess.eventId,
      status: portalAccess.status,
      isReadOnly,
    },
  };
}

/**
 * Validate token for magic link request (with stricter rate limiting).
 */
export async function validateMagicLinkRequest(
  request: NextRequest
): Promise<{ email: string; portalId: string } | NextResponse> {
  const ip = getClientIp(request);
  const rateKey = `magic-link:${ip}`;
  const { allowed } = checkRateLimit(rateKey, MAGIC_LINK_RATE_LIMIT.limit, MAGIC_LINK_RATE_LIMIT.windowMs);
  
  if (!allowed) {
    return NextResponse.json(
      { success: false, error: 'Demasiadas solicitudes de enlace mágico. Intenta de nuevo en 5 minutos.' },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email && !token) {
      return NextResponse.json(
        { success: false, error: 'Email o token requerido' },
        { status: 400 }
      );
    }

    // If token provided, validate magic link directly
    if (token) {
      const magicLink = await validateMagicLink(token);
      if (!magicLink) {
        return NextResponse.json(
          { success: false, error: 'Enlace mágico inválido o expirado' },
          { status: 401 }
        );
      }
      return { email: '', portalId: magicLink.portalId };
    }

    // If email provided, find portal by email
    const { querySingle } = await import('@/lib/db');
    const portal = await querySingle<{ id: string }>(
      `SELECT cp.id 
       FROM client_portals cp
       JOIN events e ON e.id = cp.event_id
       WHERE e.client_email = $1 AND cp.status = 'activo'`,
      [email]
    );

    if (!portal) {
      // Don't reveal if email exists or not
      return { email, portalId: '' };
    }

    return { email, portalId: portal.id };
  } catch {
    return NextResponse.json(
      { success: false, error: 'Datos inválidos' },
      { status: 400 }
    );
  }
}
