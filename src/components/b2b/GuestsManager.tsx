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
 * 
 * Auto-generación: cuando no hay formulario del cliente o tiene menos invitados
 * de los esperados, se generan placeholders según guest_count/kids_count del evento.
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
  _placeholder?: boolean;
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


function fmtDate(d: string) {
  const iso = (d || '').slice(0, 10);
  const [y, m, day] = iso.split('-');
  const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return y && m && day ? `${parseInt(day)} ${M[parseInt(m) - 1]} ${y}` : iso;
}

/**
 * Generate placeholder guests when no form data or form has fewer entries than expected.
 * Fills gaps with numbered "Invitado X" / "Niño X" placeholders.
 */
function generatePlaceholders(expectedAdults: number, expectedKids: number, existing: GuestFormEntry[]): GuestFormEntry[] {
  const result = [...existing];
  
  // Count how many adults and kids already have names
  const namedAdults = existing.filter(g => g.menu_type === 'adulto' && g.name.trim()).length;
  const namedKids = existing.filter(g => g.menu_type === 'nino' && g.name.trim()).length;
  
  // Add adult placeholders if needed
  const adultSlotsNeeded = Math.max(0, expectedAdults - namedAdults);
  for (let i = 0; i < adultSlotsNeeded; i++) {
    const num = namedAdults + i + 1;
    // Check if there's an unnamed adult slot we can reuse
    const unnamedIdx = result.findIndex(g => g.menu_type === 'adulto' && !g.name.trim() && g._placeholder);
    if (unnamedIdx >= 0) {
      result[unnamedIdx] = {
        ...result[unnamedIdx],
        name: `Invitado ${num}`,
        group_name: '',
        notes: '',
      };
    } else {
      result.push({
        name: `Invitado ${num}`,
        group_name: '',
        menu_type: 'adulto',
        dietary: [],
        notes: '',
        _placeholder: true,
      });
    }
  }
  
  // Add kid placeholders if needed
  const kidSlotsNeeded = Math.max(0, expectedKids - namedKids);
  for (let i = 0; i < kidSlotsNeeded; i++) {
    const num = namedKids + i + 1;
    const unnamedIdx = result.findIndex(g => g.menu_type === 'nino' && !g.name.trim() && g._placeholder);
    if (unnamedIdx >= 0) {
      result[unnamedIdx] = {
        ...result[unnamedIdx],
        name: `Niño ${num}`,
        group_name: '',
        notes: '',
      };
    } else {
      result.push({
        name: `Niño ${num}`,
        group_name: '',
        menu_type: 'nino',
        dietary: [],
        notes: '',
        _placeholder: true,
      });
    }
  }
  
  return result;
}

export default function GuestsManager() {
  const [events, setEvents] = useState<EventLite[]>([]);
  const [eventId, setEventId] = useState('');
  const [guestFormData, setGuestFormData] = useState<GuestFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

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
      } catch {
        setError('No se pudieron cargar los eventos');
      } finally { setLoading(false); }
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
    } catch {
      setError('No se pudieron cargar los datos de invitados');
    }
  }, [eventId]);

  useEffect(() => { loadGuestData(); }, [loadGuestData]);

  const ev = events.find((e) => e.id === eventId);

  // Merge client-submitted guests with auto-generated placeholders based on event guest_count
  const allGuests = useMemo(() => {
    if (!ev) return [];
    
    const formGuests = guestFormData?.guests || [];
    const expectedAdults = ev.guest_count || 0;
    const expectedKids = ev.kids_count || 0;
    
    // If no form data at all and no expected count, show nothing
    if (formGuests.length === 0 && expectedAdults === 0 && expectedKids === 0) return [];
    
    // Generate placeholders to fill up to expected count
    return generatePlaceholders(expectedAdults, expectedKids, formGuests);
  }, [guestFormData, ev]);

  // Check if we're using auto-generated data (no form submission yet)
  const isAutoGenerated = useMemo(() => {
    return !guestFormData?.submitted_at && allGuests.length > 0;
  }, [guestFormData, allGuests]);

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
    const updatedGuests = [...allGuests];
    updatedGuests[idx] = { ...updatedGuests[idx], [field]: value, _placeholder: false };
    setGuestFormData(prev => prev
      ? { ...prev, guests: updatedGuests }
      : { id: '', event_id: eventId, guests: updatedGuests, client_name: '', email: '', submitted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    );

    // Save to API
    setSaving(true);
    try {
      await fetch('/api/admin/guest-forms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, guests: updatedGuests }),
      });
    } catch { setError('Error al guardar'); } finally { setSaving(false); }
  };

  const addGuest = async () => {
    const newGuest: GuestFormEntry = { name: '', group_name: '', menu_type: 'adulto', dietary: [], notes: '' };
    const updatedGuests = [...allGuests, newGuest];
    setGuestFormData(prev => prev
      ? { ...prev, guests: updatedGuests }
      : { id: '', event_id: eventId, guests: updatedGuests, client_name: '', email: '', submitted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    );

    setSaving(true);
    try {
      await fetch('/api/admin/guest-forms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, guests: updatedGuests }),
      });
    } catch { setError('Error al guardar'); } finally { setSaving(false); }
  };

  const removeGuest = async (idx: number) => {
    const updatedGuests = allGuests.filter((_, i) => i !== idx);
    setGuestFormData(prev => prev
      ? { ...prev, guests: updatedGuests }
      : { id: '', event_id: eventId, guests: updatedGuests, client_name: '', email: '', submitted_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    );

    setSaving(true);
    try {
      await fetch('/api/admin/guest-forms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, guests: updatedGuests }),
      });
    } catch { setError('Error al guardar'); } finally { setSaving(false); }
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => { setError(null); loadGuestData(); }} className="text-red-600 underline text-xs ml-3">Reintentar</button>
        </div>
      )}

      {ev && (
        <div className="flex items-center gap-3 text-xs text-[#9CA3AF]">
          <span><Icon name="calendar" className="w-4 h-4 inline-block" /> {fmtDate(ev.event_date)}</span>
          <span><Icon name="star" className="w-4 h-4 inline-block" /> {ev.event_type}</span>
          <span><Icon name="userCheck" className="w-4 h-4 inline-block" /> {ev.guest_count} adultos{ev.kids_count > 0 ? ` + ${ev.kids_count} niños` : ''}</span>
        </div>
      )}

      {/* Auto-generated notice */}
      {isAutoGenerated && ev && (
        <div className="bg-[#FFF8E7] border border-[#EFE3BE] rounded-xl p-4 text-sm text-[#8A6D1F] flex items-start gap-3">
          <Icon name="info" className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#C9A84C]" />
          <div>
            <p className="font-semibold">Plantilla auto-generada</p>
            <p className="text-[13px] mt-0.5 text-[#9CA3AF]">
              Se han creado {ev.guest_count} adultos y {ev.kids_count > 0 ? `${ev.kids_count} niños` : ''} como plantilla según el presupuesto.
              Rellena los nombres de cada invitado. Los datos se guardan automáticamente.
            </p>
          </div>
        </div>
      )}

      {/* Menu items from quote */}
      {ev && ev.selected_items && ev.selected_items.length > 0 && (() => {
        const items = ev.selected_items as any[];
        const byCat: Record<string, any[]> = {};
        items.forEach((it: any) => {
          const cat = it.category || 'otros';
          if (!byCat[cat]) byCat[cat] = [];
          byCat[cat].push(it);
        });
        const catLabels: Record<string, string> = {
          'aperitivo-frio': 'Aperitivo frío', 'aperitivo-caliente': 'Aperitivo caliente',
          'carne': 'Carne', 'pescado': 'Pescado', 'postre': 'Postre',
          'bebida': 'Bebida', 'barra': 'Barra', 'otros': 'Otros',
        };
        const catIcons: Record<string, string> = {
          'aperitivo-frio': 'salad', 'aperitivo-caliente': 'flame',
          'carne': 'beef', 'pescado': 'fish', 'postre': 'cake',
          'bebida': 'wine', 'barra': 'beer', 'otros': 'utensils',
        };
        return (
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-[#1A1A1A]">Menú del presupuesto</h3>
              <span className="text-[11px] text-[#9CA3AF]">{items.length} platos</span>
            </div>
            <div className="space-y-3">
              {Object.entries(byCat).map(([cat, catItems]) => (
                <div key={cat}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon name={catIcons[cat] || 'utensils'} className="w-3.5 h-3.5 text-[#C9A84C]" />
                    <span className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">{catLabels[cat] || cat}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {catItems.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#F2F2F5]">
                        <span className="text-[12px] text-[#1A1A1A] truncate flex-1">{item.name}</span>
                        <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                          <span className="text-[11px] text-[#9CA3AF]">×{item.quantity}</span>
                          {item.unit_price_pvp && (
                            <span className="text-[11px] font-medium text-[#8A6D1F]">{Number(item.unit_price_pvp).toFixed(2).replace('.', ',')} €</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total invitados" value={summary.total} accent="#C9A84C" />
        <SummaryCard label="Adultos" value={summary.byMenu.adulto} accent="#1A1A1A" />
        <SummaryCard label="Niños" value={summary.byMenu.nino} accent="#3B82F6" />
        <SummaryCard label="Bebés" value={summary.byMenu.bebe} accent="#8B5CF6" />
      </div>

      {/* Dietary summary */}
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
              {MENU_LABEL[k]}: {n}
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
          {allGuests.map((g, idx) => {
            const isPlaceholder = g._placeholder && !g.name.trim();
            return (
              <div key={idx} className={`px-5 py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 ${isPlaceholder ? 'bg-[#FAFAFA]' : ''}`}>
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={g.name}
                    onChange={(e) => updateGuest(idx, 'name', e.target.value)}
                    placeholder={g.menu_type === 'nino' ? 'Nombre del niño...' : 'Nombre del invitado...'}
                    className={`text-[13px] font-semibold bg-transparent border-none outline-none w-full p-0 ${isPlaceholder ? 'text-[#C7C7CF]' : 'text-[#1A1A1A]'}`}
                  />
                  <input
                    type="text"
                    value={g.group_name}
                    onChange={(e) => updateGuest(idx, 'group_name', e.target.value)}
                    placeholder="Grupo (familia novia, amigos...)"
                    className="text-[12px] text-[#9CA3AF] bg-transparent border-none outline-none w-full p-0 mt-0.5"
                  />
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
                  <option value="adulto">Adulto</option><option value="nino">Niño/a</option><option value="bebe">Bebé</option>
                </select>

                <button onClick={() => removeGuest(idx)} className="p-1.5 rounded-lg text-[#C7C7CF] hover:text-[#DC2626] hover:bg-[#FEF2F2]" title="Eliminar">
                  <Icon name="trash" className="w-4 h-4" />
                </button>
              </div>
            );
          })}
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
