/**
 * EventFlow — Worker Trace Endpoint (CORREGIDO)
 * GET /api/staffing/trace/[workerId]
 * Desde un trabajador, responde en qué eventos y presupuestos ha participado
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id?: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID de trabajador requerido.' },
        { status: 400 }
      );
    }

    if (!UUID_REGEX.test(id)) {
      return NextResponse.json(
        { success: false, error: 'ID de trabajador inválido.' },
        { status: 422 }
      );
    }

    // 1. El trabajador
    const worker = await querySingle<any>('SELECT * FROM workers WHERE id = $1', [id]);
    if (!worker) {
      return NextResponse.json(
        { success: false, error: 'Trabajador no encontrado.' },
        { status: 404 }
      );
    }

    // 2. Todas las asignaciones + eventos
    const assignments = await queryMany<any>(
      `SELECT sa.*, sl.event_id, sl.role AS staffing_role, sl.slots_needed,
              e.client_name, e.event_date, e.status AS event_status,
              q.id AS quote_id
       FROM staffing_assignments sa
       JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
       JOIN events e ON e.id = sl.event_id
       LEFT JOIN quotes q ON q.id = e.quote_id
       WHERE sa.worker_id = $1
       ORDER BY e.event_date DESC`,
      [id]
    );

    // 3. Agrupar por evento
    const eventsMap = new Map<string, any>();
    for (const a of assignments) {
      if (!eventsMap.has(a.event_id)) {
        eventsMap.set(a.event_id, {
          event_id: a.event_id,
          client_name: a.client_name,
          event_date: a.event_date,
          event_status: a.event_status,
          quote_id: a.quote_id,
          roles: [a.staffing_role],
          total_hours: 0,
        });
      } else {
        const entry = eventsMap.get(a.event_id)!;
        if (!entry.roles.includes(a.staffing_role)) {
          entry.roles.push(a.staffing_role);
        }
      }
    }

    // 4. Información de pago por evento
    const payEntries = await queryMany<any>(
      `SELECT wep.event_id, wep.hours, wep.hourly_rate, wep.total_pay, wep.status AS pay_status
       FROM worker_event_pay wep
       WHERE wep.worker_id = $1`,
      [id]
    );

    const payByEvent = new Map<string, any>();
    for (const p of payEntries) {
      payByEvent.set(p.event_id, p);
    }

    const events = Array.from(eventsMap.values()).map((ev) => {
      const pay = payByEvent.get(ev.event_id);
      return {
        ...ev,
        pay: pay
          ? {
              hours: Number(pay.hours) || 0,
              hourly_rate: Number(pay.hourly_rate) || 0,
              total_pay: Number(pay.total_pay) || 0,
              status: pay.pay_status,
            }
          : null,
      };
    });

    // 5. Presupuestos únicos
    const quoteIds = [
      ...new Set(events.filter((e) => e.quote_id).map((e) => e.quote_id)),
    ];
    const quotes =
      quoteIds.length > 0
        ? await queryMany<any>('SELECT * FROM quotes WHERE id = ANY($1)', [quoteIds])
        : [];

    // 6. Totales
    const totalPay = payEntries.reduce((sum: number, p: any) => sum + Number(p.total_pay || 0), 0);
    const totalHours = payEntries.reduce((sum: number, p: any) => sum + Number(p.hours || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        worker,
        assignments: assignments,
        events,
        quotes,
        summary: {
          total_events: events.length,
          total_assignments: assignments.length,
          total_pay: totalPay,
          total_hours: totalHours,
        },
      },
    });
  } catch (error) {
    console.error('[worker trace] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener trazabilidad del trabajador.' },
      { status: 500 }
    );
  }
}