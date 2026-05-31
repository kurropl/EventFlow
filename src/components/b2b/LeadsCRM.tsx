'use client';
/**
 * EventFlow — Leads CRM
 * Gestión de leads (prospectos del configurador), presupuestos y conversión a cliente.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Lead {
  id: string; name: string; email: string | null; phone: string | null;
  source: string; status: string; notes: string | null;
  event_type: string | null; guest_count: number | null; event_date: string | null;
  converted_to_client_id: string | null;
  created_at: string; quotes: Quote[];
}
interface Quote {
  id: string; status: string; total_pvp: number; base_pvp: number;
  bar_price: number; extras_pvp: number; iva_pct: number;
  created_at: string; sent_at: string | null; accepted_at: string | null;
  valid_until: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', presupuestado: 'Presupuestado',
  convertido: 'Convertido', perdido: 'Perdido',
};
const STATUS_COLORS: Record<string, string> = {
  nuevo: 'bg-blue-50 text-blue-700 border-blue-200',
  contactado: 'bg-amber-50 text-amber-700 border-amber-200',
  presupuestado: 'bg-purple-50 text-purple-700 border-purple-200',
  convertido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  perdido: 'bg-gray-50 text-gray-500 border-gray-200',
};
const QUOTE_STATUS: Record<string, string> = {
  draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado', rejected: 'Rechazado', expired: 'Expirado',
};

const money = (n: number | string) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
};
const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

export default function LeadsCRM() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showConvert, setShowConvert] = useState(false);
  const [convertForm, setConvertForm] = useState({ fiscal_name: '', fiscal_nif: '', fiscal_address: '' });
  const [quoteEditId, setQuoteEditId] = useState<string | null>(null);
  const [quoteEdit, setQuoteEdit] = useState({ base_pvp: 0, bar_price: 0, extras_pvp: 0, iva_pct: 10 });

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    params.set('limit', '200');
    try {
      const res = await fetch(`/api/leads?${params}`);
      const json = await res.json();
      setLeads(json.data || []);
    } catch (e) { console.error('fetchLeads', e); }
    setLoading(false);
  }, [search, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchLeads();
  };

  // Crear presupuesto desde un lead
  const createQuote = async (lead: Lead) => {
    // Find event by email
    const evRes = await fetch(`/api/events?email=${lead.email}`);
    const evJson = await evRes.json();
    const events = evJson.events || evJson.data || [];
    if (events.length === 0) { alert('No se encontró ningún evento para este lead'); return; }

    const event = events[0];
    const res = await fetch('/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: event.id, lead_id: lead.id,
        base_pvp: event.total_pvp || 0, base_cost: event.total_cost || 0,
        bar_price: event.bar_price || 0, iva_pct: event.iva_pct || 10,
      }),
    });
    if (res.ok) {
      await updateStatus(lead.id, 'presupuestado');
      fetchLeads();
    }
  };

  // Aceptar presupuesto → convertir lead a cliente + crear event_order
  const acceptQuote = async (quoteId: string) => {
    const q = selectedLead?.quotes.find(q => q.id === quoteId);
    if (!q) return;
    setShowConvert(true);
  };

  const handleConvert = async () => {
    if (!selectedLead || !convertForm.fiscal_name || !convertForm.fiscal_nif) {
      alert('Nombre fiscal y NIF son obligatorios');
      return;
    }
    // Update lead status to convertido + create client
    const res = await fetch(`/api/leads/${selectedLead.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'convertido',
        fiscal_name: convertForm.fiscal_name,
        fiscal_nif: convertForm.fiscal_nif,
        fiscal_address: convertForm.fiscal_address,
      }),
    });
    if (res.ok) {
      // Mark the quote as accepted
      const acceptedQuote = selectedLead.quotes.find(q => q.status === 'sent' || q.status === 'draft');
      if (acceptedQuote) {
        await fetch(`/api/quotes/${acceptedQuote.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'accepted' }),
        });
      }
      setShowConvert(false);
      setConvertForm({ fiscal_name: '', fiscal_nif: '', fiscal_address: '' });
      fetchLeads();
      setSelectedLead(null);
    }
  };

  const updateQuotePrice = async (quoteId: string) => {
    await fetch(`/api/quotes/${quoteId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_pvp: quoteEdit.base_pvp,
        bar_price: quoteEdit.bar_price,
        extras_pvp: quoteEdit.extras_pvp,
        iva_pct: quoteEdit.iva_pct,
        status: 'sent',
      }),
    });
    setQuoteEditId(null);
    fetchLeads();
  };

  const sendQuote = async (quoteId: string) => {
    await fetch(`/api/quotes/${quoteId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'sent' }),
    });
    fetchLeads();
  };

  if (selectedLead) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedLead(null)}
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        </button>
        <div>
          <h2 className="text-lg font-bold text-[#1A1A2E]">{selectedLead.name}</h2>
          <p className="text-xs text-[#6B7280]">{selectedLead.email} · {selectedLead.phone || '—'}</p>
        </div>
        <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[selectedLead.status] || ''}`}>
          {STATUS_LABELS[selectedLead.status] || selectedLead.status}
        </span>
      </div>

      {/* Datos del evento asociado */}
      {selectedLead.event_date && (
        <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
          <div><p className="text-[11px] text-[#6B7280] uppercase tracking-wide">Tipo</p><p className="text-sm font-medium text-[#1A1A2E]">{selectedLead.event_type || '—'}</p></div>
          <div><p className="text-[11px] text-[#6B7280] uppercase tracking-wide">Fecha evento</p><p className="text-sm font-medium text-[#1A1A2E]">{fmtDate(selectedLead.event_date)}</p></div>
          <div><p className="text-[11px] text-[#6B7280] uppercase tracking-wide">Comensales</p><p className="text-sm font-medium text-[#1A1A2E]">{selectedLead.guest_count || '—'}</p></div>
        </div>
      )}

      {/* Presupuestos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">Presupuestos</h3>
          {selectedLead.status !== 'convertido' && selectedLead.status !== 'perdido' && (
            <button onClick={() => createQuote(selectedLead)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">
              + Nuevo Presupuesto
            </button>
          )}
        </div>
        {(!selectedLead.quotes || selectedLead.quotes.length === 0) ? (
          <div className="text-center py-8 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E7EB]">
            Sin presupuestos todavía
          </div>
        ) : (
          selectedLead.quotes.map(q => (
            <div key={q.id} className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] text-[#6B7280]">
                    {QUOTE_STATUS[q.status] || q.status}
                  </span>
                  <span className="text-xs text-[#9CA3AF]">{fmtDate(q.created_at)}</span>
                </div>
                <span className="text-sm font-bold text-[#1A1A2E]">{money(q.total_pvp)}</span>
              </div>

              {quoteEditId === q.id ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAF8F5] rounded-lg">
                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wide">Base PVP</label>
                    <input type="number" value={quoteEdit.base_pvp} onChange={e => setQuoteEdit(p => ({...p, base_pvp: +e.target.value}))}
                      className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wide">Barra libre</label>
                    <input type="number" value={quoteEdit.bar_price} onChange={e => setQuoteEdit(p => ({...p, bar_price: +e.target.value}))}
                      className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wide">Extras</label>
                    <input type="number" value={quoteEdit.extras_pvp} onChange={e => setQuoteEdit(p => ({...p, extras_pvp: +e.target.value}))}
                      className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wide">IVA %</label>
                    <input type="number" value={quoteEdit.iva_pct} onChange={e => setQuoteEdit(p => ({...p, iva_pct: +e.target.value}))}
                      className="w-full text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button onClick={() => { updateQuotePrice(q.id); }}
                      className="flex-1 text-[11px] font-medium py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">
                      Guardar y Enviar
                    </button>
                    <button onClick={() => setQuoteEditId(null)}
                      className="text-[11px] font-medium px-4 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setQuoteEditId(q.id); setQuoteEdit({ base_pvp: q.base_pvp, bar_price: q.bar_price, extras_pvp: q.extras_pvp, iva_pct: q.iva_pct }); }}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
                    Editar Precios
                  </button>
                  {q.status === 'draft' && (
                    <button onClick={() => sendQuote(q.id)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors">
                      Enviar Presupuesto
                    </button>
                  )}
                  {q.status === 'sent' && (
                    <button onClick={() => acceptQuote(q.id)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#15803D] text-white hover:bg-[#166534] transition-colors">
                      ✅ Aceptar Presupuesto
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal de conversión a cliente */}
      <AnimatePresence>
        {showConvert && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowConvert(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-lg w-full mx-4 space-y-4">
              <h3 className="text-lg font-bold text-[#1A1A2E]">Aceptar Presupuesto</h3>
              <p className="text-sm text-[#6B7280]">Introduce los datos fiscales del cliente para generar la orden de evento y la factura.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Nombre Fiscal *</label>
                  <input type="text" value={convertForm.fiscal_name} placeholder={selectedLead?.name || ''}
                    onChange={e => setConvertForm(p => ({...p, fiscal_name: e.target.value}))}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">NIF / CIF *</label>
                  <input type="text" value={convertForm.fiscal_nif} placeholder="12345678Z"
                    onChange={e => setConvertForm(p => ({...p, fiscal_nif: e.target.value.toUpperCase()}))}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Dirección Fiscal</label>
                  <input type="text" value={convertForm.fiscal_address} placeholder="Calle, número, ciudad"
                    onChange={e => setConvertForm(p => ({...p, fiscal_address: e.target.value}))}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/10" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleConvert}
                  className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">
                  ✅ Convertir a Cliente y Activar Evento
                </button>
                <button onClick={() => setShowConvert(false)}
                  className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">Leads</h1>
          <p className="text-xs text-[#6B7280]">Prospectos del configurador y contactos manuales</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-[11px] font-medium border border-[#E5E7EB] rounded-xl px-3 py-2 bg-white text-[#1A1A2E] focus:outline-none">
            <option value="">Todos los estados</option>
            <option value="nuevo">Nuevo</option>
            <option value="contactado">Contactado</option>
            <option value="presupuestado">Presupuestado</option>
            <option value="convertido">Convertido</option>
            <option value="perdido">Perdido</option>
          </select>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="text-sm border border-[#E5E7EB] rounded-xl pl-9 pr-4 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/10" />
          </div>
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[#6B7280]">Cargando...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E7EB]">
          No hay leads todavía. Cuando un cliente envíe un presupuesto desde el configurador, aparecerá aquí.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Lead</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Contacto</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Evento</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Presupuestos</th>
                <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="border-b border-[#F3F4F6] hover:bg-[#FAF8F5] cursor-pointer transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-[#1A1A2E] text-white flex items-center justify-center text-[10px] font-bold">
                        {initials(lead.name)}
                      </div>
                      <span className="text-sm font-medium text-[#1A1A2E]">{lead.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs text-[#6B7280]">{lead.email || '—'}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{lead.phone || ''}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs text-[#1A1A2E]">{lead.event_type || '—'}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{lead.guest_count ? `${lead.guest_count} pax` : ''}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[lead.status] || ''}`}>
                      {STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <span className="text-xs text-[#1A1A2E]">{lead.quotes?.length || 0}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-xs text-[#9CA3AF]">
                    {fmtDate(lead.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
