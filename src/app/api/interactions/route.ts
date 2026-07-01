/**
 * EventFlow — Historial de interacciones CRM (SPEC Sprint 4, G13)
 * GET  /api/interactions?lead_id=x | ?event_id=x — timeline
 * POST /api/interactions — registrar llamada/email/whatsapp/nota/reunión
 *
 * Deliberadamente separado de audit_log (ledger inmutable de transiciones
 * de estado) — estas son notas editables de un comercial, otro concepto.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';

const INTERACTION_TYPES = ['llamada', 'email', 'whatsapp', 'nota', 'reunion'] as const;

const CreateInteractionSchema = z.object({
  lead_id: z.string().uuid().optional().nullable(),
  event_id: z.string().uuid().optional().nullable(),
  type: z.enum(INTERACTION_TYPES),
  notes: z.string().max(2000).optional().nullable(),
}).refine((d) => d.lead_id || d.event_id, { message: 'lead_id o event_id es obligatorio' });

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('lead_id');
    const eventId = searchParams.get('event_id');

    if (!leadId && !eventId) {
      return NextResponse.json({ success: false, error: 'lead_id o event_id es obligatorio' }, { status: 422 });
    }
    if ((leadId && !isValidUUID(leadId)) || (eventId && !isValidUUID(eventId))) {
      return NextResponse.json({ success: false, error: 'id inválido' }, { status: 422 });
    }

    const conds: string[] = [];
    const params: string[] = [];
    if (leadId) { conds.push(`i.lead_id = $${params.length + 1}`); params.push(leadId); }
    if (eventId) { conds.push(`i.event_id = $${params.length + 1}`); params.push(eventId); }

    const rows = await queryMany<any>(
      `SELECT i.*, a.name AS created_by_name
       FROM interactions i
       LEFT JOIN admins a ON a.id = i.created_by
       WHERE ${conds.join(' OR ')}
       ORDER BY i.created_at DESC`,
      params
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateInteractionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422 }
      );
    }

    // El admin "maestro" por variables de entorno tiene id sintético
    // 'admin-1', que no es una fila real de `admins` y no puede usarse como FK.
    const currentUser = await getCurrentUser();
    const createdBy = currentUser?.id && isValidUUID(currentUser.id) ? currentUser.id : null;
    const created = await querySingle<any>(
      `INSERT INTO interactions (lead_id, event_id, type, notes, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        parsed.data.lead_id ?? null,
        parsed.data.event_id ?? null,
        parsed.data.type,
        parsed.data.notes ? sanitizeText(parsed.data.notes, 2000) : null,
        createdBy,
      ]
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
