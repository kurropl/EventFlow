/**
 * EventFlow — Menu by ID API Route
 * GET /api/menus/[id] — Obtener menú con secciones y platos
 * PUT /api/menus/[id] — Actualizar menú (con versionado inmutable)
 * DELETE /api/menus/[id] — Eliminar menú (solo borrador)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMenuById, updateMenu, deleteMenu } from '@/domain/menus';
import { sanitizeError } from '@/lib/security';

// ============================================================
// GET — Obtener menú por ID
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const menu = await getMenuById(id);

    if (!menu) {
      return NextResponse.json(
        { success: false, error: 'Menú no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT — Actualizar menú
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Validate fields if provided
    if (body.price_per_pax !== undefined) {
      if (typeof body.price_per_pax !== 'number' || body.price_per_pax < 0) {
        return NextResponse.json(
          { success: false, error: 'Precio por pax debe ser un número positivo' },
          { status: 400 }
        );
      }
    }

    // TODO: Get userId from JWT
    const userId = '00000000-0000-0000-0000-000000000000';

    const menu = await updateMenu(
      id,
      {
        name: body.name,
        price_per_pax: body.price_per_pax,
        description: body.description,
      },
      userId
    );

    return NextResponse.json({
      success: true,
      data: menu,
    });
  } catch (error) {
    const message = sanitizeError(error);

    if (message.includes('no encontrado')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 404 }
      );
    }

    if (message.includes('Solo se pueden editar') || message.includes('versión')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 409 } // Conflict - requiere clonación
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}

// ============================================================
// DELETE — Eliminar menú
// ============================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const deleted = await deleteMenu(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Menú no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Menú eliminado correctamente',
    });
  } catch (error) {
    const message = sanitizeError(error);

    if (message.includes('No se puede eliminar') || message.includes('Solo se pueden eliminar')) {
      return NextResponse.json(
        { success: false, error: message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
