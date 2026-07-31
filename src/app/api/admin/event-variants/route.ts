/**
 * EventFlow — Admin Event Variants API
 * GET    /api/admin/event-variants?event_id= — Ver variantes de un evento
 * POST   /api/admin/event-variants — Asignar variante (admin)
 * DELETE /api/admin/event-variants — Quitar variante (admin)
 *
 * Acceso: rol Admin o Gerente
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getGuestVariants,
  getVariantSummary,
  getGuestsWithVariants,
  assignGuestVariant,
  removeGuestVariant,
  VALID_VARIANT_TYPES,
  type VariantType,
} from '@/domain/portal-menu';
import { sanitizeError, sanitizeText } from '@/lib/security';
import { querySingle } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ============================================================
// GET — Ver variantes de un evento
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const summaryOnly = searchParams.get('summary') === 'true';
    const withGuests = searchParams.get('guests') === 'true';

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'event_id es obligatorio' },
        { status: 400 }
      );
    }

    if (summaryOnly) {
      const summary = await getVariantSummary(eventId);
      return NextResponse.json({ success: true, data: summary });
    }

    if (withGuests) {
      const guests = await getGuestsWithVariants(eventId);
      return NextResponse.json({ success: true, data: guests });
    }

    const variants = await getGuestVariants(eventId);
    return NextResponse.json({ success: true, data: variants });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// POST — Asignar variante (admin)
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.event_id || !body.guest_id || !body.event_menu_id || !body.variant_type) {
      return NextResponse.json(
        {
          success: false,
          error: 'event_id, guest_id, event_menu_id y variant_type son obligatorios',
        },
        { status: 400 }
      );
    }

    const variantType = body.variant_type as string;
    if (!VALID_VARIANT_TYPES.includes(variantType as VariantType)) {
      return NextResponse.json(
        {
          success: false,
          error: `variant_type no válido. Opciones: ${VALID_VARIANT_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    const variant = await assignGuestVariant(
      body.event_id,
      body.guest_id,
      body.event_menu_id,
      variantType as VariantType,
      body.section_id || null,
      body.dish_id || null,
      body.notes ? sanitizeText(body.notes, 500) : null
    );

    return NextResponse.json({ success: true, data: variant }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    const status = message.includes('no encontrado') ? 404 : 400;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

// ============================================================
// DELETE — Quitar variante (admin)
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guestId = searchParams.get('guest_id');
    const eventMenuId = searchParams.get('event_menu_id');

    if (!guestId || !eventMenuId) {
      return NextResponse.json(
        { success: false, error: 'guest_id y event_menu_id son obligatorios' },
        { status: 400 }
      );
    }

    const removed = await removeGuestVariant(guestId, eventMenuId);

    return NextResponse.json({
      success: true,
      removed,
      message: removed ? 'Variante eliminada' : 'No existía variante',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
