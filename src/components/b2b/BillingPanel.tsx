'use client';
/**
 * EventFlow — Facturación y Cobros
 * Anticipos, señales, vencimientos y estado de cobro por evento.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Payment {
  id: string;
  event_id: string;
  concept: string;
  amount: number | string;
  due_date: string | null;
  paid: boolean;
  paid_date: string | null;
  method: string | null;
  notes: string | null;
  client_name: string;
  event_date: string | null;
  event_type: string;
}
interface EventLite {
  id: string; client_name: string; event_date: string; event_type: string;
  status: string; total_pvp: number | string;
}

const money = (n: number | string) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(Number(n) || 0);
const todayIso = () => new Date().toISOString().slice(0, 10);
function fmtDate(d: string | null) {
  if (!d) return '—'; const iso = d.slice(0, 10); const [y, m, day] = iso.split('-');
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return y && m && day ? `${parseInt(day)} ${M[parseInt(m) - 1]} ${y}` : iso;
}

type Filter = 'todos' | 'pendiente' | 'vencido' | 'cobrado';

export default function BillingPanel() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [events, setEvents] = useState<EventLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('todos');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, e] = await Promise.all([
        fetch('/api/payments').then((r) => r.json()),
        fetch('/api/events?limit=200').then((r) => r.json()),
      ]);
      if (p.success) setPayments(p.data);
      if (e.success) setEvents(e.data);
    } catch { /* empty */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const isVencido = (p: Payment) => !p.paid && p.due_date && p.due_date.slice(0, 10) < todayIso();

  const kpis = useMemo(() => {
    const presupuestado = events.filter((e) => e.status !== 'cancelado').reduce((s, e) => s + (Number(e.total_pvp) || 0), 0);
    const cobrado = payments.filter((p) => p.paid).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const pendiente = payments.filter((p) => !p.paid).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    const vencido = payments.filter(isVencido).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return { presupuestado, cobrado, pendiente, vencido };
  }, [payments, events]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (filter === 'todos') return true;
      if (filter === 'cobrado') return p.paid;
      if (filter === 'pendiente') return !p.paid;
      if (filter === 'vencido') return isVencido(p);
      return true;
    });
  }, [payments, filter]);

  const togglePaid = async (p: Payment) => {
    setPayments((prev) => prev.map((x) => x.id === p.id ? { ...x, paid: !x.paid } : x));
    await fetch(`/api/payments/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paid: !p.paid }) });
    load();
  };
  const remove = async (p: Payment) => {
    if (!confirm('¿Eliminar este cobro?')) return;
    setPayments((prev) => prev.filter((x) => x.id !== p.id));
    await fetch(`/api/payments/${p.id}`, { method: 'DELETE' });
  };

  const KPIS = [
    { label: 'Presupuestado', value: kpis.presupuestado, accent: '#C9A84C' },
    { label: 'Cobrado', value: kpis.cobrado, accent: '#16A34A' },
    { label: 'Pendiente', value: kpis.pendiente, accent: '#D9920B' },
    { label: 'Vencido', value: kpis.vencido, accent: '#DC2626' },
  ];
  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'todos', label: 'Todos' }, { id: 'pendiente', label: 'Pendientes' },
    { id: 'vencido', label: 'Vencidos' }, { id: 'cobrado', label: 'Cobrados' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Facturación y Cobros</h2>
          <p className="text-[#6B7280] text-sm">Anticipos, señales y vencimientos por evento.</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all self-start"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>+ Registrar cobro</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ background: k.accent }} />
              <span className="text-[12px] text-[#6B7280]">{k.label}</span>
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A] tabular-nums">{loading ? '—' : money(k.value)}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`text-[13px] px-3.5 py-1.5 rounded-full border transition-all ${filter === f.id ? 'bg-[#1A1A1A] text-white border-[#1A1A1A]' : 'bg-white text-[#6B7280] border-[#ECECF1] hover:border-[#D1D5DB]'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="divide-y divide-[#F2F2F5]">
          {loading && <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Cargando…</div>}
          {!loading && filtered.length === 0 && <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">No hay cobros en esta vista.</div>}
          {filtered.map((p) => {
            const vencido = isVencido(p);
            return (
              <div key={p.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[#FAFAFC] transition-colors">
                <button onClick={() => togglePaid(p)} title={p.paid ? 'Marcar pendiente' : 'Marcar cobrado'}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${p.paid ? 'bg-[#16A34A] border-[#16A34A]' : 'border-[#D1D5DB] hover:border-[#16A34A]'}`}>
                  {p.paid && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#1A1A1A] truncate">{p.concept} · <span className="font-normal text-[#6B7280]">{p.client_name}</span></div>
                  <div className="text-[12px] text-[#9CA3AF]">
                    {p.paid ? `Cobrado ${fmtDate(p.paid_date)}` : p.due_date ? `Vence ${fmtDate(p.due_date)}` : 'Sin vencimiento'}
                    {p.method ? ` · ${p.method}` : ''}
                  </div>
                </div>
                {vencido && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FEF3F3] text-[#DC2626]">Vencido</span>}
                <div className="text-right flex-shrink-0">
                  <div className={`text-[14px] font-semibold tabular-nums ${p.paid ? 'text-[#16A34A]' : 'text-[#1A1A1A]'}`}>{money(p.amount)}</div>
                </div>
                <button onClick={() => remove(p)} className="p-1.5 rounded-lg text-[#C7C7CF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors" title="Eliminar">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M6 7h12M9 7V5h6v2M10 11v6M14 11v6M7 7l1 13h8l1-13" /></svg>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {showAdd && <PaymentForm events={events} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function PaymentForm({ events, onClose, onSaved }: { events: EventLite[]; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ event_id: events[0]?.id || '', concept: 'Señal reserva', amount: '', due_date: '', paid: false, method: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  const save = async () => {
    if (!f.event_id) { setErr('Selecciona un evento'); return; }
    if (!f.amount || Number(f.amount) <= 0) { setErr('Importe inválido'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json();
      if (!data.success) { setErr(data.error || 'Error'); return; }
      onSaved();
    } catch { setErr('Error de red'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Registrar cobro</h3>
        <label className="block">
          <span className="block text-[12px] font-medium text-[#6B7280] mb-1">Evento</span>
          <select value={f.event_id} onChange={(e) => set('event_id', e.target.value)} className="crm-inp">
            {events.length === 0 && <option value="">No hay eventos</option>}
            {events.map((e) => <option key={e.id} value={e.id}>{e.client_name} · {fmtDate(e.event_date)}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Concepto</span>
            <input value={f.concept} onChange={(e) => set('concept', e.target.value)} className="crm-inp" /></label>
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Importe (€)</span>
            <input type="number" value={f.amount} onChange={(e) => set('amount', e.target.value)} className="crm-inp" placeholder="0" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Vencimiento</span>
            <input type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} className="crm-inp" /></label>
          <label className="block"><span className="block text-[12px] font-medium text-[#6B7280] mb-1">Método</span>
            <select value={f.method} onChange={(e) => set('method', e.target.value)} className="crm-inp">
              <option value="">—</option><option>transferencia</option><option>efectivo</option><option>tarjeta</option><option>bizum</option>
            </select></label>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#374151]">
          <input type="checkbox" checked={f.paid} onChange={(e) => set('paid', e.target.checked)} className="w-4 h-4 accent-[#C9A84C]" />
          Ya cobrado
        </label>
        {err && <p className="text-sm text-[#DC2626]">{err}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="text-sm px-4 py-2.5 rounded-xl text-[#6B7280] hover:bg-[#F5F5F8]">Cancelar</button>
          <button onClick={save} disabled={saving} className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>{saving ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </motion.div>
    </div>
  );
}
