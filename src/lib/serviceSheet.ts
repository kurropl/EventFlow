/**
 * EventFlow — Motor de generación de Hoja de Servicio (WP-19)
 *
 * Genera la hoja de servicio completa para un evento:
 * 1. Timing / Cronograma (event_plans category='timing')
 * 2. Distribución por zonas (tables + table_assignments)
 * 3. Turnos confirmados (staffing_lines + staffing_assignments)
 * 4. Dietas especiales por mesa (guests.dietary + table_assignments)
 *
 * Se calcula en caliente — misma filosofía que cocinaSheets.ts.
 */

import { getPool } from '@/lib/db';

// ── Interfaces ───────────────────────────────────────────────

export interface TimingItem {
  id: string;
  title: string;
  description: string | null;
  planned_time: string | null;
  category: string;
  completed: boolean;
  sort_order: number;
}

export interface TableZone {
  table_id: string;
  table_number: number;
  capacity: number;
  shape: string;
  guests: TableGuest[];
  dietary_summary: DietarySummary;
}

export interface TableGuest {
  guest_id: string | null;
  guest_name: string;
  seat_number: number;
  rsvp: string;
  menu_type: string;
  dietary: string[];
  dietary_notes: string | null;
}

export interface DietarySummary {
  total: number;
  by_type: Record<string, number>;        // { adulto: 5, nino: 2 }
  special: DietarySpecial[];
}

export interface DietarySpecial {
  type: string;   // 'celiaco', 'vegetariano', 'vegano', 'sin_gluten', etc.
  count: number;
  guests: string[];
}

export interface ShiftInfo {
  id: string;
  role: string;
  slots_needed: number;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  uniform: string | null;
  notes: string | null;
  status: string;
  assigned: ShiftAssignment[];
}

export interface ShiftAssignment {
  worker_name: string;
  worker_phone: string;
  position: number;
  confirmed_at: string;
}

export interface ServiceSheetData {
  event: {
    id: string;
    name: string;
    date: string | null;
    guest_count: number;
    kids_count: number;
    venue_type: string;
    location: string | null;
    status: string;
    service_type: string;
  };
  timing: TimingItem[];
  zones: TableZone[];
  shifts: ShiftInfo[];
  dietary_overview: {
    total_guests: number;
    confirmed: number;
    pending: number;
    rejected: number;
    by_menu_type: Record<string, number>;
    special_diets: DietarySpecial[];
  };
  generated_at: string;
}

// ── Función principal ────────────────────────────────────────

export async function generateServiceSheet(eventId: string): Promise<ServiceSheetData | null> {
  const pool = getPool();

  // 1. Datos del evento
  const eventResult = await pool.query(
    `SELECT id, client_name, event_date, guest_count, kids_count,
            COALESCE(venue_type, 'benitez') AS venue_type,
            location, status, event_type
     FROM events WHERE id = $1`,
    [eventId]
  );

  if (!eventResult.rows.length) return null;

  const ev = eventResult.rows[0];

  // 2. Timing / Cronograma
  const timingResult = await pool.query(
    `SELECT id, title, description, planned_time, category, completed, sort_order
     FROM event_plans
     WHERE event_id = $1
     ORDER BY sort_order ASC, planned_time ASC NULLS LAST`,
    [eventId]
  );

  // 3. Mesas + asignaciones
  const tablesResult = await pool.query(
    `SELECT t.id, t.table_number, t.capacity, t.shape
     FROM tables t
     WHERE t.event_id = $1
     ORDER BY t.table_number ASC`,
    [eventId]
  );

  const assignmentsResult = await pool.query(
    `SELECT ta.table_id, ta.guest_id, ta.guest_name, ta.seat_number, ta.dietary_notes,
            g.rsvp, g.menu_type, g.dietary
     FROM table_assignments ta
     LEFT JOIN guests g ON g.id = ta.guest_id
     WHERE ta.event_id = $1
     ORDER BY ta.table_id, ta.seat_number`,
    [eventId]
  );

  // 4. Staffing (líneas + asignaciones confirmadas)
  const staffingResult = await pool.query(
    `SELECT sl.id, sl.role, sl.slots_needed, sl.start_time, sl.end_time,
            sl.location, sl.uniform, sl.notes, sl.status
     FROM staffing_lines sl
     WHERE sl.event_id = $1
     ORDER BY sl.start_time ASC NULLS LAST, sl.role ASC`,
    [eventId]
  );

  // Asignaciones para cada línea
  const shiftMap = new Map<string, ShiftAssignment[]>();
  if (staffingResult.rows.length > 0) {
    const lineIds = staffingResult.rows.map((r: any) => r.id);
    const assignmentsResult2 = await pool.query(
      `SELECT sa.staffing_line_id, w.name AS worker_name, w.phone AS worker_phone,
              sa.position, sa.confirmed_at
       FROM staffing_assignments sa
       JOIN workers w ON w.id = sa.worker_id
       WHERE sa.staffing_line_id = ANY($1::uuid[])
       ORDER BY sa.position ASC`,
      [lineIds]
    );

    for (const a of assignmentsResult2.rows) {
      if (!shiftMap.has(a.staffing_line_id)) shiftMap.set(a.staffing_line_id, []);
      shiftMap.get(a.staffing_line_id)!.push({
        worker_name: a.worker_name,
        worker_phone: a.worker_phone,
        position: a.position,
        confirmed_at: a.confirmed_at,
      });
    }
  }

  // 5. Todos los invitados (para overview dietary)
  const guestsResult = await pool.query(
    `SELECT name, rsvp, menu_type, dietary
     FROM guests WHERE event_id = $1`,
    [eventId]
  );

  // ── Construir zonas ──────────────────────────────────────
  const assignmentsByTable = new Map<string, any[]>();
  for (const a of assignmentsResult.rows) {
    if (!assignmentsByTable.has(a.table_id)) assignmentsByTable.set(a.table_id, []);
    assignmentsByTable.get(a.table_id)!.push(a);
  }

  const zones: TableZone[] = tablesResult.rows.map((t: any) => {
    const guests = (assignmentsByTable.get(t.id) || []).map((a: any) => ({
      guest_id: a.guest_id,
      guest_name: a.guest_name,
      seat_number: a.seat_number,
      rsvp: a.rsvp || 'pendiente',
      menu_type: a.menu_type || 'adulto',
      dietary: Array.isArray(a.dietary) ? a.dietary : (a.dietary ? [a.dietary] : []),
      dietary_notes: a.dietary_notes,
    }));

    const byType: Record<string, number> = {};
    const specialMap = new Map<string, { count: number; guests: string[] }>();

    for (const g of guests) {
      byType[g.menu_type] = (byType[g.menu_type] || 0) + 1;
      for (const d of g.dietary) {
        const key = String(d).toLowerCase();
        if (!specialMap.has(key)) specialMap.set(key, { count: 0, guests: [] });
        const entry = specialMap.get(key)!;
        entry.count++;
        entry.guests.push(g.guest_name);
      }
    }

    return {
      table_id: t.id,
      table_number: t.table_number,
      capacity: t.capacity,
      shape: t.shape,
      guests,
      dietary_summary: {
        total: guests.length,
        by_type: byType,
        special: Array.from(specialMap.entries()).map(([type, data]) => ({
          type,
          count: data.count,
          guests: data.guests,
        })),
      },
    };
  });

  // ── Construir shifts ─────────────────────────────────────
  const shifts: ShiftInfo[] = staffingResult.rows.map((s: any) => ({
    id: s.id,
    role: s.role,
    slots_needed: s.slots_needed,
    start_time: s.start_time,
    end_time: s.end_time,
    location: s.location,
    uniform: s.uniform,
    notes: s.notes,
    status: s.status,
    assigned: shiftMap.get(s.id) || [],
  }));

  // ── Overview dietary ─────────────────────────────────────
  const allGuests = guestsResult.rows;
  const byMenuType: Record<string, number> = {};
  const confirmed = allGuests.filter((g: any) => g.rsvp === 'confirmado').length;
  const pending = allGuests.filter((g: any) => g.rsvp === 'pendiente').length;
  const rejected = allGuests.filter((g: any) => g.rsvp === 'rechazado').length;

  const specialMapGlobal = new Map<string, { count: number; guests: string[] }>();
  for (const g of allGuests) {
    const mt = g.menu_type || 'adulto';
    byMenuType[mt] = (byMenuType[mt] || 0) + 1;
    const dietArr = Array.isArray(g.dietary) ? g.dietary : (g.dietary ? [g.dietary] : []);
    for (const d of dietArr) {
      const key = String(d).toLowerCase();
      if (!specialMapGlobal.has(key)) specialMapGlobal.set(key, { count: 0, guests: [] });
      const entry = specialMapGlobal.get(key)!;
      entry.count++;
      entry.guests.push(g.name);
    }
  }

  return {
    event: {
      id: ev.id,
      name: ev.client_name,
      date: ev.event_date,
      guest_count: Number(ev.guest_count) || 0,
      kids_count: Number(ev.kids_count) || 0,
      venue_type: ev.venue_type,
      location: ev.location,
      status: ev.status,
      // service_type se deriva de event_type (columna real; service_type no existe)
      service_type: ev.event_type === 'coctel' || ev.event_type === 'coctel-cena' ? 'coctel' : 'menu',
    },
    timing: timingResult.rows.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      planned_time: t.planned_time,
      category: t.category,
      completed: t.completed,
      sort_order: t.sort_order,
    })),
    zones,
    shifts,
    dietary_overview: {
      total_guests: allGuests.length,
      confirmed,
      pending,
      rejected,
      by_menu_type: byMenuType,
      special_diets: Array.from(specialMapGlobal.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        guests: data.guests,
      })),
    },
    generated_at: new Date().toISOString(),
  };
}
