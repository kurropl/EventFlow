/**
 * EventFlow — Public Menus API Route
 * GET /api/public/menus — Listar menús publicados (endpoint público)
 * 
 * Este endpoint es público (sin autenticación) y solo devuelve
 * menús en estado 'publicado' para el configurador web.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublishedMenus } from '@/domain/menus';
import { sanitizeError } from '@/lib/security';

// ============================================================
// GET — Listar menús publicados (público)
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const menus = await getPublishedMenus();

    // Return simplified data for public consumption
    const publicMenus = menus.map(menu => ({
      id: menu.id,
      name: menu.name,
      version: menu.version,
      price_per_pax: menu.price_per_pax,
      description: menu.description,
      cost_per_pax: menu.cost_per_pax,
      margin_pct: menu.margin_pct,
    }));

    return NextResponse.json({
      success: true,
      data: publicMenus,
    });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
