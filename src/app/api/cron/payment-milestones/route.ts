/**
 * EventFlow — Payment Milestones Daily Cron (WP-21)
 * GET /api/cron/payment-milestones
 *
 * Job diario que:
 * 1. Marca como 'vencido' los hitos cuya due_date ya pasó
 * 2. Emite payment.milestone_due para hitos próximos a vencer
 * 3. Envía email de recordatorio al cliente
 * 4. Retorna resumen de la ejecución
 *
 * Call: diariamente via cron scheduler o Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getPool, transaction } from '@/lib/db';
import { emitDomainEvent } from '@/domain/events';
import {
  getMilestoneConfig,
  markOverdueMilestones,
  getMilestonesForReminder,
  markReminderSent,
} from '@/lib/domain/paymentPlan';
import { sendEmail, templates } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  const results = {
    overdue_marked: 0,
    reminders_sent: 0,
    reminders_failed: 0,
    events_emitted: 0,
    errors: [] as string[],
  };

  try {
    // 1) Marcar hitos vencidos (due_date < hoy y status = 'pendiente')
    const overdueMilestones = await markOverdueMilestones();
    results.overdue_marked = overdueMilestones.length;

    // Para cada hito recién vencido, emitir evento de dominio
    for (const milestone of overdueMilestones) {
      try {
        const plan = await getPool().query(
          `SELECT event_id FROM payment_plans WHERE id = $1`,
          [milestone.plan_id]
        );
        const eventId = plan.rows[0]?.event_id;
        if (eventId) {
          await transaction(async (client) => {
            await emitDomainEvent(
              client,
              'payment.milestone_due',
              'event',
              eventId,
              {
                event_id: eventId,
                milestone_id: milestone.id,
                due_date: milestone.due_date,
                status: 'vencido',
                amount: Number(milestone.amount),
                kind: milestone.kind,
                label: milestone.label,
              }
            );
          });
          results.events_emitted++;
        }
      } catch (err) {
        results.errors.push(`Error emitiendo evento para hito vencido ${milestone.id}: ${err}`);
      }
    }

    // 2) Enviar recordatorios para hitos próximos a vencer
    const config = await getMilestoneConfig();
    const milestonesToRemind = await getMilestonesForReminder(config.reminder_days);

    for (const milestone of milestonesToRemind) {
      try {
        // Enviar email recordatorio
        const tpl = await templates.paymentReminder(
          milestone.client_name,
          milestone.client_email,
          Number(milestone.amount),
          milestone.event_type,
          milestone.event_date
        );

        const result = await sendEmail({
          to: milestone.client_email,
          subject: tpl.subject,
          html: tpl.html,
        });

        if (result.success) {
          results.reminders_sent++;
          // Marcar recordatorio enviado
          await transaction(async (client) => {
            await markReminderSent(client, milestone.id);

            // Emitir evento de dominio payment.milestone_due
            await emitDomainEvent(
              client,
              'payment.milestone_due',
              'event',
              milestone.event_id,
              {
                event_id: milestone.event_id,
                milestone_id: milestone.id,
                due_date: milestone.due_date,
                status: milestone.status,
                amount: Number(milestone.amount),
                kind: milestone.kind,
                label: milestone.label,
              }
            );
            results.events_emitted++;
          });
        } else {
          results.reminders_failed++;
          results.errors.push(`Email fallido para hito ${milestone.id}: ${result.error}`);
        }
      } catch (err) {
        results.reminders_failed++;
        results.errors.push(`Error procesando recordatorio ${milestone.id}: ${err}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Payment milestones cron ejecutado',
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      success: false,
      error: message,
      ...results,
    }, { status: 500 });
  }
}
