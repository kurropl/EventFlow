/**
 * EventFlow — Price History API Route
 * GET /api/stock/price-history?ingredient_id=... — Get price change history for an ingredient
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────


// ── GET: Price history for an ingredient ─────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const ingredientId = searchParams.get('ingredient_id');

    if (!ingredientId || !isValidUUID(ingredientId)) {
      return NextResponse.json(
        { success: false, error: 'El parámetro "ingredient_id" es obligatorio y debe ser un UUID válido' },
        { status: 400 }
      );
    }

    const rows = await queryMany<any>(
      `SELECT old_price, new_price, changed_by, recorded_at
       FROM ingredient_price_history
       WHERE ingredient_id = $1
       ORDER BY recorded_at DESC
       LIMIT 50`,
      [ingredientId]
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
