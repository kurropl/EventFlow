/**
 * EventFlow — Staffing Preload Hours API
 * POST /api/staffing/preload-hours — Preload hours for an event
 * 
 * This endpoint manually triggers hours preloading for an event.
 * Useful for:
 * - Events that were created before the automatic preloading was implemented
 * - Testing purposes
 * - Manual intervention
 */

import { NextRequest, NextResponse } from 'next/server';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { verifyToken } from '@/lib/auth';
import { preloadEventHours } from '@/lib/domain/preloadEventHours';

// ============================================================
// Auth helper
// ============================================================

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string; userId?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) {
    return { authenticated: false, error: 'No autenticado' };
  }
  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, error: 'Token inválido o expirado' };
  }
  return { authenticated: true, userId: user.id };
}

// ============================================================
// POST: Preload hours for an event
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const eventId = body.event_id;

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { success: false, error: 'event_id válido es obligatorio.' },
        { status: 422 }
      );
    }

    const result = await preloadEventHours(eventId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.hoursCreated > 0 
        ? `Se han precargado ${result.hoursCreated} registros de horas`
        : result.error || 'No se crearon registros',
      data: {
        event_id: eventId,
        hours_created: result.hoursCreated
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
