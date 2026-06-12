'use client';
/**
 * EventFlow — Agenda / Calendario
 * Multi‑vista: Month | Week | Day | Día D
 * Diseño premium J.Benitez con paleta gold / cream / ink.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import DiaDChecklist from './DiaDChecklist';

import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
  List,
  ClipboardCheck,
  Clock,
  MapPin,
  Phone,
  Mail,
  Users,
  Plus,
  X,
  Check,
  Trash2,
  MoreHorizontal,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────

interface EventLite {
  id: string;
  client_name: string;
  event_type: string;
  guest_count: number;
  event_date: string;
  status: string;
  client_email?: string;
  client_phone?: string;
}

interface Appt {
  id: string;
  title: string;
  kind: 'cita' | 'bloqueo' | 'nota';
  event_id: string | null;
  start_date: string;
  start_time: string | null;
  notes: string | null;
  client_name: string | null;
}

interface ChecklistItem {
  id: string;
  event_id: string;
  text: string;
  done: boolean;
  category: string;
}

type ViewMode = 'month' | 'week' | 'day' | 'diad';

// ─── Constants ───────────────────────────────────────────────────

const EVENT_TYPE: Record<string, string> = {
  boda: 'Boda',
  'cumpleaños': 'Cumpleaños',
  corporativo: 'Corporativo',
  bautizo: 'Bautizo',
  'comunión': 'Comunión',
  otro: 'Otro',
};

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_FULL = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const KIND_COLOR: Record<string, string> = {
  cita: '#3B82F6',
  bloqueo: '#DC2626',
  nota: '#9CA3AF',
};

const KIND_BG: Record<string, string> = {
  cita: 'bg-blue-50 border-blue-200',
  bloqueo: 'bg-red-50 border-red-200',
  nota: 'bg-gray-50 border-gray-200',
};

const KIND_TEXT: Record<string, string> = {
  cita: 'text-blue-700',
  bloqueo: 'text-red-700',
  nota: 'text-gray-600',
};

const TAB_LABELS: { key: ViewMode; label: string; icon: React.ReactNode }[] = [
  { key: 'month', label: 'Mes', icon: <CalendarDays className="w-3.5 h-3.5" /> },
  { key: 'week', label: 'Semana', icon: <CalendarRange className="w-3.5 h-3.5" /> },
  { key: 'day', label: 'Día', icon: <List className="w-3.5 h-3.5" /> },
  { key: 'diad', label: 'Día D', icon: <ClipboardCheck className="w-3.5 h-3.5" /> },
];

const HOURS = Array.from({ length: 16 }, (_, i) => i + 8); // 08 – 23

const CHECKLIST_CATEGORIES = [
  'Montaje',
  'Catering',
  'Decoración',
  'Música',
  'Protocolo',
  'Personal',
  'Otros',
];

// ─── Helpers ─────────────────────────────────────────────────────

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const parseTime = (t: string | null): number => {
  if (!t) return 8;
  const [h] = t.split(':').map(Number);
  return isNaN(h) ? 8 : h;
};

const fmtTime = (t: string | null): string => {
  if (!t) return '—';
  return t.slice(0, 5);
};

const fmtFull = (k: string) => {
  const [y, m, d] = k.split('-');
  return `${parseInt(d)} de ${MONTHS[parseInt(m) - 1]} de ${y}`;
};

const isSameDay = (a: string, b: string) => a === b;

const getWeekRange = (date: Date) => {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  const start = new Date(d);
  d.setDate(d.getDate() + 6);
  const end = new Date(d);
  return { start, end };
};

const formatWeekRange = (start: Date, end: Date) => {
  const s = `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)}`;
  const e = `${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)}`;
  return `${s} – ${e} ${end.getFullYear()}`;
};

const formatTimeSlot = (h: number) =>
  `${String(h).padStart(2, '0')}:00`;

const STORAGE_KEY = 'eventflow-checklist';

// ─── Main CalendarView ──────────────────────────────────────────

export default function CalendarView() {
  const today = new Date();
  const todayStr = iso(today);

  // ── State ──
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  // Anchor date for the current view
  const [anchorDate, setAnchorDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1)
  );
  const [events, setEvents] = useState<EventLite[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [defaultDate, setDefaultDate] = useState(todayStr);
  // Día D state
  const [diadEvent, setDiadEvent] = useState<EventLite | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [showAddCheck, setShowAddCheck] = useState(false);
  const [newCheckText, setNewCheckText] = useState('');
  const [newCheckCat, setNewCheckCat] = useState(CHECKLIST_CATEGORIES[0]);

  // ── Computed date ranges ──
  const monthStart = useMemo(
    () => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1),
    [anchorDate]
  );
  const monthEnd = useMemo(
    () => new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0),
    [anchorDate]
  );

  const weekRange = useMemo(() => getWeekRange(anchorDate), [anchorDate]);

  // ── Data fetching ──
  const getFetchRange = useCallback(() => {
    switch (viewMode) {
      case 'month':
        return {
          from: iso(new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1)),
          to: iso(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 2, 0)),
        };
      case 'week': {
        const s = new Date(weekRange.start);
        s.setDate(s.getDate() - 7);
        const e = new Date(weekRange.end);
        e.setDate(e.getDate() + 7);
        return { from: iso(s), to: iso(e) };
      }
      case 'day': {
        const d = iso(anchorDate);
        return { from: d, to: d };
      }
      case 'diad':
        return {
          from: iso(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)),
          to: iso(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0)),
        };
    }
  }, [viewMode, anchorDate, weekRange]);

  const load = useCallback(async () => {
    const { from, to } = getFetchRange();
    try {
      const [eRes, aRes] = await Promise.all([
        fetch('/api/events?limit=200').then((r) => r.json()),
        fetch(`/api/appointments?from=${from}&to=${to}`).then((r) => r.json()),
      ]);
      if (eRes.success) setEvents(eRes.data);
      if (aRes.success) setAppts(aRes.data);
    } catch {
      /* empty */
    }
  }, [getFetchRange]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Día D checklist from localStorage ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setChecklist(JSON.parse(stored));
    } catch {
      /* empty */
    }
  }, []);

  const persistChecklist = useCallback((items: ChecklistItem[]) => {
    setChecklist(items);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* empty */
    }
  }, []);

  // ── Computed data ──
  const byDay = useMemo(() => {
    const map: Record<string, { events: EventLite[]; appts: Appt[] }> = {};
    const push = (k: string) => (map[k] ??= { events: [], appts: [] });
    events.forEach((e) => {
      if (e.status !== 'cancelado') push(e.event_date.slice(0, 10)).events.push(e);
    });
    appts.forEach((a) => push(a.start_date.slice(0, 10)).appts.push(a));
    return map;
  }, [events, appts]);

  const apptsByDayTime = useMemo(() => {
    const map: Record<string, Appt[]> = {};
    appts.forEach((a) => {
      const k = a.start_date.slice(0, 10);
      if (!map[k]) map[k] = [];
      map[k].push(a);
    });
    // Sort each day's appts by time
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => {
        const ha = parseTime(a.start_time);
        const hb = parseTime(b.start_time);
        return ha - hb;
      })
    );
    return map;
  }, [appts]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventLite[]> = {};
    events.forEach((e) => {
      if (e.status !== 'cancelado') {
        const k = e.event_date.slice(0, 10);
        if (!map[k]) map[k] = [];
        map[k].push(e);
      }
    });
    return map;
  }, [events]);

  // Upcoming events for Día D picker
  const upcomingEvents = useMemo(
    () =>
      events
        .filter((e) => e.status !== 'cancelado' && e.event_date >= todayStr)
        .sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events, todayStr]
  );

  const selItems = selDay ? (byDay[selDay] || { events: [], appts: [] }) : null;

  // ── Navigation ──
  const goPrev = () => {
    switch (viewMode) {
      case 'month':
        setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() - 1, 1));
        break;
      case 'week': {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() - 7);
        setAnchorDate(d);
        break;
      }
      case 'day': {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() - 1);
        setAnchorDate(d);
        break;
      }
      case 'diad':
        // nop
        break;
    }
    setSelDay(null);
  };

  const goNext = () => {
    switch (viewMode) {
      case 'month':
        setAnchorDate(new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1));
        break;
      case 'week': {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() + 7);
        setAnchorDate(d);
        break;
      }
      case 'day': {
        const d = new Date(anchorDate);
        d.setDate(d.getDate() + 1);
        setAnchorDate(d);
        break;
      }
      case 'diad':
        // nop
        break;
    }
    setSelDay(null);
  };

  const goToday = () => {
    const d = new Date();
    setAnchorDate(d);
    setSelDay(todayStr);
    setViewMode('day');
  };

  const switchView = (mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'diad' && !diadEvent && upcomingEvents.length > 0) {
      const ev = upcomingEvents[0];
      setDiadEvent(ev);
    }
  };

  // ── Día D handlers ──
  const addCheckItem = () => {
    if (!newCheckText.trim() || !diadEvent) return;
    const item: ChecklistItem = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      event_id: diadEvent.id,
      text: newCheckText.trim(),
      done: false,
      category: newCheckCat,
    };
    persistChecklist([...checklist, item]);
    setNewCheckText('');
    setShowAddCheck(false);
  };

  const toggleCheckItem = (id: string) => {
    persistChecklist(
      checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c))
    );
  };

  const deleteCheckItem = (id: string) => {
    persistChecklist(checklist.filter((c) => c.id !== id));
  };

  const filteredChecklist = useMemo(
    () =>
      diadEvent
        ? checklist.filter((c) => c.event_id === diadEvent.id)
        : [],
    [checklist, diadEvent]
  );

  // ── Render ──

  const viewTitle = () => {
    switch (viewMode) {
      case 'month':
        return `${MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
      case 'week':
        return formatWeekRange(weekRange.start, weekRange.end);
      case 'day':
        return fmtFull(iso(anchorDate));
      case 'diad':
        return 'Día D — Checklist del evento';
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2
            className="text-2xl font-heading text-ink"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Agenda
          </h2>
          <p className="text-ink-soft text-sm">
            Eventos, citas comerciales y bloqueos del salón.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button
            onClick={goToday}
            className="text-[13px] px-3 py-2 rounded-xl bg-white border border-[#ECECF1] text-ink-soft hover:border-[#D1D5DB] transition-colors"
          >
            Hoy
          </button>
          <button
            onClick={() => {
              setDefaultDate(selDay || todayStr);
              setShowAdd(true);
            }}
            className="text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm transition-all hover:shadow-md active:scale-[0.97]"
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #A88A3A)',
            }}
          >
            <Plus className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
            Cita / bloqueo
          </button>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex items-center gap-1 bg-[#F5F5F8] rounded-xl p-1 w-fit">
        {TAB_LABELS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchView(tab.key)}
            className={`flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-lg transition-all ${
              viewMode === tab.key
                ? 'bg-white text-ink shadow-sm border border-[#ECECF1]'
                : 'text-ink-soft hover:text-ink hover:bg-white/50'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── View Navigation ── */}
      {viewMode !== 'diad' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={goPrev}
              className="p-1.5 rounded-lg text-ink-soft hover:bg-[#F0F0F4] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-semibold text-ink min-w-[180px] text-center text-sm">
              {viewTitle()}
            </h3>
            <button
              onClick={goNext}
              className="p-1.5 rounded-lg text-ink-soft hover:bg-[#F0F0F4] transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── View Content ── */}
      {viewMode === 'month' && (
        <MonthView
          anchorDate={anchorDate}
          todayStr={todayStr}
          monthStart={monthStart}
          byDay={byDay}
          selDay={selDay}
          onSelectDay={(k) => setSelDay(k === selDay ? null : k)}
          onDayDoubleClick={(k) => {
            setSelDay(k);
            setDefaultDate(k);
            setShowAdd(true);
          }}
        />
      )}

      {viewMode === 'week' && (
        <WeekView
          weekStart={weekRange.start}
          weekEnd={weekRange.end}
          todayStr={todayStr}
          apptsByDayTime={apptsByDayTime}
          eventsByDate={eventsByDate}
          onSelectDay={(k) => {
            setSelDay(k);
            setViewMode('day');
          }}
        />
      )}

      {viewMode === 'day' && (
        <DayView
          date={anchorDate}
          todayStr={todayStr}
          appts={apptsByDayTime[iso(anchorDate)] || []}
          events={eventsByDate[iso(anchorDate)] || []}
          onAdd={() => {
            setDefaultDate(iso(anchorDate));
            setShowAdd(true);
          }}
        />
      )}

      {viewMode === 'diad' && (
        <DiaDChecklist events={upcomingEvents} />
      )}

      {/* ── Detail sidebar for month view ── */}
      {viewMode === 'month' && (
        <DayDetailModal
          selDay={selDay}
          selItems={selItems}
          onClose={() => setSelDay(null)}
          onAdd={() => {
            if (selDay) {
              setDefaultDate(selDay);
              setShowAdd(true);
            }
          }}
          onDelete={async (id: string) => {
            await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
            load();
          }}
        />
      )}

      {/* ── ApptForm Modal ── */}
      {showAdd && (
        <ApptForm
          events={events}
          defaultDate={defaultDate}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {/* ── Día D Add Checklist Item Modal ── */}
      {showAddCheck && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddCheck(false)}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="font-heading text-xl text-ink"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              Añadir tarea
            </h3>
            <label className="block">
              <span className="block text-[12px] font-medium text-ink-soft mb-1">
                Tarea
              </span>
              <input
                value={newCheckText}
                onChange={(e) => setNewCheckText(e.target.value)}
                className="crm-inp"
                autoFocus
                placeholder="Ej: Revisar sonido…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addCheckItem();
                }}
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-ink-soft mb-1">
                Categoría
              </span>
              <select
                value={newCheckCat}
                onChange={(e) => setNewCheckCat(e.target.value)}
                className="crm-inp"
              >
                {CHECKLIST_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowAddCheck(false)}
                className="text-sm px-4 py-2.5 rounded-xl text-ink-soft hover:bg-[#F5F5F8]"
              >
                Cancelar
              </button>
              <button
                onClick={addCheckItem}
                disabled={!newCheckText.trim()}
                className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-60 transition-all"
                style={{
                  background: 'linear-gradient(135deg, #C9A84C, #A88A3A)',
                }}
              >
                Añadir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  MONTH VIEW
// ═══════════════════════════════════════════════════════════════════

function MonthView({
  anchorDate,
  todayStr,
  monthStart,
  byDay,
  selDay,
  onSelectDay,
  onDayDoubleClick,
}: {
  anchorDate: Date;
  todayStr: string;
  monthStart: Date;
  byDay: Record<string, { events: EventLite[]; appts: Appt[] }>;
  selDay: string | null;
  onSelectDay: (k: string) => void;
  onDayDoubleClick: (k: string) => void;
}) {
  const cells = useMemo(() => {
    const firstWd = (monthStart.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(monthStart);
    start.setDate(monthStart.getDate() - firstWd);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [monthStart]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden"
    >
      {/* Day headers */}
      <div className="overflow-x-auto"><div className="grid grid-cols-7 min-w-[540px] border-b border-[#F0F0F4]">
        {DAYS_SHORT.map((d) => (
          <div
            key={d}
            className="py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-soft/60"
          >
            {d}
          </div>
        ))}
      </div></div>

      {/* Grid */}
      <div className="overflow-x-auto"><div className="grid grid-cols-7 min-w-[540px]">
        {cells.map((d, i) => {
          const k = iso(d);
          const inMonth = d.getMonth() === anchorDate.getMonth();
          const isToday = k === todayStr;
          const cell = byDay[k];
          const items = cell
            ? [
                ...cell.events.map((e) => ({
                  color: '#C9A84C',
                  label: e.client_name,
                  type: 'event' as const,
                })),
                ...cell.appts.map((a) => ({
                  color: KIND_COLOR[a.kind],
                  label: a.title,
                  type: 'appt' as const,
                })),
              ]
            : [];
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;

          return (
            <button
              key={i}
              onClick={() => onSelectDay(k)}
              onDoubleClick={() => onDayDoubleClick(k)}
              className={`min-h-[82px] border-b border-r border-[#F2F2F5] p-1.5 text-left align-top transition-all hover:bg-[#FAFAFC] ${
                inMonth ? '' : 'bg-[#FCFCFD]'
              } ${selDay === k ? 'ring-2 ring-inset ring-gold' : ''} ${
                isWeekend && inMonth ? 'bg-[#FBF8F1]/30' : ''
              }`}
            >
              <div
                className={`text-[12px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full transition-colors ${
                  isToday
                    ? 'bg-gold text-white shadow-sm'
                    : inMonth
                    ? 'text-ink'
                    : 'text-[#C7C7CF]'
                }`}
              >
                {d.getDate()}
              </div>
              <div className="space-y-[3px]">
                {items.slice(0, 3).map((it, j) => (
                  <div
                    key={j}
                    className={`flex items-center gap-1 text-[10px] truncate rounded ${
                      it.type === 'appt'
                        ? 'px-1 py-[1px]'
                        : ''
                    }`}
                    style={
                      it.type === 'appt'
                        ? {
                            background: `${it.color}15`,
                            color: it.color,
                          }
                        : { color: '#4B5563' }
                    }
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: it.color }}
                    />
                    <span className="truncate">{it.label}</span>
                  </div>
                ))}
                {items.length > 3 && (
                  <div className="text-[10px] text-ink-soft/60 pl-1 font-medium">
                    +{items.length - 3} más
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div></div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-5 py-3 border-t border-[#F0F0F4] text-[11px] text-ink-soft">
        <LegendDot color="#C9A84C" label="Evento" />
        <LegendDot color="#3B82F6" label="Cita" />
        <LegendDot color="#DC2626" label="Bloqueo" />
        <LegendDot color="#9CA3AF" label="Nota" />
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  WEEK VIEW
// ═══════════════════════════════════════════════════════════════════

function WeekView({
  weekStart,
  weekEnd,
  todayStr,
  apptsByDayTime,
  eventsByDate,
  onSelectDay,
}: {
  weekStart: Date;
  weekEnd: Date;
  todayStr: string;
  apptsByDayTime: Record<string, Appt[]>;
  eventsByDate: Record<string, EventLite[]>;
  onSelectDay: (k: string) => void;
}) {
  const days = useMemo(() => {
    const arr: Date[] = [];
    const d = new Date(weekStart);
    while (d <= weekEnd) {
      arr.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return arr;
  }, [weekStart, weekEnd]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden"
    >
      {/* Column headers (days) */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[#F0F0F4]">
        <div className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-ink-soft/60">
          Hora
        </div>
        {days.map((d) => {
          const k = iso(d);
          const isToday = k === todayStr;
          return (
            <button
              key={k}
              onClick={() => onSelectDay(k)}
              className={`py-2 text-center transition-colors hover:bg-[#FAFAFC] ${
                isToday ? 'bg-gold/5' : ''
              }`}
            >
              <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft/60">
                {d.toLocaleDateString('es', { weekday: 'short' })}
              </div>
              <div
                className={`text-sm font-bold mt-0.5 ${
                  isToday ? 'text-gold' : 'text-ink'
                }`}
              >
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="overflow-y-auto max-h-[580px] scrollbar-hide">
        <div
          className="grid grid-cols-[60px_repeat(7,1fr)]"
          style={{ minHeight: `${HOURS.length * 56}px` }}
        >
          {/* Hour labels */}
          <div className="col-start-1">
            {HOURS.map((h) => (
              <div
                key={h}
                className="h-[56px] flex items-start justify-end pr-2 pt-0 text-[11px] font-medium text-ink-soft/50 border-b border-[#F0F0F4]"
              >
                {formatTimeSlot(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => {
            const k = iso(d);
            const dayAppts = apptsByDayTime[k] || [];
            const dayEvents = eventsByDate[k] || [];

            return (
              <div
                key={k}
                className="relative border-r border-[#F0F0F4]"
                style={{ minHeight: `${HOURS.length * 56}px` }}
                onClick={() => onSelectDay(k)}
              >
                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="h-[56px] border-b border-[#F5F5F8]"
                  />
                ))}

                {/* All‑day events banner */}
                {dayEvents.length > 0 && (
                  <div className="absolute top-0 left-0 right-0 z-10 px-1 space-y-[2px]">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="text-[10px] font-medium text-white px-1.5 py-[2px] rounded truncate shadow-sm"
                        style={{
                          background:
                            'linear-gradient(135deg, #C9A84C, #A88A3A)',
                        }}
                      >
                        {ev.client_name}
                      </div>
                    ))}
                  </div>
                )}

                {/* Time‑positioned appointments */}
                {dayAppts.map((a) => {
                  const hour = parseTime(a.start_time);
                  const topOffset = (hour - 8) * 56;
                  const baseColor = KIND_COLOR[a.kind];
                  return (
                    <div
                      key={a.id}
                      className="absolute left-0.5 right-0.5 z-20 rounded px-1.5 py-1 text-[10px] leading-tight border cursor-pointer transition-shadow hover:shadow-md"
                      style={{
                        top: `${topOffset + 2}px`,
                        minHeight: '22px',
                        background: `${baseColor}12`,
                        borderColor: `${baseColor}40`,
                        color: baseColor,
                      }}
                    >
                      <span className="font-semibold">{a.title}</span>
                      {a.start_time && (
                        <span className="opacity-70 ml-1">
                          {a.start_time}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  DAY VIEW
// ═══════════════════════════════════════════════════════════════════

function DayView({
  date,
  todayStr,
  appts,
  events,
  onAdd,
}: {
  date: Date;
  todayStr: string;
  appts: Appt[];
  events: EventLite[];
  onAdd: () => void;
}) {
  const dateStr = iso(date);
  const isToday = dateStr === todayStr;

  // Sort appts by time
  const sortedAppts = useMemo(
    () => [...appts].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time)),
    [appts]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-5"
    >
      {/* Hourly schedule */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F4]">
          <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
            {DAYS_FULL[date.getDay()]}, {date.getDate()} de{' '}
            {MONTHS[date.getMonth()]}
            {isToday && (
              <span className="text-[10px] font-medium text-white bg-gold px-2 py-0.5 rounded-full">
                Hoy
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {events.map((ev) => (
              <span
                key={ev.id}
                className="text-[11px] font-medium text-gold-dark bg-gold/10 px-2.5 py-1 rounded-lg"
              >
                {ev.client_name} — {EVENT_TYPE[ev.event_type] || ev.event_type}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[580px] scrollbar-hide">
          {HOURS.map((h) => {
            const slotAppts = sortedAppts.filter(
              (a) => parseTime(a.start_time) === h
            );
            return (
              <div
                key={h}
                className="flex border-b border-[#F2F2F5] min-h-[56px] group"
              >
                <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-1.5 text-[11px] font-medium text-ink-soft/50">
                  {formatTimeSlot(h)}
                </div>
                <div className="flex-1 px-2 py-1 space-y-1">
                  {slotAppts.length === 0 && (
                    <div className="h-full min-h-[40px]" />
                  )}
                  {slotAppts.map((a) => (
                    <div
                      key={a.id}
                      className={`flex items-start gap-2 px-3 py-2 rounded-xl border ${KIND_BG[a.kind]}`}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                        style={{ background: KIND_COLOR[a.kind] }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-ink truncate">
                          {a.title}
                        </div>
                        <div className="text-[11px] text-ink-soft/70 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {fmtTime(a.start_time)}
                          {a.kind !== 'cita' && (
                            <span className="capitalize ml-1">
                              · {a.kind}
                            </span>
                          )}
                          {a.notes && <span> · {a.notes}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#F0F0F4] px-5 py-3">
          <button
            onClick={onAdd}
            className="w-full text-[13px] font-medium text-gold-dark border border-dashed border-gold/40 rounded-xl py-2.5 hover:bg-gold/5 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir cita / bloqueo
          </button>
        </div>
      </div>

      {/* Day summary */}
      <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 space-y-4">
        <h3 className="font-semibold text-ink text-sm flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-gold" />
          Resumen del día
        </h3>

        {events.length === 0 && sortedAppts.length === 0 && (
          <p className="text-sm text-ink-soft/60">Día sin eventos ni citas.</p>
        )}

        {events.map((ev) => (
          <div
            key={ev.id}
            className="border border-gold/20 rounded-xl px-3.5 py-3 bg-gold/[0.03]"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gold" />
              <span className="text-[13px] font-semibold text-ink">
                {ev.client_name}
              </span>
            </div>
            <div className="space-y-1 text-[12px] text-ink-soft/70 pl-[18px]">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3" />
                {EVENT_TYPE[ev.event_type] || ev.event_type}
                <span className="mx-1">·</span>
                <Users className="w-3 h-3" />
                {ev.guest_count} pax
              </div>
              {ev.client_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  {ev.client_phone}
                </div>
              )}
              {ev.client_email && (
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  {ev.client_email}
                </div>
              )}
            </div>
          </div>
        ))}

        {sortedAppts
          .filter((a) => a.kind === 'cita')
          .map((a) => (
            <div
              key={a.id}
              className="border border-[#ECECF1] rounded-xl px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ background: KIND_COLOR[a.kind] }}
                />
                <span className="text-[13px] font-semibold text-ink">
                  {a.title}
                </span>
              </div>
              <div className="text-[12px] text-ink-soft/70 pl-4 mt-0.5">
                {a.start_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 inline" /> {a.start_time} ·
                  </span>
                )}{' '}
                {a.notes}
              </div>
            </div>
          ))}

        {sortedAppts.filter((a) => a.kind === 'bloqueo').length > 0 && (
          <div className="pt-2 border-t border-[#F0F0F4]">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-red-500 mb-2">
              Bloqueos
            </h4>
            {sortedAppts
              .filter((a) => a.kind === 'bloqueo')
              .map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[12px] text-red-600 py-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                  {a.title}
                  {a.start_time && <span>· {a.start_time}</span>}
                </div>
              ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  DÍA D VIEW
// ═══════════════════════════════════════════════════════════════════

function DiaDView({
  events,
  selectedEvent,
  onSelectEvent,
  checklistItems,
  onToggle,
  onDelete,
  onAdd,
}: {
  events: EventLite[];
  selectedEvent: EventLite | null;
  onSelectEvent: (e: EventLite) => void;
  checklistItems: ChecklistItem[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  const categories = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    CHECKLIST_CATEGORIES.forEach((c) => (map[c] = []));
    checklistItems.forEach((item) => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item);
    });
    return map;
  }, [checklistItems]);

  const doneCount = checklistItems.filter((c) => c.done).length;
  const totalCount = checklistItems.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  if (events.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-10 text-center"
      >
        <ClipboardCheck className="w-12 h-12 mx-auto text-ink-soft/30 mb-3" />
        <p className="text-sm text-ink-soft/60">
          No hay eventos confirmados próximos.
        </p>
        <p className="text-xs text-ink-soft/40 mt-1">
          Los eventos aparecerán aquí cuando estén programados.
        </p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-5"
    >
      {/* Main checklist area */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        {/* Event selector */}
        <div className="px-5 py-4 border-b border-[#F0F0F4]">
          <label className="block">
            <span className="text-[12px] font-medium text-ink-soft mb-1.5 block">
              Seleccionar evento
            </span>
            <select
              value={selectedEvent?.id || ''}
              onChange={(e) => {
                const ev = events.find((ev) => ev.id === e.target.value);
                if (ev) onSelectEvent(ev);
              }}
              className="crm-inp w-full"
            >
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.client_name} — {fmtFull(ev.event_date)} —{' '}
                  {EVENT_TYPE[ev.event_type] || ev.event_type}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Progress bar */}
        {selectedEvent && (
          <div className="px-5 py-3 border-b border-[#F0F0F4] bg-[#FAFAFC]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-ink">
                Progreso del montaje
              </span>
              <span className="text-[12px] font-semibold text-gold">
                {doneCount}/{totalCount}
              </span>
            </div>
            <div className="w-full h-2 bg-[#E5E5EA] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #C9A84C, #D4B85C)',
                }}
              />
            </div>
            <span className="text-[11px] text-ink-soft/60 mt-1 block">
              {progress}% completado
            </span>
          </div>
        )}

        {/* Checklist items by category */}
        {selectedEvent && (
          <div className="p-5 space-y-6 max-h-[480px] overflow-y-auto scrollbar-hide">
            {CHECKLIST_CATEGORIES.map((cat) => {
              const items = categories[cat] || [];
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft/50 mb-2">
                    {cat}
                  </h4>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
                          item.done
                            ? 'bg-green-50 border-green-200 opacity-70'
                            : 'bg-white border-[#ECECF1] hover:border-[#D1D5DB]'
                        }`}
                      >
                        <button
                          onClick={() => onToggle(item.id)}
                          className={`flex items-center gap-2.5 min-w-0 flex-1 text-left ${
                            item.done ? 'line-through text-ink-soft/50' : 'text-ink'
                          }`}
                        >
                          <span
                            className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                              item.done
                                ? 'bg-green-500 border-green-500'
                                : 'border-[#D1D5DB]'
                            }`}
                          >
                            {item.done && <Check className="w-3 h-3 text-white" />}
                          </span>
                          <span className="text-[13px]">{item.text}</span>
                        </button>
                        <button
                          onClick={() => onDelete(item.id)}
                          className="text-ink-soft/30 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {checklistItems.length === 0 && (
              <div className="text-center py-8">
                <ClipboardCheck className="w-10 h-10 mx-auto text-ink-soft/20 mb-2" />
                <p className="text-sm text-ink-soft/60">
                  No hay tareas para este evento.
                </p>
                <p className="text-xs text-ink-soft/40 mt-1">
                  Añade la primera tarea con el botón de abajo.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Add button */}
        {selectedEvent && (
          <div className="border-t border-[#F0F0F4] px-5 py-3">
            <button
              onClick={onAdd}
              className="w-full text-[13px] font-medium text-gold-dark border border-dashed border-gold/40 rounded-xl py-2.5 hover:bg-gold/5 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir tarea
            </button>
          </div>
        )}
      </div>

      {/* Event info sidebar */}
      {selectedEvent && (
        <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5 space-y-4 h-fit">
          <h3
            className="font-heading text-lg text-ink"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {selectedEvent.client_name}
          </h3>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CalendarDays className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {fmtFull(selectedEvent.event_date)}
                </p>
                <p className="text-[12px] text-ink-soft/60">Fecha del evento</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {EVENT_TYPE[selectedEvent.event_type] || selectedEvent.event_type}
                </p>
                <p className="text-[12px] text-ink-soft/60">Tipo de evento</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {selectedEvent.guest_count} invitados
                </p>
                <p className="text-[12px] text-ink-soft/60">Asistentes</p>
              </div>
            </div>

            {selectedEvent.client_phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-ink">
                    {selectedEvent.client_phone}
                  </p>
                  <p className="text-[12px] text-ink-soft/60">Teléfono</p>
                </div>
              </div>
            )}

            {selectedEvent.client_email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-ink break-all">
                    {selectedEvent.client_email}
                  </p>
                  <p className="text-[12px] text-ink-soft/60">Email</p>
                </div>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="border-t border-[#F0F0F4] pt-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-600">{doneCount}</p>
                <p className="text-[10px] text-green-600/70 font-medium">
                  Completadas
                </p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-amber-600">
                  {totalCount - doneCount}
                </p>
                <p className="text-[10px] text-amber-600/70 font-medium">
                  Pendientes
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  DAY DETAIL MODAL (used by Month view)
// ═══════════════════════════════════════════════════════════════════

function DayDetailModal({
  selDay,
  selItems,
  onClose,
  onAdd,
  onDelete,
}: {
  selDay: string | null;
  selItems: { events: EventLite[]; appts: Appt[] } | null;
  onClose: () => void;
  onAdd: () => void;
  onDelete: (id: string) => Promise<void>;
}) {
  if (!selDay) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-[#ECECF1] p-5 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-ink text-sm">
            {fmtFull(selDay)}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-soft hover:bg-[#F5F5F8]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2">
          {selItems!.events.length === 0 &&
            selItems!.appts.length === 0 && (
              <p className="text-sm text-ink-soft/60">Día libre.</p>
            )}

          {selItems!.events.map((e) => (
            <div
              key={e.id}
              className="border border-[#ECECF1] rounded-xl px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-gold" />
                <span className="text-[13px] font-semibold text-ink">
                  {e.client_name}
                </span>
              </div>
              <div className="text-[12px] text-ink-soft/60 pl-4">
                {EVENT_TYPE[e.event_type] || e.event_type} · {e.guest_count}{' '}
                pax
              </div>
            </div>
          ))}

          {selItems!.appts.map((a) => (
            <div
              key={a.id}
              className="border border-[#ECECF1] rounded-xl px-3.5 py-2.5 group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: KIND_COLOR[a.kind] }}
                  />
                  <span className="text-[13px] font-semibold text-ink truncate">
                    {a.title}
                  </span>
                </div>
                <button
                  onClick={async () => {
                    await onDelete(a.id);
                  }}
                  className="text-ink-soft/30 hover:text-red-500 text-xs opacity-0 group-hover:opacity-100 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[12px] text-ink-soft/60 pl-4">
                {a.start_time ? `${a.start_time} · ` : ''}
                {a.kind}
                {a.notes ? ` · ${a.notes}` : ''}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onAdd}
          className="mt-4 w-full text-[13px] font-medium text-gold-dark border border-dashed border-gold/40 rounded-xl py-2.5 hover:bg-gold/5 transition-colors"
        >
          + Añadir a este día
        </button>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  APPT FORM (preserved from original)
// ═══════════════════════════════════════════════════════════════════

function ApptForm({
  events,
  defaultDate,
  onClose,
  onSaved,
}: {
  events: EventLite[];
  defaultDate: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    title: '',
    kind: 'cita',
    start_date: defaultDate,
    start_time: '',
    event_id: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  const save = async () => {
    if (!f.title.trim()) {
      setErr('El título es obligatorio');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (!data.success) {
        setErr(data.error || 'Error');
        return;
      }
      onSaved();
    } catch {
      setErr('Error de red');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="font-heading text-xl text-ink"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Nueva entrada de agenda
        </h3>

        <div className="flex gap-2">
          {(['cita', 'bloqueo', 'nota'] as const).map((kd) => (
            <button
              key={kd}
              onClick={() => set('kind', kd)}
              className={`flex-1 text-[13px] py-2 rounded-xl border capitalize transition-all ${
                f.kind === kd
                  ? 'text-white border-transparent'
                  : 'bg-white text-ink-soft border-[#ECECF1]'
              }`}
              style={f.kind === kd ? { background: KIND_COLOR[kd] } : {}}
            >
              {kd}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="block text-[12px] font-medium text-ink-soft mb-1">
            Título *
          </span>
          <input
            value={f.title}
            onChange={(e) => set('title', e.target.value)}
            className="crm-inp"
            autoFocus
            placeholder={
              f.kind === 'bloqueo'
                ? 'Motivo del bloqueo'
                : 'Visita / prueba de menú…'
            }
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[12px] font-medium text-ink-soft mb-1">
              Fecha
            </span>
            <input
              type="date"
              value={f.start_date}
              onChange={(e) => set('start_date', e.target.value)}
              className="crm-inp"
            />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-ink-soft mb-1">
              Hora
            </span>
            <input
              type="time"
              value={f.start_time}
              onChange={(e) => set('start_time', e.target.value)}
              className="crm-inp"
            />
          </label>
        </div>

        <label className="block">
          <span className="block text-[12px] font-medium text-ink-soft mb-1">
            Evento vinculado (opcional)
          </span>
          <select
            value={f.event_id}
            onChange={(e) => set('event_id', e.target.value)}
            className="crm-inp"
          >
            <option value="">— Ninguno —</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.client_name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-[12px] font-medium text-ink-soft mb-1">
            Notas
          </span>
          <textarea
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={2}
            className="crm-inp resize-none"
          />
        </label>

        {err && <p className="text-sm text-red-600">{err}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2.5 rounded-xl text-ink-soft hover:bg-[#F5F5F8]"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-60 transition-all"
            style={{
              background: 'linear-gradient(135deg, #C9A84C, #A88A3A)',
            }}
          >
            {saving ? 'Guardando…' : 'Añadir'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}