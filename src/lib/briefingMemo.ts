/**
 * EventFlow — Dominio: memo individual por trabajador (FR-A12)
 *
 * Única fuente del contenido del memo de briefing (antes duplicada de facto
 * entre GET /api/briefing/[eventId]/memo y lo que el cron pre-event-briefing
 * hubiera necesitado recomponer). Ambos la consumen.
 */
import { querySingle, queryMany } from '@/lib/db';

export interface WorkerMemo {
  worker_id: string;
  worker_name: string;
  phone: string | null;
  role: string;
  memo: string;
}

export interface EventMemos {
  event_id: string;
  evento: string;
  fecha: string;
  lugar: string;
  venue_type: string;
  total_memos: number;
  memos: WorkerMemo[];
}

const fmtTime = (d: string | null) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export async function generateEventMemos(eventId: string): Promise<EventMemos | null> {
  const ev = await querySingle<any>(
    `SELECT id, client_name, event_date, guest_count, kids_count,
            COALESCE(service_type,'menu') AS service_type,
            COALESCE(venue_type,'benitez') AS venue_type, location,
            linen_type, centerpiece, bar_hours, notes, protocol_notes
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (!ev) return null;

  const fecha = ev.event_date ? new Date(ev.event_date).toLocaleDateString('es-ES') : 's/f';
  const lugar = ev.venue_type === 'externo' ? (ev.location || 'Ubicación externa') : 'Salones Benítez';
  const barra = Number(ev.bar_hours) > 0 ? `${ev.bar_hours} h de barra libre` : 'Sin barra libre';

  // Sprint 6 (F0.2/F4.3): intolerancias (ci.allergens) — el docstring de esta
  // pieza ya prometía "intolerancias" pero nunca se consultaban (columna
  // inexistente hasta este sprint).
  const menuRows = await queryMany<any>(
    `SELECT emi.name, ci.allergens
     FROM event_menu_items emi
     LEFT JOIN catalog_items ci ON ci.name = emi.name
     WHERE emi.event_id = $1 AND emi.kind = 'seleccionado'
     ORDER BY emi.service_round, emi.name`,
    [eventId]
  );
  const menu = menuRows.map((m) => m.name);
  const intolerancias = Array.from(
    new Set(menuRows.flatMap((m) => (Array.isArray(m.allergens) ? m.allergens : [])))
  );

  const asignados = await queryMany<any>(
    `SELECT w.id AS worker_id, w.name AS worker_name, w.phone,
            sl.role, sl.uniform, sl.location AS zona, sl.start_time, sl.end_time
     FROM staffing_assignments sa
     JOIN workers w ON w.id = sa.worker_id
     JOIN staffing_lines sl ON sl.id = sa.staffing_line_id
     WHERE sl.event_id = $1
     ORDER BY w.name`,
    [eventId]
  );

  const memos: WorkerMemo[] = asignados.map((a) => {
    const horario = fmtTime(a.start_time) && fmtTime(a.end_time)
      ? `${fmtTime(a.start_time)}–${fmtTime(a.end_time)}` : 'Por confirmar';
    const lineas = [
      `Hola ${a.worker_name}, memo para el evento de ${ev.client_name} (${fecha}).`,
      `📍 Lugar: ${lugar}`,
      `🕒 Horario: ${horario}${a.zona ? ` · Zona: ${a.zona}` : ''}`,
      `👤 Puesto: ${a.role}${a.uniform ? ` · Uniforme: ${a.uniform}` : ''}`,
      `🍽️ Servicio: ${ev.service_type === 'coctel' ? 'cóctel' : 'menú'} · ${ev.guest_count} comensales`,
      menu.length ? `📋 Menú: ${menu.join(', ')}` : null,
      intolerancias.length ? `⚠️ Intolerancias/alérgenos del menú: ${intolerancias.join(', ')}` : null,
      `🍸 Barra: ${barra}`,
      ev.linen_type ? `🧺 Mantelería: ${ev.linen_type}` : null,
      ev.centerpiece ? `💐 Centro de mesa: ${ev.centerpiece}` : null,
      ev.protocol_notes ? `🎩 Protocolo: ${ev.protocol_notes}` : null,
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

  return {
    event_id: ev.id,
    evento: ev.client_name,
    fecha,
    lugar,
    venue_type: ev.venue_type,
    total_memos: memos.length,
    memos,
  };
}
