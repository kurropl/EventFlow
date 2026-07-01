/**
 * EventFlow — Reasignar propietario comercial de un lead (SPEC Sprint 4, G13)
 * PATCH /api/leads/[id]/assign  { assigned_to: string | null }
 *
 * E-B4: assigned_to vive solo en leads (fuente única) — reasignar aquí
 * reasigna automáticamente todos los presupuestos/eventos derivados de este
 * lead, al resolverse siempre por join a través de quotes.lead_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { z } from 'zod';

const AssignSchema = z.object({
  assigned_to: z.string().uuid().nullable(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'id inválido' }, { status: 422 });
    }
    const body = await request.json();
    const parsed = AssignSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422 }
      );
    }

    const updated = await querySingle<any>(
      `UPDATE leads SET assigned_to = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [parsed.data.assigned_to, params.id]
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: 'Lead no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
