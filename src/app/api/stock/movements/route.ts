/**
 * EventFlow — WP-02: API de movimientos de stock
 * GET /api/stock/movements?ingredient_id=xxx&limit=50&offset=0
 * Retorna el historial de movimientos de un ingrediente.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { verifyToken } from '@/lib/auth';
import { getIngredientMovements } from '@/lib/domain/stockMovements';

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return { authenticated: false, error: 'No autenticado' };
  const user = verifyToken(token);
  if (!user) return { authenticated: false, error: 'Token inválido o expirado' };
  return { authenticated: true };
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const ingredientId = searchParams.get('ingredient_id');
    if (!ingredientId || !isValidUUID(ingredientId)) {
      return NextResponse.json(
        { success: false, error: 'ingredient_id inválido.' },
        { status: 422 }
      );
    }

    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getIngredientMovements(ingredientId, limit, offset);

    return NextResponse.json({
      success: true,
      data: result.movements,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
