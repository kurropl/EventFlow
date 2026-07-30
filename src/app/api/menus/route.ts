/**
 * EventFlow — Menus API Route
 * GET /api/menus — Listar menús con filtros
 * POST /api/menus — Crear nuevo menú
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMenus, createMenu } from '@/domain/menus';
import { getPool } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

// ============================================================
// GET — Listar menús
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { menus, total } = await getMenus({ status, search, limit, offset });

    return NextResponse.json({
      success: true,
      data: menus,
      total,
      limit,
      offset,
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
// POST — Crear nuevo menú
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Nombre es requerido' },
        { status: 400 }
      );
    }

    if (!body.price_per_pax || typeof body.price_per_pax !== 'number' || body.price_per_pax < 0) {
      return NextResponse.json(
        { success: false, error: 'Precio por pax debe ser un número positivo' },
        { status: 400 }
      );
    }

    // TODO: Get userId from JWT
    const userId = '00000000-0000-0000-0000-000000000000';

    const menu = await createMenu(
      {
        name: body.name,
        price_per_pax: body.price_per_pax,
        description: body.description,
        sections: body.sections,
      },
      userId
    );

    return NextResponse.json({
      success: true,
      data: menu,
    }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 }
    );
  }
}
