/**
 * EventFlow — Portal Resolve API
 * GET /api/portal/[token] — Resolve portal token and return event summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { resolvePortal } from '@/domain/portal';
import { sanitizeError } from '@/lib/security';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      );
    }

    const result = await resolvePortal(token);

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Portal no encontrado o token inválido' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      portal: {
        id: result.portal.id,
        status: result.portal.status,
        freezeDate: result.portal.freeze_date,
        createdAt: result.portal.created_at,
      },
      event: {
        eventId: result.event.event_id,
        clientName: result.event.client_name,
        clientEmail: result.event.client_email,
        eventType: result.event.event_type,
        eventDate: result.event.event_date,
        guestCount: result.event.guest_count,
        kidsCount: result.event.kids_count,
        venueType: result.event.venue_type,
        location: result.event.location,
        status: result.event.status,
        totalPvp: result.event.total_pvp,
        totalPaid: result.event.total_paid,
        pendingAmount: result.event.pending_amount,
        milestones: result.event.milestones,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
