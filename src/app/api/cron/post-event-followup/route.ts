/**
 * EventFlow — Post-Event Follow-up Cron
 * GET /api/cron/post-event-followup
 * Sends follow-up emails 1-3 days after events.
 * Call daily via cron.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sendEmail, templates } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    // Find completed events from 1-3 days ago that haven't been followed up
    const recentEvents = await queryMany<any>(
      `SELECT e.id, e.client_name, e.client_email, e.event_type, e.event_date
      FROM events e
      WHERE e.status IN ('completed', 'paid')
        AND e.event_date >= CURRENT_DATE - INTERVAL '3 days'
        AND e.event_date <= CURRENT_DATE - INTERVAL '1 day'
        AND e.client_email IS NOT NULL
        AND e.client_email != ''
        AND NOT EXISTS (
          SELECT 1 FROM email_queue eq
          WHERE eq.event_id = e.id AND eq.email_type = 'post_event_followup' AND eq.status IN ('sent', 'pending')
        )
      ORDER BY e.event_date ASC
      LIMIT 20`
    );

    if (recentEvents.length === 0) {
      return NextResponse.json({ success: true, message: 'No events to follow up', sent: 0 });
    }

    let sent = 0;
    let failed = 0;

    for (const event of recentEvents) {
      try {
        const tpl = await templates.postEventFollowUp(
          event.client_name,
          event.client_email,
          event.event_type,
          new Date(event.event_date).toLocaleDateString('es-ES')
        );

        // Queue the email
        await querySingle(
          `INSERT INTO email_queue (event_id, recipient_email, recipient_name, subject, body, email_type, status)
           VALUES ($1, $2, $3, $4, $5, 'post_event_followup', 'pending')`,
          [event.id, event.client_email, event.client_name, tpl.subject, tpl.html]
        );

        // Try to send immediately
        const result = await sendEmail({
          to: event.client_email,
          subject: tpl.subject,
          html: tpl.html,
        });

        if (result.success) {
          sent++;
          // Mark as sent
          const queueRow = await querySingle<any>(
            `SELECT id FROM email_queue WHERE event_id = $1 AND email_type = 'post_event_followup' AND status = 'pending' ORDER BY created_at DESC LIMIT 1`,
            [event.id]
          );
          if (queueRow) {
            await querySingle(
              `UPDATE email_queue SET status = 'sent', sent_at = NOW() WHERE id = $1`,
              [queueRow.id]
            );
          }
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    return NextResponse.json({ success: true, sent, failed, total: recentEvents.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
