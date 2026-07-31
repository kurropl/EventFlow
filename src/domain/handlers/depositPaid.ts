/**
 * EventFlow — Handler: deposit.paid
 * Emite cuando se paga la señal del presupuesto.
 * Consumidores: WP-25 crear portal del cliente.
 *
 * WP-25: Crea el portal automáticamente y envía email de bienvenida
 * con el enlace de acceso.
 */

import { querySingle } from '@/lib/db';
import { createPortal } from '../portal';
import { sendEmail, templates } from '@/lib/email';
import type { DomainEvent } from '../events';

export interface DepositPaidPayload {
  event_id: string;
  milestone_id: string;
  amount: number;
}

/**
 * Handler principal: deposit.paid
 * Crea portal del cliente y envía email de bienvenida.
 */
export async function handleDepositPaid(event: DomainEvent): Promise<void> {
  const payload = event.payload as unknown as DepositPaidPayload;
  const { event_id } = payload;

  console.log(`[Handler] deposit.paid para evento ${event_id}`);

  // 1. Get event details
  const eventRecord = await querySingle<{
    id: string;
    client_name: string;
    client_email: string;
    event_type: string;
    event_date: string;
    guest_count: number;
  }>(
    `SELECT id, client_name, client_email, event_type, event_date, guest_count
     FROM events WHERE id = $1`,
    [event_id]
  );

  if (!eventRecord) {
    console.error(`[Handler] Evento ${event_id} no encontrado`);
    return;
  }

  if (!eventRecord.client_email) {
    console.error(`[Handler] Evento ${event_id} no tiene email de cliente`);
    return;
  }

  // 2. Calculate freeze date (event_date - 14 days)
  let freezeDate: string | null = null;
  if (eventRecord.event_date) {
    const eventDate = new Date(eventRecord.event_date);
    eventDate.setDate(eventDate.getDate() - 14);
    freezeDate = eventDate.toISOString().split('T')[0];
  }

  // 3. Create portal (idempotent - won't duplicate if exists)
  const { portal, token } = await createPortal(event_id, freezeDate);
  console.log(`[Handler] Portal ${portal.id} creado para evento ${event_id}`);

  // 4. Send welcome email
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://eventcater.duckdns.org';
  const portalUrl = `${baseUrl}/portal/${token}`;

  try {
    const emailTemplate = await templates.portalWelcome(
      eventRecord.client_name,
      eventRecord.client_email,
      eventRecord.event_type,
      eventRecord.event_date,
      eventRecord.guest_count,
      portalUrl,
      freezeDate
    );

    const result = await sendEmail({
      to: eventRecord.client_email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
    });

    if (result.success) {
      console.log(`[Handler] Email de bienvenida enviado a ${eventRecord.client_email}`);
    } else {
      console.error(`[Handler] Error enviando email: ${result.error}`);
    }
  } catch (error) {
    console.error(`[Handler] Error en email de bienvenida:`, error);
  }

  console.log(`[Handler] deposit.paid completado para evento ${event_id}`);
}
