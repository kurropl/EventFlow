'use client';
/**
 * EventFlow — Leads CRM
 * Gestión de leads (prospectos del configurador), presupuestos y conversión a cliente.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../shared/Icon';
import { DataCard, DataList, PageHeader } from '@/components/ui';

interface Lead {
  id: string; name: string; email: string | null; phone: string | null;
  source: string; status: string; notes: string | null;
  event_type: string | null; guest_count: number | null; event_date: string | null;
  converted_to_client_id: string | null;
  assigned_to: string | null; assigned_to_name: string | null;
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Interaction {
  id: string;
  type: 'llamada' | 'email' | 'whatsapp' | 'nota' | 'reunion';
  notes: string | null;
  created_by_name: string | null;
  created_at: string;
}

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  llamada: 'Llamada', email: 'Email', whatsapp: 'WhatsApp', nota: 'Nota', reunion: 'Reunión',
};

/* G13 (Sprint 4/5): historial de interacciones — antes registrado en el
 * backend (POST/GET /api/interactions) sin ningún punto de la UI que lo
 * usara. */
function LeadInteractionsTimeline({ leadId }: { leadId: string }) {
  const [items, setItems] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<Interaction['type']>('llamada');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/interactions?lead_id=${leadId}`);
      const json = await res.json();
      setItems(json.data || []);
    } catch {}
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const addInteraction = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, type, notes: notes || null }),
      });
      if (res.ok) {
        setNotes('');
        fetchItems();
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">Historial de interacciones</h3>
      <div className="flex gap-2 p-3 rounded-xl bg-cream border border-cream-dark">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as Interaction['type'])}
          className="text-xs border border-cream-dark rounded-lg px-2 py-2 bg-white focus:outline-none"
        >
          {Object.entries(INTERACTION_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notas (opcional)..."
          className="flex-1 text-sm border border-cream-dark rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gold/30"
        />
        <button
          onClick={addInteraction}
          disabled={saving}
          className="text-xs font-medium px-3 py-2 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Registrar'}
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-ink-soft-60">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-ink-soft-60 italic">Sin interacciones registradas todavía</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-start gap-3 p-3 rounded-lg bg-white border border-cream-dark">
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-cream text-ink-soft shrink-0 mt-0.5">
                {INTERACTION_TYPE_LABELS[it.type] || it.type}
              </span>
              <div className="flex-1 min-w-0">
                {it.notes && <p className="text-sm text-ink">{it.notes}</p>}
                <p className="text-[11px] text-ink-soft-60 mt-0.5">
                  {it.created_by_name || 'Sistema'} · {fmtDate(it.created_at)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [stockWarnings, setStockWarnings] = useState<Array<{ ingredient_name: string; needed: number; available: number; unit: string; deficit: number }>>([]);
  const [showStockWarnings, setShowStockWarnings] = useState(false);
  // G13 (Sprint 4/5): propietario comercial — filtro "mis leads"
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [myLeadsOnly, setMyLeadsOnly] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => {
      const id = d?.user?.id;
      if (id && UUID_RE.test(id)) setCurrentUserId(id);
    }).catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    if (myLeadsOnly && currentUserId) params.set('assigned_to', currentUserId);
    params.set('limit', '200');
    try {
      const res = await fetch(`/api/leads?${params}`);
      const json = await res.json();
      setLeads(json.data || []);
    } catch (e) { console.error('fetchLeads', e); }
    setLoading(false);
  }, [search, statusFilter, myLeadsOnly, currentUserId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/leads/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchLeads();
  };

  // Crear presupuesto desde un lead (crea evento si no existe)
  const createQuote = async (lead: Lead) => {
    // 1. Try to find existing event by email
    let eventId: string | null = null;
    let eventPvp = 0;
    let eventCost = 0;
    let eventBarPrice = 0;

    if (lead.email) {
      const evRes = await fetch(`/api/events?email=${encodeURIComponent(lead.email)}`);
      const evJson = await evRes.json();
      const events = evJson.events || evJson.data || [];
      if (events.length > 0) {
        eventId = events[0].id;
        eventPvp = events[0].total_pvp || 0;
        eventCost = events[0].total_cost || 0;
        eventBarPrice = events[0].bar_price || 0;
      }
    }

    // 2. If no event found, create one from lead data
    if (!eventId) {
      const evRes = await fetch('/api/events', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: lead.name,
          client_email: lead.email || '',
          client_phone: lead.phone || '',
          event_type: lead.event_type || 'boda',
          guest_count: lead.guest_count || 50,
          event_date: lead.event_date || new Date().toISOString().split('T')[0],
          status: 'draft',
          selected_items: [],
          total_pvp: 0,
          total_cost: 0,
          bar_hours: 0,
          bar_price: 0,
          iva_pct: 10,
          notes: `Auto-creado desde lead: ${lead.name}`,
        }),
      });
      const evJson = await evRes.json();
      if (!evJson.data?.id) { alert('Error creando evento para el lead'); return; }
      eventId = evJson.data.id;
    }

    // 3. Create quote linked to lead
    const res = await fetch('/api/quotes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: eventId, lead_id: lead.id,
        base_pvp: eventPvp, base_cost: eventCost,
        bar_price: eventBarPrice, iva_pct: 10,
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
      // Get client ID from response
      const clientJson = await res.json();
      const clientId = clientJson?.data?.client?.id;

      // Mark the quote as accepted
      const acceptedQuote = selectedLead.quotes.find(q => q.status === 'sent' || q.status === 'draft');
      if (acceptedQuote) {
        const quoteRes = await fetch(`/api/quotes/${acceptedQuote.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'accepted' }),
        });
        const quoteData = await quoteRes.json();
        // Check for stock warnings
        if (quoteData.stockWarnings && quoteData.stockWarnings.length > 0) {
          setStockWarnings(quoteData.stockWarnings);
          setShowStockWarnings(true);
        }
      }

      // Create event order (this moves the event to in_progress)
      if (acceptedQuote) {
        await fetch('/api/event-orders', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quote_id: acceptedQuote.id, client_id: clientId || null }),
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
          className="w-8 h-8 flex items-center justify-center rounded-lg border border-cream-dark hover:bg-cream transition-colors">
          <Icon name="arrowLeft" className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-lg font-bold text-ink">{selectedLead.name}</h2>
          <p className="text-xs text-ink-soft">{selectedLead.email} · {selectedLead.phone || '—'}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={selectedLead.status}
            onChange={(e) => {
              const newStatus = e.target.value;
              setSelectedLead({ ...selectedLead, status: newStatus });
              updateStatus(selectedLead.id, newStatus);
            }}
            className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg border ${STATUS_COLORS[selectedLead.status] || ''} focus:outline-none focus:ring-2 focus:ring-ink/10 cursor-pointer`}
          >
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Datos del evento asociado */}
      {selectedLead.event_date && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-cream border border-cream-dark">
          <div><p className="text-[11px] text-ink-soft uppercase tracking-wide">Tipo</p><p className="text-sm font-medium text-ink">{selectedLead.event_type || '—'}</p></div>
          <div><p className="text-[11px] text-ink-soft uppercase tracking-wide">Fecha evento</p><p className="text-sm font-medium text-ink">{fmtDate(selectedLead.event_date)}</p></div>
          <div><p className="text-[11px] text-ink-soft uppercase tracking-wide">Comensales</p><p className="text-sm font-medium text-ink">{selectedLead.guest_count || '—'}</p></div>
        </div>
      )}

      {/* Presupuestos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Presupuestos</h3>
          {selectedLead.status !== 'convertido' && selectedLead.status !== 'perdido' && (
            <button onClick={() => createQuote(selectedLead)}
              className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-ink text-white hover:bg-ink-light transition-colors">
              + Nuevo Presupuesto
            </button>
          )}
        </div>
        {(!selectedLead.quotes || selectedLead.quotes.length === 0) ? (
          <div className="text-center py-8 text-sm text-ink-soft bg-cream rounded-xl border border-dashed border-cream-dark">
            Sin presupuestos todavía
          </div>
        ) : (
          selectedLead.quotes.map(q => (
            <div key={q.id} className="p-4 rounded-xl bg-white border border-cream-dark space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-cream-dark bg-cream text-ink-soft">
                    {QUOTE_STATUS[q.status] || q.status}
                  </span>
                  <span className="text-xs text-ink-soft-60">{fmtDate(q.created_at)}</span>
                </div>
                <span className="text-sm font-bold text-ink">{money(q.total_pvp)}</span>
              </div>

              {quoteEditId === q.id ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-cream rounded-lg">
                  <div>
                    <label className="text-[10px] text-ink-soft uppercase tracking-wide">Base PVP</label>
                    <input type="number" value={quoteEdit.base_pvp} onChange={e => setQuoteEdit(p => ({...p, base_pvp: +e.target.value}))}
                      className="w-full text-sm border border-cream-dark rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-soft uppercase tracking-wide">Barra libre</label>
                    <input type="number" value={quoteEdit.bar_price} onChange={e => setQuoteEdit(p => ({...p, bar_price: +e.target.value}))}
                      className="w-full text-sm border border-cream-dark rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-soft uppercase tracking-wide">Extras</label>
                    <input type="number" value={quoteEdit.extras_pvp} onChange={e => setQuoteEdit(p => ({...p, extras_pvp: +e.target.value}))}
                      className="w-full text-sm border border-cream-dark rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div>
                    <label className="text-[10px] text-ink-soft uppercase tracking-wide">IVA %</label>
                    <input type="number" value={quoteEdit.iva_pct} onChange={e => setQuoteEdit(p => ({...p, iva_pct: +e.target.value}))}
                      className="w-full text-sm border border-cream-dark rounded-lg px-3 py-1.5 bg-white" />
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <button onClick={() => { updateQuotePrice(q.id); }}
                      className="flex-1 text-[11px] font-medium py-1.5 rounded-lg bg-ink text-white hover:bg-ink-light transition-colors">
                      Guardar y Enviar
                    </button>
                    <button onClick={() => setQuoteEditId(null)}
                      className="text-[11px] font-medium px-4 py-1.5 rounded-lg border border-cream-dark hover:bg-cream transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => { setQuoteEditId(q.id); setQuoteEdit({ base_pvp: q.base_pvp, bar_price: q.bar_price, extras_pvp: q.extras_pvp, iva_pct: q.iva_pct }); }}
                    className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-cream-dark hover:bg-cream transition-colors">
                    Editar Precios
                  </button>
                  {q.status === 'draft' && (
                    <button onClick={() => sendQuote(q.id)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-gold text-ink hover:bg-gold-dark transition-colors">
                      Enviar Presupuesto
                    </button>
                  )}
                  {q.status === 'sent' && (
                    <button onClick={() => acceptQuote(q.id)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-success text-white hover:bg-success/90 transition-colors">
                      Aceptar Presupuesto
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Timeline de interacciones (G13, Sprint 5) */}
      <LeadInteractionsTimeline leadId={selectedLead.id} />

      {/* Modal de conversión a cliente */}
      <AnimatePresence>
        {showConvert && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowConvert(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl p-6 shadow-xl max-w-lg w-full mx-4 space-y-4">
              <h3 className="text-lg font-bold text-ink">Aceptar Presupuesto</h3>
              <p className="text-sm text-ink-soft">Introduce los datos fiscales del cliente para generar la orden de evento y la factura.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-ink-soft uppercase tracking-wide mb-1">Nombre Fiscal *</label>
                  <input type="text" value={convertForm.fiscal_name} placeholder={selectedLead?.name || ''}
                    onChange={e => setConvertForm(p => ({...p, fiscal_name: e.target.value}))}
                    className="w-full text-sm border border-cream-dark rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ink/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-soft uppercase tracking-wide mb-1">NIF / CIF *</label>
                  <input type="text" value={convertForm.fiscal_nif} placeholder="12345678Z"
                    onChange={e => setConvertForm(p => ({...p, fiscal_nif: e.target.value.toUpperCase()}))}
                    className="w-full text-sm border border-cream-dark rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ink/10" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-ink-soft uppercase tracking-wide mb-1">Dirección Fiscal</label>
                  <input type="text" value={convertForm.fiscal_address} placeholder="Calle, número, ciudad"
                    onChange={e => setConvertForm(p => ({...p, fiscal_address: e.target.value}))}
                    className="w-full text-sm border border-cream-dark rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-ink/10" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={handleConvert}
                  className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-success text-white hover:bg-success/90 transition-colors">
                  Convertir a Cliente y Activar Evento
                </button>
                <button onClick={() => setShowConvert(false)}
                  className="text-sm font-medium px-5 py-2.5 rounded-xl border border-cream-dark hover:bg-cream transition-colors">
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
      <PageHeader
        title="Leads"
        subtitle="Prospectos del configurador y contactos manuales"
        actions={
          <>
            {currentUserId && (
              <button
                onClick={() => setMyLeadsOnly((v) => !v)}
                className={`text-[11px] font-medium rounded-xl px-3 py-2 border transition-colors ${
                  myLeadsOnly ? 'bg-gold text-ink border-gold' : 'bg-white text-ink-soft border-cream-dark hover:border-gold'
                }`}
              >
                Mis leads
              </button>
            )}
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="text-[11px] font-medium border border-cream-dark rounded-xl px-3 py-2 bg-white text-ink focus:outline-none">
              <option value="">Todos los estados</option>
              <option value="nuevo">Nuevo</option>
              <option value="contactado">Contactado</option>
              <option value="presupuestado">Presupuestado</option>
              <option value="convertido">Convertido</option>
              <option value="perdido">Perdido</option>
            </select>
          </>
        }
      />

      {/* Leads DataList */}
      <DataList
        loading={loading}
        count={leads.length}
        filters={
          <div className="relative">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-soft-60" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="text-sm border border-cream-dark rounded-xl pl-9 pr-4 py-2 w-56 focus:outline-none focus:ring-2 focus:ring-ink/10" />
          </div>
        }
        emptyTitle="No hay leads todavía"
        emptyDescription="Cuando un cliente envíe un presupuesto desde el configurador, aparecerá aquí."
      >
        {leads.map((lead) => {
          const statusVariant =
            lead.status === 'convertido' ? 'success' :
            lead.status === 'presupuestado' ? 'warning' :
            lead.status === 'nuevo' ? 'info' :
            lead.status === 'perdido' ? 'danger' : 'neutral';
          return (
            <DataCard
              key={lead.id}
              onClick={() => setSelectedLead(lead)}
              avatar={{ initials: initials(lead.name) }}
              title={lead.name}
              subtitle={lead.email || undefined}
              badges={[{ label: STATUS_LABELS[lead.status] || lead.status, variant: statusVariant }]}
              meta={[
                { label: 'Tel', value: lead.phone || '—' },
                { label: 'Evento', value: `${lead.event_type || '—'} · ${lead.guest_count || 0} pax` },
                { label: 'Presupuestos', value: String(lead.quotes?.length || 0) },
                { label: 'Propietario', value: lead.assigned_to_name || 'Sin asignar' },
                { label: 'Fecha', value: fmtDate(lead.created_at) },
              ]}
            />
          );
        })}
      </DataList>

      {/* ── Stock Warnings Modal ── */}
      {showStockWarnings && stockWarnings.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowStockWarnings(false)}>
          <div className="bg-white rounded-2xl shadow-2xl border border-cream-dark max-w-lg w-full mx-4 p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-cream-dark flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                <Icon name="alertTriangle" className="w-5 h-5 text-warning" />
              </div>
              <div>
                <h3 className="text-[15px] font-semibold text-ink">Stock insuficiente</h3>
                <p className="text-xs text-ink-soft">Hay ingredientes que no cubren la demanda del evento</p>
              </div>
            </div>
            <div className="px-6 py-4 max-h-[320px] overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream-dark">
                    <th className="text-left py-2 text-ink-soft-60 font-medium text-[11px] uppercase">Ingrediente</th>
                    <th className="text-right py-2 text-ink-soft-60 font-medium text-[11px] uppercase">Necesario</th>
                    <th className="text-right py-2 text-ink-soft-60 font-medium text-[11px] uppercase">Disponible</th>
                    <th className="text-right py-2 text-ink-soft-60 font-medium text-[11px] uppercase">Déficit</th>
                  </tr>
                </thead>
                <tbody>
                  {stockWarnings.map((w, i) => (
                    <tr key={i} className="border-b border-cream-dark last:border-b-0">
                      <td className="py-2 text-ink text-[13px] font-medium">{w.ingredient_name}</td>
                      <td className="py-2 text-right text-ink text-[13px] tabular-nums">{w.needed} {w.unit}</td>
                      <td className="py-2 text-right text-warning text-[13px] tabular-nums font-medium">{w.available} {w.unit}</td>
                      <td className="py-2 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-danger/10 text-danger">
                          -{w.deficit} {w.unit}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 bg-cream border-t border-cream-dark flex justify-end">
              <button
                onClick={() => setShowStockWarnings(false)}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-ink text-white hover:bg-ink-light transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
