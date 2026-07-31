/**
 * EventFlow — Portal Magic Link API
 * POST /api/portal/magic-link — Send magic link to client email
 * POST /api/portal/magic-link (with token) — Validate magic link
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { createMagicLink } from '@/domain/portal';
import { sendEmail, templates } from '@/lib/email';
import { sanitizeError } from '@/lib/security';
import { validateMagicLinkRequest } from '@/lib/portalAuth';

export async function POST(request: NextRequest) {
  try {
    const result = await validateMagicLinkRequest(request);
    
    // If result is a NextResponse, it's an error
    if (result instanceof NextResponse) {
      return result;
    }

    const { email, portalId } = result;

    // If portalId is empty, email not found (but don't reveal)
    if (!portalId) {
      // Return success even if email not found (don't reveal existence)
      return NextResponse.json({
        success: true,
        message: 'Si el email está registrado, recibirás un enlace de acceso.',
      });
    }

    // Get portal and event info
    const portal = await querySingle<{
      id: string;
      event_id: string;
    }>(
      `SELECT id, event_id FROM client_portals WHERE id = $1`,
      [portalId]
    );

    if (!portal) {
      return NextResponse.json({
        success: true,
        message: 'Si el email está registrado, recibirás un enlace de acceso.',
      });
    }

    const event = await querySingle<{
      client_name: string;
      client_email: string;
      event_type: string;
      event_date: string;
    }>(
      `SELECT client_name, client_email, event_type, event_date
       FROM events WHERE id = $1`,
      [portal.event_id]
    );

    if (!event) {
      return NextResponse.json({
        success: true,
        message: 'Si el email está registrado, recibirás un enlace de acceso.',
      });
    }

    // Create magic link
    const { token, expiresAt } = await createMagicLink(portalId, email || event.client_email);

    // Send magic link email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://eventcater.duckdns.org';
    const magicLinkUrl = `${baseUrl}/portal/${token}`;

    try {
      const emailResult = await sendEmail({
        to: email || event.client_email,
        subject: `Tu enlace de acceso a ${event.event_type}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
            <h2 style="color: #C9A84C;">Hola ${event.client_name},</h2>
            <p>Has solicitado acceder a tu portal de cliente.</p>
            <p>Haz clic en el enlace de abajo para acceder (válido durante 24 horas):</p>
            <a href="${magicLinkUrl}" style="display: inline-block; background: #C9A84C; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">Acceder a mi portal</a>
            <p style="color: #6B7280; font-size: 14px;">Si no has solicitado este enlace, puedes ignorar este mensaje.</p>
            <br/>
            <p style="color: #6B7280;">Un saludo,<br/><strong>J.Benitez</strong></p>
          </div>
        `,
      });

      if (emailResult.success) {
        console.log(`[Portal] Magic link enviado a ${email || event.client_email}`);
      } else {
        console.error(`[Portal] Error enviando magic link: ${emailResult.error}`);
      }
    } catch (error) {
      console.error(`[Portal] Error en email de magic link:`, error);
    }

    return NextResponse.json({
      success: true,
      message: 'Si el email está registrado, recibirás un enlace de acceso.',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
