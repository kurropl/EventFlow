'use client';
/**
 * EventFlow — Clientes (CRM)
 * Ficha de cliente con historial de eventos, totales y notas de seguimiento.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

interface ClientRow {
  client_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[] | null;
  notes: string | null;
  event_count: number | string;
  total_value: number | string;
  last_event: string | null;
  first_event: string | null;
}

interface EventRow {
  id: string;
  client_email: string;
  client_name: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  event_date: string;
  status: string;
  total_pvp: number | string;
}

const EVENT_TYPE: Record<string, string> = {
  boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro',
};
const STATUS_CHIP: Record<string, string> = {
  nuevo: 'bg-[#EFF4FF] text-[#2563EB]', propuesta_enviada: 'bg-[#FFF8EC] text-[#B45309]',
  confirmado: 'bg-[#EFFAF2] text-[#15803D]', cancelado: 'bg-[#FEF3F3] text-[#DC2626]',
  en_curso: 'bg-[#EEF2FF] text-[#4338CA]', completado: 'bg-[#F3F4F6] text-[#374151]',
};

const money = (n: number | string) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: 'always' }).format(Number(n) || 0);
function fmtDate(d: string | null) {
  if (!d) return '—';
  const iso = d.slice(0, 10); const [y, m, day] = iso.split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return y && m && day ? `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}` : iso;
}
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export default function ClientsCRM() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, e] = await Promise.all([
        fetch('/api/clients').then((r) => r.json()),
        fetch('/api/events?limit=200').then((r) => r.json()),
      ]);
      if (c.success) setClients(c.data);
      if (e.success) setEvents(e.data);
    } catch { /* keep empty */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.name, c.email, c.phone, c.company].some((v) => (v || '').toLowerCase().includes(q)));
  }, [clients, search]);

  const historyFor = useCallback(
    (email: string | null) =>
      events.filter((e) => (email && e.client_email?.toLowerCase() === email.toLowerCase()))
        .sort((a, b) => (b.event_date || '').localeCompare(a.event_date || '')),
    [events]
  );

  const totalValue = clients.reduce((s, c) => s + (Number(c.total_value) || 0), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Clientes</h2>
          <p className="text-[#6B7280] text-sm">{clients.length} contactos · {money(totalValue)} en eventos</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all self-start"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>+ Nuevo cliente</button>
      </div>

      <div className="relative max-w-sm">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, email, teléfono…"
          className="w-full text-sm bg-white border border-[#ECECF1] rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors" />
        <svg className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
        </svg>
      </div>

      <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-3 border-b border-[#F0F0F4] text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
          <div className="col-span-4">Cliente</div><div className="col-span-3">Contacto</div>
          <div className="col-span-2 text-center">Eventos</div><div className="col-span-2 text-right">Total</div>
          <div className="col-span-1 text-right">Último</div>
        </div>
        <div className="divide-y divide-[#F2F2F5]">
          {loading && <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Cargando…</div>}
          {!loading && filtered.length === 0 && <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">No hay clientes que coincidan.</div>}
          {filtered.map((c) => (
            <button key={(c.client_id || c.email || c.name)} onClick={() => setSelected(c)}
              className="w-full text-left grid grid-cols-2 md:grid-cols-12 gap-3 px-5 py-3.5 items-center hover:bg-[#FAFAFC] transition-colors">
              <div className="col-span-2 md:col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>{initials(c.name)}</div>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-[#1A1A1A] truncate">{c.name}</div>
                  {c.company && <div className="text-[12px] text-[#9CA3AF] truncate">{c.company}</div>}
                </div>
              </div>
              <div className="hidden md:block col-span-3 min-w-0 text-[12px] text-[#6B7280]">
                <div className="truncate">{c.email || '—'}</div><div className="truncate">{c.phone || ''}</div>
              </div>
              <div className="hidden md:block col-span-2 text-center text-[13px] font-medium text-[#374151] tabular-nums">{c.event_count}</div>
              <div className="hidden md:block col-span-2 text-right text-[13px] font-semibold text-[#1A1A1A] tabular-nums">{money(c.total_value)}</div>
              <div className="hidden md:block col-span-1 text-right text-[12px] text-[#9CA3AF]">{c.last_event ? fmtDate(c.last_event) : '—'}</div>
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <ClientDrawer client={selected} history={historyFor(selected.email)} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
      )}
      {showNew && <ClientForm onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
    </div>
  );
}

// ── Detail drawer ──────────────────────────────────────────────
function ClientDrawer({ client, history, onClose, onSaved }: { client: ClientRow; history: EventRow[]; onClose: () => void; onSaved: () => void }) {
  const [notes, setNotes] = useState(client.notes || '');
  const [phone, setPhone] = useState(client.phone || '');
  const [company, setCompany] = useState(client.company || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/clients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: client.name, email: client.email, phone, company, notes }),
      });
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ x: 420 }} animate={{ x: 0 }} className="relative w-full max-w-md bg-[#FAFAFC] h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#ECECF1] px-5 py-4 flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>{initials(client.name)}</div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[#1A1A1A] truncate">{client.name}</div>
            <div className="text-[12px] text-[#9CA3AF] truncate">{client.email || 'Sin email'}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#F5F5F8]">✕</button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Eventos" value={String(client.event_count)} />
            <Stat label="Total" value={money(client.total_value)} />
          </div>
          <div className="space-y-3">
            <Field label="Teléfono"><input value={phone} onChange={(e) => setPhone(e.target.value)} className="crm-inp" /></Field>
            <Field label="Empresa"><input value={company} onChange={(e) => setCompany(e.target.value)} className="crm-inp" /></Field>
            <Field label="Notas de seguimiento">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className="crm-inp resize-none" placeholder="Preferencias, conversaciones, próximos pasos…" />
            </Field>
          </div>
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF] mb-2">Historial de eventos</h4>
            <div className="space-y-2">
              {history.length === 0 && <p className="text-sm text-[#9CA3AF]">Sin eventos registrados.</p>}
              {history.map((e) => (
                <div key={e.id} className="bg-white border border-[#ECECF1] rounded-xl px-3.5 py-2.5 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#1A1A1A]">{EVENT_TYPE[e.event_type] || e.event_type} · {e.guest_count}{e.kids_count > 0 ? `+${e.kids_count}` : ''} pax</div>
                    <div className="text-[12px] text-[#9CA3AF]">{fmtDate(e.event_date)}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[13px] font-semibold text-[#1A1A1A]">{money(e.total_pvp)}</div>
                    <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5 ${STATUS_CHIP[e.status] || 'bg-[#F3F4F6] text-[#374151]'}`}>{e.status.replace('_', ' ')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full text-sm font-medium text-white px-4 py-3 rounded-xl shadow-sm disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </motion.div>
    </div>
  );
}

// ── New client modal ───────────────────────────────────────────
function ClientForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: '', email: '', phone: '', company: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) { setErr('El nombre es obligatorio'); return; }
    setSaving(true); setErr('');
    try {
      const res = await fetch('/api/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const data = await res.json();
      if (!data.success) { setErr(data.error || 'Error'); return; }
      onSaved();
    } catch { setErr('Error de red'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-xl text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Nuevo cliente</h3>
        <Field label="Nombre *"><input value={f.name} onChange={set('name')} className="crm-inp" autoFocus /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Email"><input value={f.email} onChange={set('email')} className="crm-inp" /></Field>
          <Field label="Teléfono"><input value={f.phone} onChange={set('phone')} className="crm-inp" /></Field>
        </div>
        <Field label="Empresa"><input value={f.company} onChange={set('company')} className="crm-inp" /></Field>
        <Field label="Notas"><textarea value={f.notes} onChange={set('notes')} rows={3} className="crm-inp resize-none" /></Field>
        {err && <p className="text-sm text-[#DC2626]">{err}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button onClick={onClose} className="text-sm px-4 py-2.5 rounded-xl text-[#6B7280] hover:bg-[#F5F5F8]">Cancelar</button>
          <button onClick={save} disabled={saving} className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>{saving ? 'Guardando…' : 'Crear cliente'}</button>
        </div>
      </motion.div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-[#ECECF1] rounded-xl px-4 py-3">
      <div className="text-[11px] text-[#9CA3AF]">{label}</div>
      <div className="text-lg font-semibold text-[#1A1A1A] tabular-nums">{value}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[#6B7280] mb-1">{label}</span>
      {children}
    </label>
  );
}
