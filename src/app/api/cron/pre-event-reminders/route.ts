/**
 * EventFlow — Pre-Event Reminders Cron
 * GET /api/cron/pre-event-reminders
 * Sends reminders to clients 3 days and 1 day before their event.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

function reminderTemplate(name: string, eventType: string, eventDate: string, daysLeft: number) {
  const urgency = daysLeft <= 1
    ? 'Tu evento es <strong>manana</strong>.'
    : `Faltan <strong>${daysLeft} dias</strong> para tu evento.`;

  return {
    subject: `Recordatorio: tu ${eventType} es en ${daysLeft} dia${daysLeft > 1 ? 's' : ''}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
        <h2 style="color: #C9A84C;">Hola ${name},</h2>
        <p>${urgency}</p>
        <div style="background: #FAF8F5; border-radius: 12px; padding: 20px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Tipo:</strong> ${eventType}</p>
          <p style="margin: 4px 0;"><strong>Fecha:</strong> ${eventDate}</p>
          <p style="margin: 4px 0;"><strong>Salon:</strong> J.Benitez, Sevilla</p>
        </div>
        <p>Si tienes alguna pregunta o necesitas hacer algun cambio, contacta con nosotros.</p>
        <br/>
        <p style="color: #6B7280;">Un saludo,<br/><strong>J.Benitez</strong></p>
      </div>
    `,
  };
}

export async function GET(_request: NextRequest) {
  try {
    // 3-day reminders
    const threeDayEvents = await queryMany<any>(
      `SELECT e.id, e.client_name, e.client_email, e.event_type, e.event_date
      FROM events e
      WHERE e.event_date = CURRENT_DATE + INTERVAL '3 days'
        AND e.client_email IS NOT NULL AND e.client_email != ''
        AND e.status IN ('accepted', 'in_progress')
        AND NOT EXISTS (
          SELECT 1 FROM email_queue eq
          WHERE eq.event_id = e.id AND eq.email_type = 'pre_event_3d' AND eq.status IN ('sent', 'pending')
        )`
    );

    // 1-day reminders
    const oneDayEvents = await queryMany<any>(
      `SELECT e.id, e.client_name, e.client_email, e.event_type, e.event_date
      FROM events e
      WHERE e.event_date = CURRENT_DATE + INTERVAL '1 day'
        AND e.client_email IS NOT NULL AND e.client_email != ''
        AND e.status IN ('accepted', 'in_progress')
        AND NOT EXISTS (
          SELECT 1 FROM email_queue eq
          WHERE eq.event_id = e.id AND eq.email_type = 'pre_event_1d' AND eq.status IN ('sent', 'pending')
        )`
    );

    let sent = 0;
    let failed = 0;

    const allReminders = [
      ...threeDayEvents.map((e) => ({ ...e, days: 3, type: 'pre_event_3d' })),
      ...oneDayEvents.map((e) => ({ ...e, days: 1, type: 'pre_event_1d' })),
    ];

    for (const event of allReminders) {
      try {
        const tpl = reminderTemplate(
          event.client_name,
          event.event_type,
          new Date(event.event_date).toLocaleDateString('es-ES'),
          event.days
        );

        // Queue
        await querySingle(
          `INSERT INTO email_queue (event_id, recipient_email, recipient_name, subject, body, email_type, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
          [event.id, event.client_email, event.client_name, tpl.subject, tpl.html, event.type]
        );

        // Send immediately
        const result = await sendEmail({
          to: event.client_email,
          subject: tpl.subject,
          html: tpl.html,
        });
        if (result.success) sent++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      sent,
      failed,
      reminders: allReminders.length,
      three_day: threeDayEvents.length,
      one_day: oneDayEvents.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
