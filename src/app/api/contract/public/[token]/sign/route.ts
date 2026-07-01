/**
 * EventFlow — Firma pública del contrato (SPEC Sprint 3, G8, D2)
 * POST /api/contract/public/[token]/sign
 * Body: { signed_by_name, signed_by_nif, signature_data }
 *
 * D2: firma dibujada — signature_data es el PNG en base64 exportado del
 * canvas de la página pública (contrato/[token]). Una firma en blanco no es
 * válida (se exige un data URI no trivial).
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeText, sanitizeError, securityHeaders, getClientIp } from '@/lib/security';
import { z } from 'zod';

const SignSchema = z.object({
  signed_by_name: z.string().min(1, 'signed_by_name es obligatorio').max(200),
  signed_by_nif: z.string().min(1, 'signed_by_nif es obligatorio').max(20),
  // Un canvas vacío exportado por toDataURL sigue siendo un PNG válido (unos
  // pocos cientos de bytes de cabecera); exigimos un mínimo bastante mayor
  // para descartar una firma en blanco sin trazo real.
  signature_data: z.string().min(500, 'La firma está vacía').startsWith('data:image/'),
});

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = sanitizeText(params.token, 200);
    const body = await request.json();
    const parsed = SignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422, headers: securityHeaders() }
      );
    }

    const event = await querySingle<any>(`SELECT id FROM events WHERE client_token = $1`, [token]);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Enlace no válido' },
        { status: 404, headers: securityHeaders() }
      );
    }

    const contract = await querySingle<any>(
      `SELECT id, status FROM event_contracts WHERE event_id = $1 AND status != 'voided' LIMIT 1`,
      [event.id]
    );
    if (!contract) {
      return NextResponse.json(
        { success: false, error: 'No hay contrato pendiente de firma' },
        { status: 404, headers: securityHeaders() }
      );
    }
    if (contract.status === 'signed') {
      return NextResponse.json(
        { success: false, error: 'Este contrato ya ha sido firmado' },
        { status: 409, headers: securityHeaders() }
      );
    }

    const ip = getClientIp(request);
    const updated = await querySingle<any>(
      `UPDATE event_contracts
       SET status = 'signed', signed_at = now(),
           signed_by_name = $1, signed_by_nif = $2, signature_data = $3, signer_ip = $4
       WHERE id = $5 RETURNING id, status, signed_at, signed_by_name, signed_by_nif`,
      [
        sanitizeText(parsed.data.signed_by_name, 200),
        sanitizeText(parsed.data.signed_by_nif, 20),
        parsed.data.signature_data,
        ip,
        contract.id,
      ]
    );

    return NextResponse.json({ success: true, data: updated }, { headers: securityHeaders() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}
