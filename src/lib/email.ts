/**
 * EventFlow — Email module
 * Supports Nodemailer (SMTP) or falls back to console logging.
 *
 * Env vars:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *   or RESEND_API_KEY (uses Resend API)
 */
import { querySingle } from './db';
import { formatEUR } from '@/lib/format';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/* ── Get business config from DB ── */
async function getBusinessConfig() {
  try {
    const row = await querySingle<{ business_name: string; email: string; phone: string; address: string }>(
      `SELECT business_name, email, phone, address FROM business_settings LIMIT 1`
    );
    return row || { business_name: 'J.Benitez', email: '', phone: '', address: 'Sevilla' };
  } catch {
    return { business_name: 'J.Benitez', email: '', phone: '', address: 'Sevilla' };
  }
}

/* ── Send email via Nodemailer ── */
async function sendViaSMTP(msg: EmailMessage): Promise<EmailResult> {
  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const info = await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@jbenitez.es',
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
    });
    return { success: true, messageId: info.messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'SMTP error' };
  }
}

/* ── Send email via Resend ── */
async function sendViaResend(msg: EmailMessage): Promise<EmailResult> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { success: false, error: 'No RESEND_API_KEY' };

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.SMTP_FROM || 'J.Benitez <noreply@jbenitez.es>',
        to: [msg.to],
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      }),
    });
    const data = await res.json();
    if (res.ok) return { success: true, messageId: data.id };
    return { success: false, error: data.message || 'Resend error' };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Resend error' };
  }
}

/* ── Log to console (fallback) ── */
async function logEmail(msg: EmailMessage): Promise<EmailResult> {
  console.log('[EMAIL LOG]', {
    to: msg.to,
    subject: msg.subject,
    timestamp: new Date().toISOString(),
  });
  return { success: true, messageId: `log-${Date.now()}` };
}

/* ── Main send function ── */
export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  // Try providers in order: Resend > SMTP > console log
  if (process.env.RESEND_API_KEY) {
    return sendViaResend(msg);
  }
  if (process.env.SMTP_HOST) {
    return sendViaSMTP(msg);
  }
  // No email provider configured — log only
  console.warn('[EMAIL] No SMTP_HOST or RESEND_API_KEY configured. Logging only.');
  return logEmail(msg);
}

/* ── Save to email_queue ── */
export async function queueEmail(params: {
  event_id?: string;
  recipient_email: string;
  recipient_name?: string;
  subject: string;
  body: string;
  email_type: string;
  scheduled_for?: Date;
}) {
  const { querySingle: qs } = await import('./db');
  const row = await qs<any>(
    `INSERT INTO email_queue (event_id, recipient_email, recipient_name, subject, body, email_type, scheduled_for)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      params.event_id || null,
      params.recipient_email,
      params.recipient_name || null,
      params.subject,
      params.body,
      params.email_type,
      params.scheduled_for || new Date(),
    ]
  );
  return row;
}

/* ── Process queue (send pending emails) ── */
export async function processEmailQueue(): Promise<{ sent: number; failed: number }> {
  const { queryMany, querySingle: qs } = await import('./db');
  const pending = await queryMany<any>(
    `SELECT * FROM email_queue WHERE status = 'pending' AND scheduled_for <= NOW() ORDER BY created_at LIMIT 10`
  );
  let sent = 0;
  let failed = 0;
  for (const email of pending) {
    const result = await sendEmail({
      to: email.recipient_email,
      subject: email.subject,
      html: email.body,
    });
    if (result.success) {
      await qs(`UPDATE email_queue SET status = 'sent', sent_at = NOW(), message_id = $1 WHERE id = $2`, [result.messageId, email.id]);
      sent++;
    } else {
      await qs(`UPDATE email_queue SET status = 'failed', error_message = $1 WHERE id = $2`, [result.error, email.id]);
      failed++;
    }
  }
  return { sent, failed };
}

/* ── Email templates ── */
export const templates = {
  async newLead(name: string, email: string) {
    const config = await getBusinessConfig();
    return {
      subject: `${config.business_name} - Hemos recibido tu consulta`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
          <h2 style="color: #C9A84C;">Hola ${name},</h2>
          <p>Gracias por contactar con <strong>${config.business_name}</strong>.</p>
          <p>Hemos recibido tu consulta y te responderemos en menos de 24 horas con un presupuesto personalizado.</p>
          <p>Si tienes alguna pregunta urgente, puedes llamarnos al <strong>${config.phone}</strong>.</p>
          <br/>
          <p style="color: #6B7280;">Un saludo,<br/><strong>${config.business_name}</strong><br/>${config.address}</p>
        </div>
      `,
    };
  },

  async quoteSent(name: string, email: string, quoteId: string, total: number, validUntil: string) {
    const config = await getBusinessConfig();
    const acceptUrl = `https://eventcater.duckdns.org/presupuesto/${quoteId}`;
    return {
      subject: `${config.business_name} - Tu presupuesto esta listo`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
          <h2 style="color: #C9A84C;">Hola ${name},</h2>
          <p>Tu presupuesto personalizado esta listo para revisar:</p>
          <div style="background: #FAF8F5; border-radius: 12px; padding: 20px; margin: 16px 0;">
            <p style="font-size: 24px; font-weight: bold; color: #C9A84C; margin: 0;">${formatEUR(total)}</p>
            <p style="color: #6B7280; margin: 8px 0 0;">Total presupuesto (IVA incluido)</p>
          </div>
          <p>El presupuesto es valido hasta el <strong>${validUntil}</strong>.</p>
          <a href="${acceptUrl}" style="display: inline-block; background: #C9A84C; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Ver presupuesto</a>
          <br/><br/>
          <p style="color: #6B7280;">Un saludo,<br/><strong>${config.business_name}</strong><br/>${config.address}</p>
        </div>
      `,
    };
  },

  async paymentReminder(name: string, email: string, amount: number, eventType: string, eventDate: string) {
    const config = await getBusinessConfig();
    return {
      subject: `${config.business_name} - Recordatorio de pago`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
          <h2 style="color: #C9A84C;">Hola ${name},</h2>
          <p>Te recordamos que tienes un pago pendiente para tu ${eventType} del <strong>${eventDate}</strong>:</p>
          <div style="background: #FEF3C7; border-radius: 12px; padding: 20px; margin: 16px 0; border: 1px solid #F59E0B;">
            <p style="font-size: 24px; font-weight: bold; color: #D97706; margin: 0;">${formatEUR(amount)}</p>
            <p style="color: #92400E; margin: 8px 0 0;">Importe pendiente</p>
          </div>
          <p>Por favor, realiza el pago a la mayor brevedad posible.</p>
          <br/>
          <p style="color: #6B7280;">Un saludo,<br/><strong>${config.business_name}</strong></p>
        </div>
      `,
    };
  },

  async postEventFollowUp(name: string, email: string, eventType: string, eventDate: string) {
    const config = await getBusinessConfig();
    return {
      subject: `${config.business_name} - Esperamos que disfrutaste de tu evento`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
          <h2 style="color: #C9A84C;">Hola ${name},</h2>
          <p>Esperamos que tu ${eventType} del <strong>${eventDate}</strong> haya sido un exito.</p>
          <p>Nos encantaria conocer tu experiencia. Si tienes algun comentario o sugerencia, no dudes en escribirnos.</p>
          <p>Si conoces a alguien que este buscando un salon de celebraciones, nos encantaria que nos recomendases.</p>
          <br/>
          <p style="color: #6B7280;">Un saludo,<br/><strong>${config.business_name}</strong><br/>${config.address}</p>
        </div>
      `,
    };
  },

  async portalWelcome(
    name: string,
    email: string,
    eventType: string,
    eventDate: string,
    guestCount: number,
    portalUrl: string,
    freezeDate: string | null
  ) {
    const config = await getBusinessConfig();
    const formattedDate = eventDate
      ? new Date(eventDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'por confirmar';
    const formattedFreeze = freezeDate
      ? new Date(freezeDate).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
      : null;
    
    return {
      subject: `${config.business_name} - Tu portal de cliente está listo`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
          <h2 style="color: #C9A84C;">Hola ${name},</h2>
          <p>¡Tu ${eventType} del <strong>${formattedDate}</strong> está confirmado!</p>
          <p>Hemos creado tu <strong>portal personalizado</strong> donde podrás gestionar todos los detalles de tu evento:</p>
          
          <div style="background: #FAF8F5; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <ul style="margin: 0; padding-left: 20px; line-height: 1.8;">
              <li>📋 <strong>Invitados:</strong> Gestiona tu lista y envía invitaciones</li>
              <li>🪑 <strong>Mesas:</strong> Distribuye a tus invitados en el salón</li>
              <li>🍽️ <strong>Menú:</strong> Selecciona variantes para cada invitado</li>
              <li>✨ <strong>Extras:</strong> Añade centros de mesa, decoración y más</li>
              <li>💬 <strong>Mensajes:</strong> Comunícate directamente con nuestro equipo</li>
            </ul>
          </div>

          ${formattedFreeze ? `
          <div style="background: #FEF3C7; border-radius: 8px; padding: 12px 16px; margin: 16px 0; border: 1px solid #F59E0B;">
            <strong style="color: #D97706;">⚠️ Fecha límite:</strong> Las listas se congelarán el <strong>${formattedFreeze}</strong>.<br/>
            Asegúrate de completar todos los cambios antes de esa fecha.
          </div>
          ` : ''}

          <a href="${portalUrl}" style="display: inline-block; background: #C9A84C; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0; font-size: 16px;">Acceder a mi portal</a>
          
          <p style="color: #6B7280; font-size: 14px; margin-top: 24px;">
            Guarda este enlace. Lo necesitarás para acceder a tu portal en cualquier momento.<br/>
            Si tienes ${guestCount > 0 ? `${guestCount} invitados confirmados` : 'invitados pendientes de confirmar'}, puedes empezar a gestionarlos ahora.
          </p>
          <br/>
          <p style="color: #6B7280;">Un saludo,<br/><strong>${config.business_name}</strong><br/>${config.address}</p>
        </div>
      `,
    };
  },
};
