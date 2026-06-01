'use client';
/**
 * EventFlow — Invitados
 * Lista de invitados por evento, RSVP y restricciones dietéticas exportables a cocina.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface EventLite { id: string; client_name: string; event_date: string; event_type: string; guest_count: number; kids_count: number; }
interface Guest { id: string; event_id: string; name: string; group_name: string | null; rsvp: string; menu_type: string; dietary: string[]; notes: string | null; }

const DIET: { id: string; label: string; short: string }[] = [
  { id: 'celiaco', label: 'Celíaco', short: 'Celíaco' },
  { id: 'vegetariano', label: 'Vegetariano', short: 'Veget.' },
  { id: 'vegano', label: 'Vegano', short: 'Vegano' },
  { id: 'sin_lactosa', label: 'Sin lactosa', short: 'S/Lact.' },
  { id: 'alergico_frutos_secos', label: 'Alergia frutos secos', short: 'A.Frutos' },
  { id: 'alergico_marisco', label: 'Alergia marisco', short: 'A.Marisco' },
  { id: 'otros', label: 'Otra restricción', short: 'Otra' },
];
const DIET_LABEL = Object.fromEntries(DIET.map((d) => [d.id, d.short]));
const MENU_LABEL: Record<string, string> = { adulto: 'Adulto', nino: 'Niño', bebe: 'Bebé' };
const RSVP_CHIP: Record<string, string> = { confirmado: 'bg-[#EFFAF2] text-[#15803D]', pendiente: 'bg-[#FFF8EC] text-[#B45309]', rechazado: 'bg-[#FEF3F3] text-[#DC2626]' };
function fmtDate(d: string) { const iso = (d || '').slice(0, 10); const [y, m, day] = iso.split('-'); const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return y && m && day ? `${parseInt(day)} ${M[parseInt(m) - 1]} ${y}` : iso; }

export default function GuestsManager() {
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventId, setEventId] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const e = await fetch('/api/events?limit=200').then((r) => r.json());
        if (e.success) { setEvents(e.data); if (e.data[0]) setEventId(e.data[0].id); }
      } catch { /* empty */ } finally { setLoading(false); }
    })();
  }, []);

  const loadGuests = useCallback(async () => {
    if (!eventId) { setGuests([]); return; }
    try {
      const g = await fetch(`/api/guests?event_id=${eventId}`).then((r) => r.json());
      if (g.success) setGuests(g.data);
    } catch { /* empty */ }
  }, [eventId]);
  useEffect(() => { loadGuests(); }, [loadGuests]);

  const ev = events.find((e) => e.id === eventId);

  const summary = useMemo(() => {
    const conf = guests.filter((g) => g.rsvp === 'confirmado');
    const byMenu = { adulto: 0, nino: 0, bebe: 0 } as Record<string, number>;
    conf.forEach((g) => { byMenu[g.menu_type] = (byMenu[g.menu_type] || 0) + 1; });
    const byDiet: Record<string, number> = {};
    conf.forEach((g) => (g.dietary || []).forEach((d) => { byDiet[d] = (byDiet[d] || 0) + 1; }));
    return {
      total: guests.length,
      confirmado: conf.length,
      pendiente: guests.filter((g) => g.rsvp === 'pendiente').length,
      rechazado: guests.filter((g) => g.rsvp === 'rechazado').length,
      byMenu, byDiet,
    };
  }, [guests]);

  const patch = async (g: Guest, body: any) => {
    setGuests((prev) => prev.map((x) => x.id === g.id ? { ...x, ...body } : x));
    await fetch(`/api/guests/${g.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  };
  const remove = async (g: Guest) => { setGuests((prev) => prev.filter((x) => x.id !== g.id)); await fetch(`/api/guests/${g.id}`, { method: 'DELETE' }); };
  const toggleDiet = (g: Guest, d: string) => {
    const next = (g.dietary || []).includes(d) ? g.dietary.filter((x) => x !== d) : [...(g.dietary || []), d];
    patch(g, { dietary: next });
  };

  const exportCsv = () => {
    const rows = [['Nombre', 'Grupo', 'RSVP', 'Menú', 'Restricciones', 'Notas']];
    guests.forEach((g) => rows.push([g.name, g.group_name || '', g.rsvp, MENU_LABEL[g.menu_type] || g.menu_type, (g.dietary || []).map((d) => DIET_LABEL[d] || d).join(' / '), g.notes || '']));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `invitados-${ev?.client_name || 'evento'}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Invitados</h2>
          <p className="text-[#6B7280] text-sm">Confirmaciones y restricciones dietéticas por evento.</p>
          {ev && (
            <div className="flex items-center gap-3 mt-2 text-xs text-[#9CA3AF]">
              <span>📅 {fmtDate(ev.event_date)}</span>
              <span>👥 {ev.guest_count} adultos</span>
              {ev.kids_count > 0 && <span>👶 {ev.kids_count} niños</span>}
              <span>🎉 {ev.event_type}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 self-start">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="crm-inp !w-auto !py-2 text-[13px]">
            {events.length === 0 && <option value="">No hay eventos</option>}
            {events.map((e) => <option key={e.id} value={e.id}>{e.client_name} · {fmtDate(e.event_date)}</option>)}
          </select>
          <button onClick={() => setShowAdd(true)} disabled={!eventId} className="text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>+ Invitado</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total invitados" value={summary.total} accent="#C9A84C" />
        <SummaryCard label="Confirmados" value={summary.confirmado} accent="#16A34A" />
        <SummaryCard label="Pendientes" value={summary.pendiente} accent="#D9920B" />
        <SummaryCard label="Rechazados" value={summary.rechazado} accent="#DC2626" />
      </div>

      {/* Kitchen export panel */}
      <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-[#1A1A1A]">Resumen para cocina <span className="font-normal text-[#9CA3AF]">(confirmados)</span></h3>
          <button onClick={exportCsv} disabled={guests.length === 0} className="text-[13px] font-medium text-[#A88A3A] hover:underline disabled:opacity-40">Exportar CSV ↓</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byMenu).filter(([, n]) => n > 0).map(([k, n]) => (
            <span key={k} className="text-[12px] font-medium px-3 py-1.5 rounded-full bg-[#FBF6E9] text-[#8A6D1F] border border-[#EFE3BE]">{MENU_LABEL[k]}: {n}</span>
          ))}
          {DIET.filter((d) => summary.byDiet[d.id]).map((d) => (
            <span key={d.id} className="text-[12px] font-medium px-3 py-1.5 rounded-full bg-[#FEF3F3] text-[#B91C1C] border border-[#FAD4D4]">{d.label}: {summary.byDiet[d.id]}</span>
          ))}
          {summary.confirmado === 0 && <span className="text-[13px] text-[#9CA3AF]">Aún no hay invitados confirmados.</span>}
        </div>
      </div>

      {/* Guest list */}
      <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="divide-y divide-[#F2F2F5]">
          {loading && <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Cargando…</div>}
          {!loading && guests.length === 0 && <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Sin invitados. Añade el primero.</div>}
          {guests.map((g) => (
            <div key={g.id} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#1A1A1A]">{g.name}</div>
                <div className="text-[12px] text-[#9CA3AF]">{g.group_name || 'Sin grupo'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DIET.map((d) => {
                  const on = (g.dietary || []).includes(d.id);
                  return (
                    <button key={d.id} onClick={() => toggleDiet(g, d.id)} title={d.label}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-all ${on ? 'bg-[#FEF3F3] text-[#B91C1C] border-[#FAD4D4]' : 'bg-white text-[#C7C7CF] border-[#ECECF1] hover:text-[#9CA3AF]'}`}>{d.short}</button>
                  );
                })}
              </div>
              <select value={g.menu_type} onChange={(e) => patch(g, { menu_type: e.target.value })} className="crm-inp !w-auto !py-1.5 text-[12px]">
                <option value="adulto">Adulto</option><option value="nino">Niño</option><option value="bebe">Bebé</option>
              </select>
              <select value={g.rsvp} onChange={(e) => patch(g, { rsvp: e.target.value })}
                className={`text-[12px] font-medium px-2.5 py-1.5 rounded-lg border-0 cursor-pointer ${RSVP_CHIP[g.rsvp]}`}>
                <option value="pendiente">Pendiente</option><option value="confirmado">Confirmado</option><option value="rechazado">Rechazado</option>
              </select>
              <button onClick={() => remove(g)} className="p-1.5 rounded-lg text-[#C7C7CF] hover:text-[#DC2626] hover:bg-[#FEF2F2]" title="Eliminar">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M6 7h12M9 7V5h6v2M10 11v6M14 11v6M7 7l1 13h8l1-13" /></svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <GuestForm eventId={eventId} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); loadGuests(); }} />}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-2 mb-2"><span className="w-2 h-2 rounded-full" style={{ background: accent }} /><span className="text-[12px] text-[#6B7280]">{label}</span></div>
      <div className="text-2xl font-semibold text-[#1A1A1A] tabular-nums">{value}</div>
    </div>
  );
}

function GuestForm({ eventId, onClose, onSaved }: { eventId: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', group_name: '', menu_type: 'adulto', rsvp: 'pendiente', dietary: [] as string[] });
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('');
  const toggle = (d: string) => setF((p) => ({ ...p, dietary: p.dietary.includes(d) ? p.dietary.filter((x) => x !== d) : [...p.dietary, d] }));
  const save = async () => {
    if (!f.name.trim()) { setErr('El nombre es obligatorio'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/guests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, event_id: eventId }) });
      const data = await res.json();
      if (!data.success) { setErr(data.error || 'Error'); return; }
      onSaved();
    } catch { setErr('Error de red'); } finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Añadir invitado</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Nombre *</span>
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className="crm-inp" autoFocus /></label>
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Grupo / mesa</span>
            <input value={f.group_name} onChange={(e) => setF({ ...f, group_name: e.target.value })} className="crm-inp" placeholder="Familia novia…" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Menú</span>
            <select value={f.menu_type} onChange={(e) => setF({ ...f, menu_type: e.target.value })} className="crm-inp">
              <option value="adulto">Adulto</option><option value="nino">Niño</option><option value="bebe">Bebé</option></select></label>
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">RSVP</span>
            <select value={f.rsvp} onChange={(e) => setF({ ...f, rsvp: e.target.value })} className="crm-inp">
              <option value="pendiente">Pendiente</option><option value="confirmado">Confirmado</option><option value="rechazado">Rechazado</option></select></label>
        </div>
        <div>
          <span className="block text-[12px] font-medium text-[#6B7280] mb-1.5">Restricciones dietéticas</span>
          <div className="flex flex-wrap gap-1.5">
            {DIET.map((d) => (
              <button key={d.id} onClick={() => toggle(d.id)}
                className={`text-[12px] px-2.5 py-1 rounded-full border transition-all ${f.dietary.includes(d.id) ? 'bg-[#FEF3F3] text-[#B91C1C] border-[#FAD4D4]' : 'bg-white text-[#9CA3AF] border-[#ECECF1]'}`}>{d.label}</button>
            ))}
          </div>
        </div>
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
