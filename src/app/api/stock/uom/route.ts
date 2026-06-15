/**
 * EventFlow — Units of Measure API Route
 * GET /api/stock/uom — List all units of measure
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) {
    return { authenticated: false, error: 'No autenticado' };
  }
  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, error: 'Token inválido o expirado' };
  }
  return { authenticated: true };
}

// ── GET: List all units of measure ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const rows = await queryMany<any>(
      `SELECT id, name, category, factor_to_base, symbol, created_at
       FROM units_of_measure
       ORDER BY category ASC, name ASC`
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
