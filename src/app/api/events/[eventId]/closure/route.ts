/**
 * EventFlow — API Route: Cierre Operativo del Evento (WP-18)
 * GET  /api/events/[eventId]/closure  — Obtener estado del checklist
 * PUT  /api/events/[eventId]/closure  — Actualizar checklist (override)
 * POST /api/events/[eventId]/closure  — Cerrar evento operativamente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import {
  getClosureStatus,
  updateClosureChecklist,
  closeEventOperationally,
  ensureChecklist,
} from '@/domain/closure';

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

// ============================================================
// GET — Obtener estado del checklist
// ============================================================
export async function GET(request: NextRequest, context: RouteContext) {
  const { eventId } = await context.params;

  try {
    // Auth
    const user = await requireAuth();

    const pool = getPool();
    const client = await pool.connect();

    try {
      // Asegurar que exista el checklist
      await ensureChecklist(client, eventId);

      // Obtener estado completo
      const status = await getClosureStatus(eventId);

      return NextResponse.json({
        success: true,
        data: status,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error fetching closure status:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Error al obtener el estado de cierre' },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT — Actualizar checklist (override por Gerente)
// ============================================================
export async function PUT(request: NextRequest, context: RouteContext) {
  const { eventId } = await context.params;

  try {
    // Auth
    const user = await requireAuth();

    const body = await request.json();

    const pool = getPool();
    const client = await pool.connect();

    try {
      // Asegurar que exista el checklist
      await ensureChecklist(client, eventId);

      // Actualizar con overrides
      const checklist = await updateClosureChecklist(
        client,
        eventId,
        {
          logistics_override: body.logistics_override,
          waste_override: body.waste_override,
          hours_override: body.hours_override,
          appcc_override: body.appcc_override,
          override_reason: body.override_reason,
        },
        user.id
      );

      // Obtener estado actualizado
      const status = await getClosureStatus(eventId);

      return NextResponse.json({
        success: true,
        data: {
          checklist,
          status,
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error updating closure checklist:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Error al actualizar el checklist' },
      { status: 400 }
    );
  }
}

// ============================================================
// POST — Cerrar evento operativamente
// ============================================================
export async function POST(request: NextRequest, context: RouteContext) {
  const { eventId } = await context.params;

  try {
    // Auth
    const user = await requireAuth();

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Ejecutar cierre
      const result = await closeEventOperationally(client, eventId, user.id);

      if (!result.success) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 422 }
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Evento cerrado operativamente',
        data: {
          event_id: eventId,
          new_status: 'cerrado_operativo',
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error closing event:', error);
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: error.message || 'Error al cerrar el evento' },
      { status: 500 }
    );
  }
}
