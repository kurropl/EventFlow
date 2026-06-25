/**
 * EventFlow — Memo por trabajador (FR-A12)
 * GET /api/briefing/[eventId]/memo
 *
 * Compone, para cada camarero asignado al evento, su memo individual con los
 * datos que necesita la noche antes: evento, horario y zona, uniforme, menú,
 * mantelería, protocolo, barra libre, intolerancias y anotaciones.
 *
 * Es la pieza que el cron `pre-event-briefing` (T-1) envía por WhatsApp/email.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

const fmtTime = (d: string | null) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export async function GET(_req: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    const ev = await querySingle<any>(
      `SELECT id, client_name, event_date, guest_count, kids_count,
              COALESCE(service_type,'menu') AS service_type,
              COALESCE(venue_type,'benitez') AS venue_type, location,
              linen_type, centerpiece, bar_hours, notes
       FROM events WHERE id = $1`,
      [params.eventId]
    );
    if (!ev) return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });

    const fecha = ev.event_date ? new Date(ev.event_date).toLocaleDateString('es-ES') : 's/f';
    const lugar = ev.venue_type === 'externo' ? (ev.location || 'Ubicación externa') : 'Salones Benítez';
    const barra = Number(ev.bar_hours) > 0 ? `${ev.bar_hours} h de barra libre` : 'Sin barra libre';
    const menu = (await queryMany<any>(
      `SELECT name FROM event_menu_items WHERE event_id = $1 AND kind = 'seleccionado' ORDER BY service_round, name`,
      [params.eventId]
    )).map((m) => m.name);

    const asignados = await queryMany<any>(
      `SELECT w.id AS worker_id, w.name AS worker_name, w.phone,
              sl.role, sl.uniform, sl.location AS zona, sl.start_time, sl.end_time
       FROM staffing_assignments sa
       JOIN workers w ON w.id = sa.worker_id
       JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
       WHERE sl.event_id = $1
       ORDER BY w.name`,
      [params.eventId]
    );

    const memos = asignados.map((a) => {
      const horario = fmtTime(a.start_time) && fmtTime(a.end_time)
        ? `${fmtTime(a.start_time)}–${fmtTime(a.end_time)}` : 'Por confirmar';
      const lineas = [
        `Hola ${a.worker_name}, memo para el evento de ${ev.client_name} (${fecha}).`,
        `📍 Lugar: ${lugar}`,
        `🕒 Horario: ${horario}${a.zona ? ` · Zona: ${a.zona}` : ''}`,
        `👤 Puesto: ${a.role}${a.uniform ? ` · Uniforme: ${a.uniform}` : ''}`,
        `🍽️ Servicio: ${ev.service_type === 'coctel' ? 'cóctel' : 'menú'} · ${ev.guest_count} comensales`,
        menu.length ? `📋 Menú: ${menu.join(', ')}` : null,
        `🍸 Barra: ${barra}`,
        ev.linen_type ? `🧺 Mantelería: ${ev.linen_type}` : null,
        ev.centerpiece ? `💐 Centro de mesa: ${ev.centerpiece}` : null,
        ev.notes ? `📝 Anotaciones: ${ev.notes}` : null,
      ].filter(Boolean);
      return {
        worker_id: a.worker_id,
        worker_name: a.worker_name,
        phone: a.phone,
        role: a.role,
        memo: lineas.join('\n'),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        event_id: ev.id,
        evento: ev.client_name,
        fecha,
        lugar,
        venue_type: ev.venue_type,
        total_memos: memos.length,
        memos,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
