/**
 * EventFlow — Menu Section Dishes API Route
 * GET /api/menus/[id]/sections/[sectionId]/dishes — Listar platos de una sección
 * POST /api/menus/[id]/sections/[sectionId]/dishes — Añadir plato a una sección
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMenuById, createSectionDish } from '@/domain/menus';
import { sanitizeError } from '@/lib/security';

// ============================================================
// GET — Listar platos de una sección
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  try {
    const { id, sectionId } = params;

    // Verify menu exists
    const menu = await getMenuById(id);
    if (!menu) {
      return NextResponse.json(
        { success: false, error: 'Menú no encontrado' },
        { status: 404 }
      );
    }

    // Find section
    const section = menu.sections.find(s => s.id === sectionId);
    if (!section) {
      return NextResponse.json(
        { success: false, error: 'Sección no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: section.dishes,
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
// POST — Añadir plato a una sección
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  try {
    const { id, sectionId } = params;
    const body = await request.json();

    // Validate required fields
    if (!body.dish_id || typeof body.dish_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'ID del plato es requerido' },
        { status: 400 }
      );
    }

    if (body.position === undefined || typeof body.position !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Posición es requerida' },
        { status: 400 }
      );
    }

    // Verify menu exists and is editable
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

    // Verify section exists
    const section = menu.sections.find(s => s.id === sectionId);
    if (!section) {
      return NextResponse.json(
        { success: false, error: 'Sección no encontrada' },
        { status: 404 }
      );
    }

    const dish = await createSectionDish(sectionId, {
      dish_id: body.dish_id,
      variant_tag: body.variant_tag,
      position: body.position,
      notes: body.notes,
    });

    return NextResponse.json({
      success: true,
      data: dish,
    }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
