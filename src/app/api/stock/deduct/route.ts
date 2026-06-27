/**
 * EventFlow — Stock Deduction API Route
 * POST /api/stock/deduct — Deduct consumed ingredients from stock when event is completed
 *
 * Body: { event_id: string }
 *
 * Auth: admin_session OR eventflow_token cookie
 *
 * La lógica de deducción vive en @/lib/stockDeduct (un route.ts solo puede
 * exportar handlers HTTP, no funciones auxiliares reutilizables).
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { verifyToken } from '@/lib/auth';
import { deductStockForEvent } from '@/lib/stockDeduct';

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token =
    request.cookies.get('admin_session')?.value ||
    request.cookies.get('eventflow_token')?.value;
  if (!token) {
    return { authenticated: false, error: 'No autenticado' };
  }
  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, error: 'Token inválido o expirado' };
  }
  return { authenticated: true };
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const eventId = body.event_id;

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { success: false, error: 'event_id inválido.' },
        { status: 422 }
      );
    }

    const result = await deductStockForEvent(eventId);

    return NextResponse.json(result);
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
