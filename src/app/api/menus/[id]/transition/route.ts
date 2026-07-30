/**
 * EventFlow — Menu Status Transition API Route
 * POST /api/menus/[id]/transition — Cambiar estado del menú
 */

import { NextRequest, NextResponse } from 'next/server';
import { transitionMenuStatus } from '@/domain/menus';
import { sanitizeError } from '@/lib/security';

// ============================================================
// POST — Cambiar estado del menú
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.status || typeof body.status !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Estado destino es requerido' },
        { status: 400 }
      );
    }

    const validStatuses = ['borrador', 'publicado', 'pausado', 'retirado'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: `Estado inválido. Permitidos: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // TODO: Get userId from JWT
    const userId = '00000000-0000-0000-0000-000000000000';

    const menu = await transitionMenuStatus(id, body.status, userId);

    return NextResponse.json({
      success: true,
      data: menu,
      message: `Menú transicionado a '${body.status}'`,
    });
  } catch (error) {
    const message = sanitizeError(error);

    if (message.includes('no encontrado')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    if (message.includes('Transición inválida')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 422 } // Unprocessable Entity
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
