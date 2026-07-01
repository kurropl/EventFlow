/**
 * EventFlow — Reserva de menaje/equipamiento por evento (SPEC Sprint 4, G12)
 * GET   /api/cocina/equipment/checkout/[eventId] — lista la reserva del evento
 * PATCH /api/cocina/equipment/checkout/[eventId] — marcar enviado/devuelto
 *
 * La reserva en sí se crea automáticamente al generar la hoja de logística
 * (generateLogisticsSheet, solo eventos externos — E-B2). Esta ruta cubre
 * el ciclo de vida posterior: marcar la carga del camión y el retorno con
 * notas de rotura/merma.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';
import { markEquipmentCheckedOut, markEquipmentReturned } from '@/lib/domain/equipmentCheckout';
import { z } from 'zod';

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    if (!isValidUUID(params.eventId)) {
      return NextResponse.json({ success: false, error: 'eventId inválido' }, { status: 422 });
    }
    const rows = await queryMany<any>(
      `SELECT eec.*, e.name AS equipment_name, e.unit
       FROM event_equipment_checkout eec
       JOIN equipment e ON e.id = eec.equipment_id
       WHERE eec.event_id = $1
       ORDER BY e.name`,
      [params.eventId]
    );
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

const PatchSchema = z.object({
  action: z.enum(['sent', 'return']),
  equipment_id: z.string().uuid().optional(),
  quantity_returned: z.number().min(0).optional(),
  condition_notes: z.string().max(1000).nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    if (!isValidUUID(params.eventId)) {
      return NextResponse.json({ success: false, error: 'eventId inválido' }, { status: 422 });
    }
    const body = await request.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422 }
      );
    }

    const pool = getPool();
    if (parsed.data.action === 'sent') {
      await markEquipmentCheckedOut(pool, params.eventId);
      return NextResponse.json({ success: true });
    }

    // action === 'return'
    if (!parsed.data.equipment_id || parsed.data.quantity_returned === undefined) {
      return NextResponse.json(
        { success: false, error: 'equipment_id y quantity_returned son obligatorios para marcar devolución' },
        { status: 422 }
      );
    }
    const updated = await markEquipmentReturned(
      pool,
      params.eventId,
      parsed.data.equipment_id,
      parsed.data.quantity_returned,
      parsed.data.condition_notes ? sanitizeText(parsed.data.condition_notes, 1000) : null
    );
    if (!updated) {
      return NextResponse.json({ success: false, error: 'No hay reserva para ese evento+equipo' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
