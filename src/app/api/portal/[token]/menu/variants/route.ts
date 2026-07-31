/**
 * EventFlow — Portal Menu Variants API
 * GET    /api/portal/[token]/menu/variants — Ver variantes asignadas
 * POST   /api/portal/[token]/menu/variants — Asignar variante a invitado
 * DELETE /api/portal/[token]/menu/variants — Quitar variante
 *
 * Acceso: cliente con token válido
 * Escritura: solo si el portal NO está congelado (423 si congelado)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validatePortalToken, checkWritable } from '@/lib/portal-auth';
import {
  getGuestVariants,
  assignGuestVariant,
  removeGuestVariant,
  VALID_VARIANT_TYPES,
  type VariantType,
} from '@/domain/portal-menu';
import { sanitizeError, sanitizeText, securityHeaders } from '@/lib/security';
import { querySingle } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ============================================================
// GET — Ver variantes asignadas
// ============================================================

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

    const variants = await getGuestVariants(auth.eventId);

    return NextResponse.json(
      {
        success: true,
        data: variants,
        is_frozen: auth.isFrozen,
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

// ============================================================
// POST — Asignar variante a invitado
// ============================================================

export async function POST(
  request: NextRequest,
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

    // Verificar que no esté congelado
    const frozenError = checkWritable(auth);
    if (frozenError) return frozenError;

    // Parsear body
    const body = await request.json();

    if (!body.guest_id || typeof body.guest_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'guest_id es obligatorio' },
        { status: 400, headers: securityHeaders() }
      );
    }

    const variantType = body.variant_type as string;
    if (!VALID_VARIANT_TYPES.includes(variantType as VariantType)) {
      return NextResponse.json(
        {
          success: false,
          error: `variant_type no válido. Opciones: ${VALID_VARIANT_TYPES.join(', ')}`,
        },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Obtener el event_menu_id (el menú vinculado al evento)
    const eventMenu = await querySingle<{ id: string }>(
      `SELECT id FROM event_menus WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [auth.eventId]
    );

    if (!eventMenu) {
      return NextResponse.json(
        { success: false, error: 'Este evento no tiene un menú asignado' },
        { status: 404, headers: securityHeaders() }
      );
    }

    // Asignar variante
    const variant = await assignGuestVariant(
      auth.eventId,
      body.guest_id,
      eventMenu.id,
      variantType as VariantType,
      body.section_id || null,
      body.dish_id || null,
      body.notes ? sanitizeText(body.notes, 500) : null
    );

    return NextResponse.json(
      { success: true, data: variant },
      { status: 201, headers: securityHeaders() }
    );
  } catch (error) {
    const message = sanitizeError(error);
    const status = message.includes('no encontrado') ? 404 : 400;
    return NextResponse.json(
      { success: false, error: message },
      { status, headers: securityHeaders() }
    );
  }
}

// ============================================================
// DELETE — Quitar variante
// ============================================================

export async function DELETE(
  request: NextRequest,
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

    // Verificar que no esté congelado
    const frozenError = checkWritable(auth);
    if (frozenError) return frozenError;

    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guest_id');

    if (!guestId) {
      return NextResponse.json(
        { success: false, error: 'guest_id es obligatorio' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // Obtener event_menu_id
    const eventMenu = await querySingle<{ id: string }>(
      `SELECT id FROM event_menus WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [auth.eventId]
    );

    if (!eventMenu) {
      return NextResponse.json(
        { success: false, error: 'Este evento no tiene un menú asignado' },
        { status: 404, headers: securityHeaders() }
      );
    }

    const removed = await removeGuestVariant(guestId, eventMenu.id);

    return NextResponse.json(
      {
        success: true,
        removed,
        message: removed ? 'Variante eliminada' : 'No existía variante para este invitado',
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
