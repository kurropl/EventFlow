/**
 * EventFlow — DiaDChecklist: DB-backed checklist per event
 * Replaces the old localStorage-based DiaDView
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Check,
  Plus,
  Trash2,
  Clock,
  CalendarDays,
  MapPin,
  Users,
  Phone,
  Mail,
  RotateCcw,
  Loader2,
} from 'lucide-react';

/* ── Types ────────────────────────────────────────────────────── */

interface EventLite {
  id: string;
  client_name: string;
  event_date: string;
  event_type: string;
  guest_count: number;
  client_phone?: string;
  client_email?: string;
  status: string;
}

interface Task {
  id: string;
  event_id: string;
  template_id: string | null;
  title: string;
  description: string | null;
  hours_before: number | null;
  sort_order: number;
  completed: boolean;
  completed_at: string | null;
  custom: boolean;
}

/* ── Helpers ──────────────────────────────────────────────────── */

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const fmtFull = (k: string) => {
  const [y, m, d] = k.split('-');
  return `${parseInt(d)} de ${MONTHS[parseInt(m) - 1]} de ${y}`;
};

const EVENT_TYPE: Record<string, string> = {
  boda: 'Boda',
  'cumpleaños': 'Cumpleaños',
  corporativo: 'Corporativo',
  bautizo: 'Bautizo',
  'comunión': 'Comunión',
  otro: 'Otro',
};

const TIME_PERIODS = [
  { key: '3d', label: '3 dias antes', max: 73, min: 49 },
  { key: '2d', label: '2 dias antes', max: 49, min: 25 },
  { key: '1d', label: '1 dia antes', max: 25, min: 5 },
  { key: '4h', label: '4 horas antes', max: 5, min: 3 },
  { key: '2h', label: '2 horas antes', max: 3, min: 1.5 },
  { key: '1h', label: '1 hora antes', max: 1.5, min: 0 },
  { key: 'during', label: 'Durante el evento', max: 0, min: null },
  { key: 'post', label: 'Despues del evento', max: null, min: null },
];

function groupTasks(tasks: Task[]): { label: string; items: Task[] }[] {
  const groups: Record<string, Task[]> = {};

  // Init groups
  TIME_PERIODS.forEach((p) => (groups[p.key] = []));
  groups['during'] = groups['during'] || [];
  groups['post'] = groups['post'] || [];

  tasks.forEach((t) => {
    if (t.hours_before === null) {
      // Post-event tasks go to 'post', but if they have sort_order > a certain threshold, 'during'
      // Simple heuristic: tasks without hours_before and custom=false from templates are 'during' or 'post'
      // For now, place them in 'during' if they're at the end, else 'post'
      groups['during'].push(t);
    } else if (t.hours_before > 48) {
      groups['3d'].push(t);
    } else if (t.hours_before > 24) {
      groups['2d'].push(t);
    } else if (t.hours_before > 4) {
      groups['1d'].push(t);
    } else if (t.hours_before > 2) {
      groups['4h'].push(t);
    } else if (t.hours_before > 1) {
      groups['2h'].push(t);
    } else {
      groups['1h'].push(t);
    }
  });

  return TIME_PERIODS
    .map((p) => ({ label: p.label, items: groups[p.key] || [] }))
    .filter((g) => g.items.length > 0);
}

/* ── Component ────────────────────────────────────────────────── */

export default function DiaDChecklist({ events }: { events: EventLite[] }) {
  const [selectedEvent, setSelectedEvent] = useState<EventLite | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const doneCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const groups = useMemo(() => groupTasks(tasks), [tasks]);

  /* ── Fetch tasks when event selected ── */
  const loadTasks = useCallback(async (eventId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/checklist?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) setTasks(data.data);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadTasks(selectedEvent.id);
    } else {
      setTasks([]);
    }
  }, [selectedEvent, loadTasks]);

  /* ── Initialize checklist from templates ── */
  const initChecklist = useCallback(async () => {
    if (!selectedEvent) return;
    setInitializing(true);
    try {
      await fetch('/api/checklist/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: selectedEvent.id, event_type: selectedEvent.event_type }),
      });
      await loadTasks(selectedEvent.id);
    } catch {}
    setInitializing(false);
  }, [selectedEvent, loadTasks]);

  /* ── Toggle task ── */
  const toggleTask = useCallback(async (task: Task) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? { ...t, completed: !t.completed, completed_at: !t.completed ? new Date().toISOString() : null }
          : t
      )
    );
    try {
      await fetch('/api/checklist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: task.id, completed: !task.completed }),
      });
    } catch {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? { ...t, completed: task.completed, completed_at: task.completed_at }
            : t
        )
      );
    }
  }, []);

  /* ── Add custom task ── */
  const addTask = useCallback(async () => {
    if (!newTitle.trim() || !selectedEvent) return;
    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: selectedEvent.id,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTasks((prev) => [...prev, data.data]);
        setNewTitle('');
        setNewDesc('');
        setShowAdd(false);
      }
    } catch {}
  }, [newTitle, newDesc, selectedEvent]);

  /* ── Empty state ── */
  if (events.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-10 text-center"
      >
        <ClipboardCheck className="w-12 h-12 mx-auto text-ink-soft/30 mb-3" />
        <p className="text-sm text-ink-soft/60">No hay eventos proximos.</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-5"
    >
      {/* Main checklist */}
      <div className="lg:col-span-2 bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        {/* Event selector */}
        <div className="px-5 py-4 border-b border-[#F0F0F4]">
          <label className="block">
            <span className="text-[12px] font-medium text-ink-soft mb-1.5 block">Seleccionar evento</span>
            <select
              value={selectedEvent?.id || ''}
              onChange={(e) => {
                const ev = events.find((ev) => ev.id === e.target.value);
                if (ev) setSelectedEvent(ev);
              }}
              className="crm-inp w-full"
            >
              <option value="">-- Selecciona --</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.client_name} — {fmtFull(ev.event_date)} — {EVENT_TYPE[ev.event_type] || ev.event_type}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Progress bar */}
        {selectedEvent && (
          <div className="px-5 py-3 border-b border-[#F0F0F4] bg-[#FAFAFC]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] font-medium text-ink">Progreso del montaje</span>
              <span className="text-[12px] font-semibold text-gold">{doneCount}/{totalCount}</span>
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
            <span className="text-[11px] text-ink-soft/60 mt-1 block">{progress}% completado</span>
          </div>
        )}

        {/* Tasks */}
        {selectedEvent && (
          <div className="p-5 max-h-[480px] overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 mx-auto text-gold animate-spin mb-2" />
                <p className="text-sm text-ink-soft/60">Cargando tareas...</p>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardCheck className="w-10 h-10 mx-auto text-ink-soft/20 mb-2" />
                <p className="text-sm text-ink-soft/60 mb-3">No hay tareas para este evento.</p>
                <button
                  onClick={initChecklist}
                  disabled={initializing}
                  className="text-[13px] font-medium text-white bg-gold px-5 py-2.5 rounded-xl hover:bg-gold-dark transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {initializing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ClipboardCheck className="w-3.5 h-3.5" />
                  )}
                  Generar checklist
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <div key={group.label}>
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft/50 mb-2 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {group.label}
                    </h4>
                    <div className="space-y-1">
                      {group.items.map((task) => (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border transition-all ${
                            task.completed
                              ? 'bg-green-50 border-green-200 opacity-70'
                              : 'bg-white border-[#ECECF1] hover:border-[#D1D5DB]'
                          }`}
                        >
                          <button
                            onClick={() => toggleTask(task)}
                            className={`flex items-center gap-2.5 min-w-0 flex-1 text-left ${
                              task.completed ? 'line-through text-ink-soft/50' : 'text-ink'
                            }`}
                          >
                            <span
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                task.completed ? 'bg-green-500 border-green-500' : 'border-[#D1D5DB]'
                              }`}
                            >
                              {task.completed && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <div>
                              <span className="text-[13px]">{task.title}</span>
                              {task.description && (
                                <p className="text-[11px] text-ink-soft/50 mt-0.5">{task.description}</p>
                              )}
                            </div>
                          </button>
                          {task.custom && (
                            <span className="text-[9px] bg-gold/10 text-gold-dark px-1.5 py-0.5 rounded-full flex-shrink-0">
                              custom
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Add button + Regenerate */}
        {selectedEvent && tasks.length > 0 && (
          <div className="border-t border-[#F0F0F4] px-5 py-3 flex gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex-1 text-[13px] font-medium text-gold-dark border border-dashed border-gold/40 rounded-xl py-2.5 hover:bg-gold/5 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Anadir tarea
            </button>
            <button
              onClick={initChecklist}
              disabled={initializing}
              className="text-[13px] text-ink-soft/50 border border-[#ECECF1] rounded-xl px-3 py-2.5 hover:bg-[#FAFAFC] transition-colors disabled:opacity-50"
              title="Regenerar checklist desde plantillas"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${initializing ? 'animate-spin' : ''}`} />
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
                <p className="text-[13px] font-medium text-ink">{fmtFull(selectedEvent.event_date)}</p>
                <p className="text-[12px] text-ink-soft/60">Fecha del evento</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-ink">{EVENT_TYPE[selectedEvent.event_type] || selectedEvent.event_type}</p>
                <p className="text-[12px] text-ink-soft/60">Tipo de evento</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[13px] font-medium text-ink">{selectedEvent.guest_count} invitados</p>
                <p className="text-[12px] text-ink-soft/60">Asistentes</p>
              </div>
            </div>
            {selectedEvent.client_phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-ink">{selectedEvent.client_phone}</p>
                  <p className="text-[12px] text-ink-soft/60">Telefono</p>
                </div>
              </div>
            )}
            {selectedEvent.client_email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-gold mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[13px] font-medium text-ink break-all">{selectedEvent.client_email}</p>
                  <p className="text-[12px] text-ink-soft/60">Email</p>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="border-t border-[#F0F0F4] pt-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-600">{doneCount}</p>
                <p className="text-[10px] text-green-600/70 font-medium">Completadas</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-amber-600">{totalCount - doneCount}</p>
                <p className="text-[10px] text-amber-600/70 font-medium">Pendientes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add task modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-xl text-ink" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Anadir tarea
            </h3>
            <label className="block">
              <span className="block text-[12px] font-medium text-ink-soft mb-1">Tarea</span>
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="crm-inp"
                autoFocus
                placeholder="Ej: Revisar sonido..."
                onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
              />
            </label>
            <label className="block">
              <span className="block text-[12px] font-medium text-ink-soft mb-1">Descripcion (opcional)</span>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="crm-inp"
                placeholder="Detalle adicional..."
                onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
              />
            </label>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setShowAdd(false)} className="text-sm px-4 py-2.5 rounded-xl text-ink-soft hover:bg-[#F5F5F8]">
                Cancelar
              </button>
              <button
                onClick={addTask}
                disabled={!newTitle.trim()}
                className="text-sm px-5 py-2.5 rounded-xl bg-gold text-white hover:bg-gold-dark transition-colors disabled:opacity-40"
              >
                Anadir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
