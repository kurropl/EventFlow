/**
 * EventFlow — Public Decoration-by-token API (SECURED)
 * PATCH /api/guest-forms/decor — Save linen_type/centerpiece scoped by event_token.
 * No auth required (token-scoped), mirrors guest-forms/route.ts security posture.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeText, securityHeaders, sanitizeError } from '@/lib/security';
import { z } from 'zod';

const DecorPatchSchema = z.object({
  event_token: z.string().min(1, 'event_token is required').max(200),
  linen_type: z.string().max(50).optional(),
  centerpiece: z.string().max(50).optional(),
});

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = DecorPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422, headers: securityHeaders() }
      );
    }

    const { event_token, linen_type, centerpiece } = parsed.data;
    const eventToken = sanitizeText(event_token, 200);

    const event = await querySingle<{ id: string; status: string }>(
      `SELECT id, status FROM events WHERE client_token = $1`,
      [eventToken]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404, headers: securityHeaders() }
      );
    }

    if (event.status !== 'accepted') {
      return NextResponse.json(
        { success: false, error: 'Este evento aún no está confirmado' },
        { status: 403, headers: securityHeaders() }
      );
    }

    const fields: string[] = [];
    const vals: any[] = [];
    let p = 1;
    if (linen_type !== undefined) { fields.push(`linen_type = $${p++}`); vals.push(sanitizeText(linen_type, 50)); }
    if (centerpiece !== undefined) { fields.push(`centerpiece = $${p++}`); vals.push(sanitizeText(centerpiece, 50)); }

    if (fields.length === 0) {
      return NextResponse.json({ success: false, error: 'Nada que guardar' }, { status: 400, headers: securityHeaders() });
    }

    vals.push(event.id);
    const updated = await querySingle<any>(
      `UPDATE events SET ${fields.join(', ')} WHERE id = $${p} RETURNING linen_type, centerpiece`,
      vals
    );

    return NextResponse.json({ success: true, data: updated }, { headers: securityHeaders() });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500, headers: securityHeaders() });
  }
}
