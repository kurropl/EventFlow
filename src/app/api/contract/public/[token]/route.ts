/**
 * EventFlow — Contrato público por token (SPEC Sprint 3, G8)
 * GET /api/contract/public/[token] — token = events.client_token
 *
 * Mismo patrón que guest-forms/decor: acceso público scoped por
 * client_token, sin sesión de admin.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError, sanitizeText, securityHeaders } from '@/lib/security';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = sanitizeText(params.token, 200);

    const event = await querySingle<any>(
      `SELECT id, client_name, event_date FROM events WHERE client_token = $1`,
      [token]
    );
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido' },
        { status: 404, headers: securityHeaders() }
      );
    }

    const contract = await querySingle<any>(
      `SELECT content_html, status, signed_at FROM event_contracts
       WHERE event_id = $1 AND status != 'voided' LIMIT 1`,
      [event.id]
    );
    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'Todavía no se ha generado el contrato de este evento' },
        { status: 404, headers: securityHeaders() }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          content_html: contract.content_html,
          status: contract.status,
          signed_at: contract.signed_at,
          event: { client_name: event.client_name, event_date: event.event_date },
        },
      },
      { headers: securityHeaders() }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}
