/**
 * EventFlow — Send Budget API Route
 * POST /api/send-budget/[eventId] — Send budget email to client
 *
 * Updates the event status to 'sent' and emits a BUDGET_SENT webhook
 * so n8n (or other automation) can deliver the actual email.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { emitWebhook } from '@/lib/webhooks';
import { setEventStatus } from '@/lib/domain/eventState';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    // Fetch the event
    const event = await querySingle<any>(
      `SELECT * FROM events WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    // Validate event can be sent (must exist, not already completed/paid/cancelled)
    const nonSendableStatuses = ['completed', 'paid', 'cancelled'];
    if (nonSendableStatuses.includes(event.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `No se puede enviar el presupuesto: el evento está en estado "${event.status}"`,
        },
        { status: 400 }
      );
    }

    // Update status to 'sent'
    const updated = await setEventStatus(eventId, 'sent');

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Error al actualizar el evento' },
        { status: 500 }
      );
    }

    // Emit BUDGET_SENT webhook (triggers email delivery via n8n/automation)
    try {
      await emitWebhook('BUDGET_SENT', updated, {});
    } catch (webhookError) {
      // Non-fatal: the event was updated, just log the webhook failure
      console.error('[send-budget] Webhook emission failed:', webhookError);
    }

    return NextResponse.json({
      success: true,
      message: 'Presupuesto enviado correctamente',
      data: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}