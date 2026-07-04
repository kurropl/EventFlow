/**
 * EventFlow — Payment Reminders Cron
 * GET /api/cron/payment-reminders
 * Checks for events with pending payments and sends email reminders.
 * Call this daily via cron or Vercel cron.
 */
import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/security';
import { queryMany, querySingle } from '@/lib/db';
import { sendEmail, templates } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }
  try {
    // Find events with pending payments that haven't been reminded in 7 days
    const eventsWithPending = await queryMany<any>(
      `SELECT DISTINCT
        e.id, e.client_name, e.client_email, e.event_type, e.event_date,
        p.amount AS payment_amount,
        p.due_date
      FROM events e
      JOIN payments p ON p.event_id = e.id
      WHERE p.paid = false
        AND e.client_email IS NOT NULL
        AND e.client_email != ''
        AND e.status IN ('accepted', 'in_progress')
        AND (p.last_reminder_at IS NULL OR p.last_reminder_at < NOW() - INTERVAL '7 days')
      ORDER BY p.due_date ASC
      LIMIT 20`
    );

    if (eventsWithPending.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending payments to remind', sent: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const event of eventsWithPending) {
      try {
        const tpl = await templates.paymentReminder(
          event.client_name,
          event.client_email,
          Number(event.payment_amount),
          event.event_type,
          new Date(event.event_date).toLocaleDateString('es-ES')
        );
        const result = await sendEmail({
          to: event.client_email,
          subject: tpl.subject,
          html: tpl.html,
        });
        if (result.success) sent++;
        else failed++;

        // Update last_reminder_at on the payment
        await querySingle(
          `UPDATE payments SET last_reminder_at = NOW() WHERE event_id = $1 AND paid = false`,
          [event.id]
        );
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ success: true, sent, failed, total: eventsWithPending.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
