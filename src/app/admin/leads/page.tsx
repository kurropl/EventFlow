/**
 * EventFlow — Lead Intake Form (Manual + WhatsApp)
 * Admin page for manually creating leads or generating a WhatsApp QR code
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  notes: string | null;
  event_type: string | null;
  guest_count: number | null;
  event_date: string | null;
  created_at: string;
}

const EVENT_TYPES = [
  { id: 'boda', label: 'Boda' },
  { id: 'cumpleaños', label: 'Cumpleaños' },
  { id: 'corporativo', label: 'Corporativo' },
  { id: 'bautizo', label: 'Bautizo' },
  { id: 'comunión', label: 'Comunión' },
  { id: 'otro', label: 'Otro' },
];

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  presupuestado: 'Presupuestado',
  convertido: 'Convertido',
  perdido: 'Perdido',
};

const STATUS_COLORS: Record<string, string> = {
  nuevo: 'bg-blue-50 text-blue-700 border-blue-200',
  contactado: 'bg-amber-50 text-amber-700 border-amber-200',
  presupuestado: 'bg-purple-50 text-purple-700 border-purple-200',
  convertido: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  perdido: 'bg-gray-50 text-gray-500 border-gray-200',
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
  const [showNew, setShowNew] = useState(false);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsappQR, setWhatsappQR] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  // Form state for new lead
  const [form, setForm] = useState({
    name: '', email: '', phone: '', source: 'manual',
    event_type: 'boda', guest_count: '', event_date: '', notes: '',
  });

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

  const handleCreateLead = async () => {
    if (!form.name.trim()) return;
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          source: form.source,
          event_type: form.event_type,
          guest_count: form.guest_count ? parseInt(form.guest_count, 10) : null,
          event_date: form.event_date || null,
          notes: form.notes || null,
        }),
      });
      if (res.ok) {
        setShowNew(false);
        setForm({ name: '', email: '', phone: '', source: 'manual', event_type: 'boda', guest_count: '', event_date: '', notes: '' });
        fetchLeads();
      }
    } catch (e) { console.error(e); }
  };

  const handleWhatsAppQR = async () => {
    setWhatsappLoading(true);
    try {
      // Generate a WhatsApp link for the salon
      const phone = '+34955000000'; // Replace with actual salon number
      const message = encodeURIComponent('¡Hola! Me gustaría solicitar información sobre vuestro salón de celebraciones.');
      const url = `https://wa.me/${phone.replace('+', '')}?text=${message}`;
      setWhatsappQR(url);
      setShowWhatsApp(true);
    } catch (e) {
      console.error(e);
    } finally {
      setWhatsappLoading(false);
    }
  };

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    if (statusFilter && l.status !== statusFilter) return false;
    if (!q) return true;
    return [l.name, l.email, l.phone].some((v) => (v || '').toLowerCase().includes(q));
  });

  const stats = {
    total: leads.length,
    nuevos: leads.filter((l) => l.status === 'nuevo').length,
    contactados: leads.filter((l) => l.status === 'contactado').length,
    presupuestados: leads.filter((l) => l.status === 'presupuestado').length,
    convertidos: leads.filter((l) => l.status === 'convertido').length,
    perdidos: leads.filter((l) => l.status === 'perdido').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Leads
          </h1>
          <p className="text-sm text-[#6B7280]">
            Prospectos procedentes del configurador, WhatsApp y contactos manuales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleWhatsAppQR}
            className="text-sm font-medium px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#25D366] hover:bg-[#F0FFF4] transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            WhatsApp
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            + Nuevo lead
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '#1A1A1A' },
          { label: 'Nuevos', value: stats.nuevos, color: '#3B82F6' },
          { label: 'Contactados', value: stats.contactados, color: '#D9920B' },
          { label: 'Presupuestados', value: stats.presupuestados, color: '#8B5CF6' },
          { label: 'Convertidos', value: stats.convertidos, color: '#16A34A' },
          { label: 'Perdidos', value: stats.perdidos, color: '#DC2626' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-[#ECECF1] p-3">
            <div className="text-[11px] text-[#9CA3AF]">{s.label}</div>
            <div className="text-xl font-bold text-[#1A1A1A]" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email, teléfono..."
            className="w-full text-sm border border-[#ECECF1] rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#C9A84C] transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-sm border border-[#ECECF1] rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:border-[#C9A84C]"
        >
          <option value="">Todos los estados</option>
          <option value="nuevo">Nuevo</option>
          <option value="contactado">Contactado</option>
          <option value="presupuestado">Presupuestado</option>
          <option value="convertido">Convertido</option>
          <option value="perdido">Perdido</option>
        </select>
      </div>

      {/* Source breakdown */}
      <div className="bg-white rounded-xl border border-[#ECECF1] p-4">
        <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide mb-3">Fuentes de entrada</h3>
        <div className="flex gap-4">
          {(() => {
            const sources: Record<string, { count: number; label: string; color: string }> = {
              configurador: { count: 0, label: 'Configurador', color: '#C9A84C' },
              whatsapp: { count: 0, label: 'WhatsApp', color: '#25D366' },
              manual: { count: 0, label: 'Manual', color: '#6B7280' },
            };
            leads.forEach((l) => {
              if (sources[l.source]) sources[l.source].count++;
            });
            return Object.entries(sources).map(([key, s]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ background: s.color }} />
                <span className="text-sm text-[#6B7280]">{s.label}</span>
                <span className="text-sm font-bold text-[#1A1A1A]">{s.count}</span>
              </div>
            ));
          })()}
        </div>
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="text-center py-12 text-sm text-[#9CA3AF]">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#9CA3AF] bg-white rounded-2xl border border-dashed border-[#E5E7EB]">
          No hay leads todavía. Cuando un cliente envíe un presupuesto desde el configurador, aparecerá aquí.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Lead</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Contacto</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Fuente</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Evento</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Estado</th>
                <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  className="border-b border-[#F3F4F6] hover:bg-[#FAF8F5] cursor-pointer transition-colors"
                >
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
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      lead.source === 'configurador' ? 'bg-[#FBF6E9] text-[#A88A3A]' :
                      lead.source === 'whatsapp' ? 'bg-[#F0FFF4] text-[#25D366]' :
                      'bg-[#F3F4F6] text-[#6B7280]'
                    }`}>
                      {lead.source === 'configurador' ? 'Configurador' : lead.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}
                    </span>
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
                  <td className="px-4 py-3.5 text-right text-xs text-[#9CA3AF]">
                    {fmtDate(lead.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* New Lead Modal */}
      <AnimatePresence>
        {showNew && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowNew(false); }}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-xl text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Nuevo lead
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Fuente</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none"
                  >
                    <option value="manual">Manual</option>
                    <option value="configurador">Configurador</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Tipo evento</label>
                  <select
                    value={form.event_type}
                    onChange={(e) => setForm({ ...form, event_type: e.target.value })}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none"
                  >
                    {EVENT_TYPES.map((et) => (
                      <option key={et.id} value={et.id}>{et.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none"
                  placeholder="Nombre completo"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none"
                    placeholder="email@ejemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Nº Comensales</label>
                  <input
                    type="number"
                    value={form.guest_count}
                    onChange={(e) => setForm({ ...form, guest_count: e.target.value })}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none"
                    placeholder="150"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Fecha evento</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(e) => setForm({ ...form, event_date: e.target.value })}
                    className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Notas</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none resize-none"
                  placeholder="Observaciones..."
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowNew(false)}
                  className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateLead}
                  className="flex-1 text-sm font-medium text-white py-2.5 rounded-xl shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  Crear lead
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp QR Modal */}
      <AnimatePresence>
        {showWhatsApp && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowWhatsApp(false); }}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-xl text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                WhatsApp del Salón
              </h3>
              <p className="text-sm text-[#6B7280]">
                Comparte este enlace o QR con tus clientes para que te contacten directamente por WhatsApp.
              </p>

              {whatsappQR ? (
                <div className="space-y-4">
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 flex flex-col items-center">
                    {/* Simple QR code placeholder - in production use a real QR library */}
                    <div className="w-48 h-48 bg-[#F5F5F8] rounded-lg flex items-center justify-center mb-4">
                      <div className="text-center">
                        <svg className="w-16 h-16 text-[#25D366] mx-auto mb-2" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        <p className="text-xs text-[#9CA3AF]">QR Code</p>
                      </div>
                    </div>
                    <a
                      href={whatsappQR}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-[#25D366] hover:underline"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      Abrir WhatsApp
                    </a>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Mensaje predefinido</label>
                    <textarea
                      readOnly
                      value="¡Hola! Me gustaría solicitar información sobre vuestro salón de celebraciones."
                      rows={3}
                      className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 bg-[#FAFAFC] resize-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-sm text-[#9CA3AF]">Generando enlace...</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowWhatsApp(false)}
                  className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lead Detail */}
      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdateStatus={updateStatus}
          onRefresh={fetchLeads}
        />
      )}
    </div>
  );
}

// ── Lead Detail Panel ──────────────────────────────────────────
function LeadDetail({
  lead, onClose, onUpdateStatus, onRefresh,
}: {
  lead: Lead;
  onClose: () => void;
  onUpdateStatus: (id: string, status: string) => void;
  onRefresh: () => void;
}) {
  const [notes, setNotes] = useState(lead.notes || '');
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    setSaving(true);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <motion.div
        initial={{ x: 420 }} animate={{ x: 0 }}
        className="relative w-full max-w-md bg-white h-full overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#ECECF1] px-5 py-4 flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            {initials(lead.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[#1A1A1A] truncate">{lead.name}</div>
            <div className="text-[12px] text-[#9CA3AF] truncate">{lead.email || 'Sin email'}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#9CA3AF] hover:bg-[#F5F5F8]">✕</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status */}
          <div>
            <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-2">Estado</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => onUpdateStatus(lead.id, key)}
                  className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-all ${
                    lead.status === key
                      ? STATUS_COLORS[key]
                      : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Event info */}
          {lead.event_type && (
            <div className="bg-[#FAF8F5] border border-[#E5E7EB] rounded-xl p-4 space-y-2">
              <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Datos del evento</h4>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div>
                  <span className="text-[11px] text-[#9CA3AF]">Tipo</span>
                  <p className="font-medium text-[#1A1A1A]">{lead.event_type}</p>
                </div>
                <div>
                  <span className="text-[11px] text-[#9CA3AF]">Fecha</span>
                  <p className="font-medium text-[#1A1A1A]">{fmtDate(lead.event_date)}</p>
                </div>
                <div>
                  <span className="text-[11px] text-[#9CA3AF]">Comensales</span>
                  <p className="font-medium text-[#1A1A1A]">{lead.guest_count || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {/* Contact info */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wide">Contacto</h4>
            <div className="text-sm">
              <p className="text-[#6B7280]">📧 {lead.email || '—'}</p>
              <p className="text-[#6B7280]">📱 {lead.phone || '—'}</p>
              <p className="text-[#6B7280]">📝 Fuente: {lead.source === 'configurador' ? 'Configurador' : lead.source === 'whatsapp' ? 'WhatsApp' : 'Manual'}</p>
              <p className="text-[#6B7280]">📅 Creado: {fmtDate(lead.created_at)}</p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-2">Notas</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full text-sm border border-[#E5E7EB] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C] resize-none"
              placeholder="Observaciones, conversaciones, próximos pasos..."
            />
            <button
              onClick={saveNotes}
              disabled={saving}
              className="mt-2 text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              {saving ? 'Guardando...' : 'Guardar notas'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
