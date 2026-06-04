'use client';
/**
 * J.Benitez — Invitados (Admin)
 * 
 * Muestra los datos que el cliente ha rellenado en el formulario público
 * y permite al admin gestionar/ver/editar los invitados por evento.
 * 
 * Flujo:
 * 1. Cliente acepta presupuesto → se genera un enlace único /invitados/[token]
 * 2. Cliente rellena sus invitados (nombres, grupo, intolerancias)
 * 3. Admin ve todo lo que rellena el cliente
 * 4. Admin puede añadir/editar invitados manualmente si es necesario
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../shared/Icon';

interface EventLite {
  id: string;
  client_name: string;
  event_date: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  status: string;
  tables_suggested?: number;
  waiters_suggested?: number;
  selected_items?: any[];
  total_pvp?: number | string;
  bar_hours?: number;
  client_token?: string;
}

interface GuestFormEntry {
  name: string;
  group_name: string;
  menu_type: string;
  dietary: string[];
  notes: string;
}

interface GuestFormData {
  id: string;
  event_id: string;
  client_name: string;
  email: string;
  guests: GuestFormEntry[];
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  client_token?: string;
}

const DIET_OPTIONS = [
  { id: 'celiaco', label: 'Celíaco', short: 'Celíaco', color: 'bg-[#FEF3F3] text-[#B91C1C] border-[#FAD4D4]' },
  { id: 'vegetariano', label: 'Vegetariano', short: 'Veget.', color: 'bg-[#EFFAF2] text-[#15803D] border-[#D1FAE5]' },
  { id: 'vegano', label: 'Vegano', short: 'Vegano', color: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]' },
  { id: 'sin_lactosa', label: 'Sin lactosa', short: 'S/Lact.', color: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]' },
  { id: 'alergico_frutos_secos', label: 'Alergia frutos secos', short: 'A.Frutos', color: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]' },
  { id: 'alergico_marisco', label: 'Alergia marisco', short: 'A.Marisco', color: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]' },
  { id: 'otros', label: 'Otra restricción', short: 'Otra', color: 'bg-[#F5F5F8] text-[#6B7280] border-[#E5E7EB]' },
];
const DIET_LABEL = Object.fromEntries(DIET_OPTIONS.map(d => [d.id, d.short]));
const MENU_LABEL: Record<string, string> = { adulto: 'Adulto', nino: 'Niño/a', bebe: 'Bebé' };
const MENU_ICON: Record<string, string> = { adulto: '👤', nino: '👶', bebe: '🍼' };

function fmtDate(d: string) {
  const iso = (d || '').slice(0, 10);
  const [y, m, day] = iso.split('-');
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return y && m && day ? `${parseInt(day)} ${M[parseInt(m) - 1]} ${y}` : iso;
}

export default function GuestsManager() {
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventId, setEventId] = useState('');
  const [guestFormData, setGuestFormData] = useState<GuestFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Load events
  useEffect(() => {
    (async () => {
      try {
        const e = await fetch('/api/events?limit=200').then((r) => r.json());
        if (e.success) {
          setEvents(e.data);
          // Default to first accepted event, or first event
          const accepted = e.data.find((ev: EventLite) => ev.status === 'accepted');
          setEventId(accepted ? accepted.id : (e.data[0]?.id || ''));
        }
      } catch { /* empty */ } finally { setLoading(false); }
    })();
  }, []);

  // Load guest form data
  const loadGuestData = useCallback(async () => {
    if (!eventId) { setGuestFormData(null); return; }
    try {
      const res = await fetch(`/api/admin/guest-forms?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) {
        setGuestFormData(data.data || { guests: [], client_name: '', email: '' });
      }
    } catch { /* empty */ }
  }, [eventId]);

  useEffect(() => { loadGuestData(); }, [loadGuestData]);

  const ev = events.find((e) => e.id === eventId);

  // Merge client-submitted guests with admin-added guests
  const allGuests = useMemo(() => {
    if (!guestFormData) return [];
    return guestFormData.guests || [];
  }, [guestFormData]);

  const summary = useMemo(() => {
    const byMenu = { adulto: 0, nino: 0, bebe: 0 } as Record<string, number>;
    const byDiet: Record<string, number> = {};
    allGuests.forEach((g) => {
      byMenu[g.menu_type] = (byMenu[g.menu_type] || 0) + 1;
      (g.dietary || []).forEach((d) => { byDiet[d] = (byDiet[d] || 0) + 1; });
    });
    return {
      total: allGuests.length,
      byMenu, byDiet,
      hasDietary: Object.keys(byDiet).length > 0,
    };
  }, [allGuests]);

  const updateGuest = async (idx: number, field: string, value: any) => {
    if (!guestFormData) return;
    const updatedGuests = [...allGuests];
    updatedGuests[idx] = { ...updatedGuests[idx], [field]: value };
    setGuestFormData({ ...guestFormData, guests: updatedGuests });

    // Save to API
    setSaving(true);
    try {
      await fetch('/api/admin/guest-forms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, guests: updatedGuests }),
      });
    } catch { /* empty */ } finally { setSaving(false); }
  };

  const addGuest = async () => {
    if (!guestFormData) return;
    const newGuest: GuestFormEntry = { name: '', group_name: '', menu_type: 'adulto', dietary: [], notes: '' };
    const updatedGuests = [...allGuests, newGuest];
    setGuestFormData({ ...guestFormData, guests: updatedGuests });

    setSaving(true);
    try {
      await fetch('/api/admin/guest-forms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, guests: updatedGuests }),
      });
    } catch { /* empty */ } finally { setSaving(false); }
  };

  const removeGuest = async (idx: number) => {
    if (!guestFormData) return;
    const updatedGuests = allGuests.filter((_, i) => i !== idx);
    setGuestFormData({ ...guestFormData, guests: updatedGuests });

    setSaving(true);
    try {
      await fetch('/api/admin/guest-forms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, guests: updatedGuests }),
      });
    } catch { /* empty */ } finally { setSaving(false); }
  };

  const toggleDiet = (idx: number, dietId: string) => {
    const g = allGuests[idx];
    const next = g.dietary?.includes(dietId) ? g.dietary?.filter((d: string) => d !== dietId) : [...(g.dietary || []), dietId];
    updateGuest(idx, 'dietary', next);
  };

  const copyTokenLink = () => {
    if (!ev?.client_token) return;
    const url = `${window.location.origin}/invitados/${ev.client_token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const exportCsv = () => {
    const rows = [['Nombre', 'Grupo', 'Tipo', 'Restricciones', 'Notas']];
    allGuests.forEach((g) => rows.push([
      g.name, g.group_name || '', MENU_LABEL[g.menu_type] || g.menu_type,
      (g.dietary || []).map((d: string) => DIET_LABEL[d] || d).join(' / '), g.notes || ''
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `invitados-${ev?.client_name || 'evento'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Invitados</h2>
          <p className="text-[#6B7280] text-sm">Datos del formulario del cliente y gestión de comensales.</p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="crm-inp !w-auto !py-2 text-[13px]">
            {events.length === 0 && <option value="">No hay eventos</option>}
            {events.map((e) => <option key={e.id} value={e.id}>{e.client_name} · {fmtDate(e.event_date)}</option>)}
          </select>
          <button onClick={addGuest} className="text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            <Icon name="plus" className="w-4 h-4" /> Añadir
          </button>
        </div>
      </div>

      {ev && (
        <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
          <span>📅 {fmtDate(ev.event_date)}</span>
          <span>🎉 {ev.event_type}</span>
          <span>👥 {ev.guest_count} adultos{ev.kids_count > 0 ? ` + ${ev.kids_count} niños` : ''}</span>
        </div>
      )}

      {/* Client form link */}
      {ev && ev.client_token && (
        <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-[#1A1A1A]">Enlace para el cliente</h3>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">Envía este enlace al cliente para que rellene sus invitados</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-[11px] px-3 py-1.5 rounded-lg bg-[#F5F5F8] text-[#6B7280] truncate max-w-[200px]">
                {window.location.origin}/invitados/{ev.client_token}
              </code>
              <button onClick={copyTokenLink} className="p-2 rounded-lg text-[#9CA3AF] hover:text-[#C9A84C] hover:bg-[#FBF6E9] transition-all" title="Copiar enlace">
                {copiedToken ? <Icon name="check" className="w-4 h-4" /> : <Icon name="copy" className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Client submitted data */}
      {guestFormData && guestFormData.client_name && (
        <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-[#1A1A1A]">
              Datos del cliente
              {guestFormData.submitted_at && (
                <span className="ml-2 text-[11px] font-normal text-[#16A34A]">✓ Enviado {fmtDate(guestFormData.submitted_at)}</span>
              )}
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-[#9CA3AF] text-xs block">Cliente</span>
              <span className="font-medium">{guestFormData.client_name}</span>
            </div>
            {guestFormData.email && (
              <div>
                <span className="text-[#9CA3AF] text-xs block">Email</span>
                <span className="font-medium">{guestFormData.email}</span>
              </div>
            )}
            <div>
              <span className="text-[#9CA3AF] text-xs block">Invitados registrados</span>
              <span className="font-medium">{allGuests.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total invitados" value={summary.total} accent="#C9A84C" />
        <SummaryCard label="Adultos" value={summary.byMenu.adulto} accent="#1A1A1A" />
        <SummaryCard label="Niños" value={summary.byMenu.nino} accent="#3B82F6" />
        <SummaryCard label="Bebés" value={summary.byMenu.bebe} accent="#8B5CF6" />
      </div>

      {/* Kitchen export */}
      <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-[#1A1A1A]">Resumen dietético <span className="font-normal text-[#9CA3AF]">(todos)</span></h3>
          <button onClick={exportCsv} disabled={allGuests.length === 0} className="text-[13px] font-medium text-[#A88A3A] hover:underline disabled:opacity-40 flex items-center gap-1.5">
            <Icon name="download" className="w-3.5 h-3.5" /> Exportar CSV
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.byMenu).filter(([, n]) => n > 0).map(([k, n]) => (
            <span key={k} className="text-[12px] font-medium px-3 py-1.5 rounded-full bg-[#FBF6E9] text-[#8A6D1F] border border-[#EFE3BE]">
              {MENU_ICON[k]} {MENU_LABEL[k]}: {n}
            </span>
          ))}
          {DIET_OPTIONS.filter((d) => summary.byDiet[d.id]).map((d) => (
            <span key={d.id} className={`text-[12px] font-medium px-3 py-1.5 rounded-full border ${d.color}`}>
              {d.short}: {summary.byDiet[d.id]}
            </span>
          ))}
          {summary.total === 0 && <span className="text-[13px] text-[#9CA3AF]">Aún no hay invitados registrados.</span>}
        </div>
      </div>

      {/* Guest list */}
      <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
        <div className="divide-y divide-[#F2F2F5]">
          {loading && <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">Cargando…</div>}
          {!loading && allGuests.length === 0 && (
            <div className="px-5 py-12 text-center text-sm text-[#9CA3AF]">
              Sin invitados. <button onClick={() => setShowAdd(true)} className="text-[#C9A84C] hover:underline">Añade el primero</button>
            </div>
          )}
          {allGuests.map((g, idx) => (
            <div key={idx} className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#1A1A1A]">{g.name || <span className="text-[#C7C7CF] italic">Sin nombre</span>}</div>
                <div className="text-[12px] text-[#9CA3AF]">{g.group_name || 'Sin grupo'}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {DIET_OPTIONS.map((d) => {
                  const on = (g.dietary || []).includes(d.id);
                  return (
                    <button key={d.id} onClick={() => toggleDiet(idx, d.id)} title={d.label}
                      className={`text-[10px] px-2 py-1 rounded-full border transition-all ${on ? d.color : 'bg-white text-[#C7C7CF] border-[#ECECF1] hover:text-[#9CA3AF]'}`}>
                      {d.short}
                    </button>
                  );
                })}
              </div>
              <select value={g.menu_type} onChange={(e) => updateGuest(idx, 'menu_type', e.target.value)} className="crm-inp !w-auto !py-1.5 text-[12px]">
                <option value="adulto">👤 Adulto</option><option value="nino">👶 Niño/a</option><option value="bebe">🍼 Bebé</option>
              </select>
              <button onClick={() => removeGuest(idx)} className="p-1.5 rounded-lg text-[#C7C7CF] hover:text-[#DC2626] hover:bg-[#FEF2F2]" title="Eliminar">
                <Icon name="trash" className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: accent }} />
        <span className="text-[12px] text-[#6B7280]">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-[#1A1A1A] tabular-nums">{value}</div>
    </div>
  );
}
