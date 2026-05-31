'use client';
/**
 * EventFlow — Agenda / Calendario
 * Vista mensual con eventos confirmados, citas comerciales y bloqueos de fecha.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface EventLite { id: string; client_name: string; event_type: string; guest_count: number; event_date: string; status: string; }
interface Appt { id: string; title: string; kind: 'cita' | 'bloqueo' | 'nota'; event_id: string | null; start_date: string; start_time: string | null; notes: string | null; client_name: string | null; }

const EVENT_TYPE: Record<string, string> = { boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo', bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro' };
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WD = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const KIND_COLOR: Record<string, string> = { cita: '#3B82F6', bloqueo: '#DC2626', nota: '#9CA3AF' };

export default function CalendarView() {
  const today = new Date();
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [events, setEvents] = useState<EventLite[]>([]);
  const [appts, setAppts] = useState<Appt[]>([]);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const monthStart = useMemo(() => new Date(view.getFullYear(), view.getMonth(), 1), [view]);
  const monthEnd = useMemo(() => new Date(view.getFullYear(), view.getMonth() + 1, 0), [view]);

  const load = useCallback(async () => {
    const from = iso(new Date(view.getFullYear(), view.getMonth() - 1, 1));
    const to = iso(new Date(view.getFullYear(), view.getMonth() + 2, 0));
    try {
      const [e, a] = await Promise.all([
        fetch('/api/events?limit=200').then((r) => r.json()),
        fetch(`/api/appointments?from=${from}&to=${to}`).then((r) => r.json()),
      ]);
      if (e.success) setEvents(e.data);
      if (a.success) setAppts(a.data);
    } catch { /* empty */ }
  }, [view]);
  useEffect(() => { load(); }, [load]);

  // Build grid (Mon-first), 6 weeks
  const cells = useMemo(() => {
    const firstWd = (monthStart.getDay() + 6) % 7; // 0 = Monday
    const start = new Date(monthStart); start.setDate(monthStart.getDate() - firstWd);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [monthStart]);

  const byDay = useMemo(() => {
    const map: Record<string, { events: EventLite[]; appts: Appt[] }> = {};
    const push = (k: string) => (map[k] ??= { events: [], appts: [] });
    events.forEach((e) => { if (e.status !== 'cancelado') push(e.event_date.slice(0, 10)).events.push(e); });
    appts.forEach((a) => push(a.start_date.slice(0, 10)).appts.push(a));
    return map;
  }, [events, appts]);

  const selItems = selDay ? (byDay[selDay] || { events: [], appts: [] }) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Agenda</h2>
          <p className="text-[#6B7280] text-sm">Eventos, citas comerciales y bloqueos del salón.</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <button onClick={() => { const d = new Date(); setView(new Date(d.getFullYear(), d.getMonth(), 1)); }}
            className="text-[13px] px-3 py-2 rounded-xl bg-white border border-[#ECECF1] text-[#6B7280] hover:border-[#D1D5DB]">Hoy</button>
          <button onClick={() => setShowAdd(true)} className="text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>+ Cita / bloqueo</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#F0F0F4]">
            <h3 className="font-semibold text-[#1A1A1A]">{MONTHS[view.getMonth()]} {view.getFullYear()}</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8]">‹</button>
              <button onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8]">›</button>
            </div>
          </div>
          <div className="grid grid-cols-7 border-b border-[#F0F0F4]">
            {WD.map((d) => <div key={d} className="py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              const k = iso(d);
              const inMonth = d.getMonth() === view.getMonth();
              const isToday = k === iso(today);
              const cell = byDay[k];
              const items = cell ? [...cell.events.map((e) => ({ color: '#C9A84C', label: e.client_name })), ...cell.appts.map((a) => ({ color: KIND_COLOR[a.kind], label: a.title }))] : [];
              return (
                <button key={i} onClick={() => setSelDay(k)}
                  className={`min-h-[78px] border-b border-r border-[#F2F2F5] p-1.5 text-left align-top transition-colors hover:bg-[#FAFAFC] ${inMonth ? '' : 'bg-[#FCFCFD]'} ${selDay === k ? 'ring-2 ring-inset ring-[#C9A84C]' : ''}`}>
                  <div className={`text-[12px] font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-[#1A1A1A] text-white' : inMonth ? 'text-[#374151]' : 'text-[#C7C7CF]'}`}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map((it, j) => (
                      <div key={j} className="flex items-center gap-1 text-[10px] text-[#4B5563] truncate">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: it.color }} />
                        <span className="truncate">{it.label}</span>
                      </div>
                    ))}
                    {items.length > 3 && <div className="text-[10px] text-[#9CA3AF] pl-2.5">+{items.length - 3} más</div>}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 px-5 py-3 text-[11px] text-[#6B7280]">
            <Legend color="#C9A84C" label="Evento" /><Legend color="#3B82F6" label="Cita" />
            <Legend color="#DC2626" label="Bloqueo" /><Legend color="#9CA3AF" label="Nota" />
          </div>
        </div>

        {/* Day detail */}
        <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-5">
          {!selDay && <p className="text-sm text-[#9CA3AF]">Selecciona un día para ver el detalle.</p>}
          {selDay && (
            <>
              <h3 className="font-semibold text-[#1A1A1A] mb-3">{fmtFull(selDay)}</h3>
              <div className="space-y-2">
                {selItems!.events.length === 0 && selItems!.appts.length === 0 && <p className="text-sm text-[#9CA3AF]">Día libre.</p>}
                {selItems!.events.map((e) => (
                  <div key={e.id} className="border border-[#ECECF1] rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: '#C9A84C' }} />
                      <span className="text-[13px] font-semibold text-[#1A1A1A]">{e.client_name}</span></div>
                    <div className="text-[12px] text-[#9CA3AF] pl-4">{EVENT_TYPE[e.event_type] || e.event_type} · {e.guest_count} pax</div>
                  </div>
                ))}
                {selItems!.appts.map((a) => (
                  <div key={a.id} className="border border-[#ECECF1] rounded-xl px-3.5 py-2.5 group">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: KIND_COLOR[a.kind] }} />
                        <span className="text-[13px] font-semibold text-[#1A1A1A] truncate">{a.title}</span></div>
                      <button onClick={async () => { await fetch(`/api/appointments/${a.id}`, { method: 'DELETE' }); load(); }}
                        className="text-[#C7C7CF] hover:text-[#DC2626] text-xs opacity-0 group-hover:opacity-100">✕</button>
                    </div>
                    <div className="text-[12px] text-[#9CA3AF] pl-4">{a.start_time ? `${a.start_time} · ` : ''}{a.kind}{a.notes ? ` · ${a.notes}` : ''}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowAdd(true)} className="mt-4 w-full text-[13px] font-medium text-[#A88A3A] border border-dashed border-[#E0D3A8] rounded-xl py-2.5 hover:bg-[#FBF6E9] transition-colors">
                + Añadir a este día
              </button>
            </>
          )}
        </div>
      </div>

      {showAdd && <ApptForm events={events} defaultDate={selDay || iso(today)} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}</span>;
}
function fmtFull(k: string) {
  const [y, m, d] = k.split('-'); return `${parseInt(d)} de ${MONTHS[parseInt(m) - 1]} de ${y}`;
}

function ApptForm({ events, defaultDate, onClose, onSaved }: { events: EventLite[]; defaultDate: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: '', kind: 'cita', start_date: defaultDate, start_time: '', event_id: '', notes: '' });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const save = async () => {
    if (!f.title.trim()) { setErr('El título es obligatorio'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json();
      if (!data.success) { setErr(data.error || 'Error'); return; }
      onSaved();
    } catch { setErr('Error de red'); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Nueva entrada de agenda</h3>
        <div className="flex gap-2">
          {(['cita', 'bloqueo', 'nota'] as const).map((kd) => (
            <button key={kd} onClick={() => set('kind', kd)}
              className={`flex-1 text-[13px] py-2 rounded-xl border capitalize transition-all ${f.kind === kd ? 'text-white border-transparent' : 'bg-white text-[#6B7280] border-[#ECECF1]'}`}
              style={f.kind === kd ? { background: KIND_COLOR[kd] } : {}}>{kd}</button>
          ))}
        </div>
        <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Título *</span>
          <input value={f.title} onChange={(e) => set('title', e.target.value)} className="crm-inp" autoFocus placeholder={f.kind === 'bloqueo' ? 'Motivo del bloqueo' : 'Visita / prueba de menú…'} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Fecha</span>
            <input type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} className="crm-inp" /></label>
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Hora</span>
            <input type="time" value={f.start_time} onChange={(e) => set('start_time', e.target.value)} className="crm-inp" /></label>
        </div>
        <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Evento vinculado (opcional)</span>
          <select value={f.event_id} onChange={(e) => set('event_id', e.target.value)} className="crm-inp">
            <option value="">— Ninguno —</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.client_name}</option>)}
          </select></label>
        <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Notas</span>
          <textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className="crm-inp resize-none" /></label>
        {err && <p className="text-sm text-[#DC2626]">{err}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="text-sm px-4 py-2.5 rounded-xl text-[#6B7280] hover:bg-[#F5F5F8]">Cancelar</button>
          <button onClick={save} disabled={saving} className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>{saving ? 'Guardando…' : 'Añadir'}</button>
        </div>
      </motion.div>
    </div>
  );
}
