/**
 * EventFlow — Portal Summary API
 * GET /api/portal/[token]/summary — Get portal home summary
 */

import { NextRequest, NextResponse } from 'next/server';
import { withPortalAuth } from '@/lib/portalAuth';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const auth = await withPortalAuth(request);
    if (auth.response) return auth.response;

    const { eventId } = auth.context;

    // Get event summary
    const event = await querySingle<{
      event_id: string;
      client_name: string;
      event_type: string;
      event_date: string;
      guest_count: number;
      kids_count: number;
      venue_type: string;
      location: string;
      status: string;
      total_pvp: number;
      total_paid: number;
      pending_amount: number;
    }>(
      `SELECT 
        e.id as event_id,
        e.client_name,
        e.event_type,
        e.event_date,
        e.guest_count,
        e.kids_count,
        e.venue_type,
        e.location,
        e.status,
        e.total_pvp,
        COALESCE(pay.total_paid, 0)::numeric as total_paid,
        (COALESCE(e.total_pvp, 0) - COALESCE(pay.total_paid, 0))::numeric as pending_amount
      FROM events e
      LEFT JOIN LATERAL (
        SELECT SUM(amount) as total_paid
        FROM payments WHERE event_id = e.id AND paid = true
      ) pay ON true
      WHERE e.id = $1`,
      [eventId]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    // Get milestones
    const milestones = await queryMany<{
      id: string;
      kind: string;
      label: string;
      amount: number;
      due_date: string | null;
      status: string;
    }>(
      `SELECT pm.id, pm.kind, pm.label, pm.amount, pm.due_date, pm.status
       FROM payment_milestones pm
       JOIN payment_plans pp ON pp.id = pm.plan_id
       WHERE pp.event_id = $1
       ORDER BY pm.due_date NULLS LAST`,
      [eventId]
    );

    // Get guest count
    const guestStats = await querySingle<{
      total: number;
      confirmed: number;
      pending: number;
      declined: number;
    }>(
      `SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE rsvp_status = 'confirmado') as confirmed,
        COUNT(*) FILTER (WHERE rsvp_status = 'pendiente') as pending,
        COUNT(*) FILTER (WHERE rsvp_status = 'rechazado') as declined
       FROM guests WHERE event_id = $1`,
      [eventId]
    );

    // Get extras count
    const extrasCount = await querySingle<{ total: number }>(
      `SELECT COUNT(*) as total
       FROM event_extras WHERE event_id = $1`,
      [eventId]
    );

    // Get unread messages count
    const unreadMessages = await querySingle<{ count: number }>(
      `SELECT COUNT(*) as count
       FROM event_messages 
       WHERE event_id = $1 AND sender = 'equipo' AND read_at IS NULL`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      event: {
        eventId: event.event_id,
        clientName: event.client_name,
        eventType: event.event_type,
        eventDate: event.event_date,
        guestCount: event.guest_count,
        kidsCount: event.kids_count,
        venueType: event.venue_type,
        location: event.location,
        status: event.status,
        totalPvp: event.total_pvp,
        totalPaid: event.total_paid,
        pendingAmount: event.pending_amount,
      },
      milestones,
      stats: {
        guests: guestStats || { total: 0, confirmed: 0, pending: 0, declined: 0 },
        extras: extrasCount?.total || 0,
        unreadMessages: unreadMessages?.count || 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
