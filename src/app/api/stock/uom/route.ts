/**
 * EventFlow — Units of Measure API Route
 * GET /api/stock/uom — List all units of measure
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { verifyToken, requireAuthRequest } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────


// ── GET: List all units of measure ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
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
