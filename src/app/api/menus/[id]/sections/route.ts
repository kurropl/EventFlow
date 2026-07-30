/**
 * EventFlow — Menu Sections API Route
 * GET /api/menus/[id]/sections — Listar secciones de un menú
 * POST /api/menus/[id]/sections — Añadir sección a un menú
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMenuById, createSection } from '@/domain/menus';
import { sanitizeError } from '@/lib/security';

// ============================================================
// GET — Listar secciones de un menú
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
      data: menu.sections,
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
// POST — Añadir sección a un menú
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Nombre de sección es requerido' },
        { status: 400 }
      );
    }

    if (body.position === undefined || typeof body.position !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Posición es requerida' },
        { status: 400 }
      );
    }

    // Check if menu exists and is editable
    const menu = await getMenuById(id);
    if (!menu) {
      return NextResponse.json(
        { success: false, error: 'Menú no encontrado' },
        { status: 404 }
      );
    }

    if (menu.status !== 'borrador') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden editar menús en estado borrador' },
        { status: 409 }
      );
    }

    const section = await createSection(id, {
      name: body.name,
      position: body.position,
      dishes: body.dishes,
    });

    return NextResponse.json({
      success: true,
      data: section,
    }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
