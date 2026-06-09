'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '../shared/Icon';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Worker {
  id: string;
  name: string;
  phone: string;
  roles: string[];
  uniform: string;
  active: boolean;
}

interface EventOption {
  id: string;
  client_name: string;
  event_date: string;
  status: string;
}

interface StaffingLine {
  id: string;
  event_id: string;
  role: string;
  slots_needed: number;
  assigned_count: number;
  start_time: string;
  end_time: string;
  location: string;
  attire: string;
  status: string;
  assignments?: Assignment[];
  offers?: Offer[];
}

interface Assignment {
  id: string;
  worker_id: string;
  worker_name: string;
  position: number;
  status: string;
}

interface Offer {
  id: string;
  worker_id: string;
  worker_name: string;
  status: string;
  sent_at: string;
}

type Tab = 'workers' | 'event_staffing';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const ROLE_OPTIONS = [
  'Camarero',
  'Cocinero',
  'Barman',
  'Ayudante',
  'Supervisor',
  'Limpieza',
  'Seguridad',
  'Montaje',
  'Dj',
  'Fotógrafo',
];

function statusBadge(status: string) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    active: { label: 'Activo', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
    inactive: { label: 'Inactivo', bg: 'bg-[#FEF3F3]', color: 'text-[#DC2626]' },
    confirmed: { label: 'Confirmado', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
    pending: { label: 'Pendiente', bg: 'bg-[#FFF8EC]', color: 'text-[#D97706]' },
    open: { label: 'Abierto', bg: 'bg-[#EEF2FF]', color: 'text-[#4F46E5]' },
    filled: { label: 'Completo', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
    draft: { label: 'Borrador', bg: 'bg-[#F5F5F8]', color: 'text-[#6B7280]' },
    declined: { label: 'Rechazado', bg: 'bg-[#FEF3F3]', color: 'text-[#DC2626]' },
    accepted: { label: 'Aceptado', bg: 'bg-[#EFFAF2]', color: 'text-[#16A34A]' },
  };
  return map[status] || map.draft;
}

function formatTime(t: string) {
  if (!t) return '—';
  // If it's a full ISO date, extract the time
  if (t.includes('T')) {
    const d = new Date(t);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  return t;
}

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StaffingManager() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get('event_id') || '';
  const [activeTab, setActiveTab] = useState<Tab>(initialEventId ? 'event_staffing' : 'workers');

  /* ── Workers state ── */
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loadingWorkers, setLoadingWorkers] = useState(true);
  const [searchWorker, setSearchWorker] = useState('');
  const [showWorkerForm, setShowWorkerForm] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [workerForm, setWorkerForm] = useState({
    name: '',
    phone: '',
    roles: [] as string[],
    uniform: '',
    active: true,
  });
  const [savingWorker, setSavingWorker] = useState(false);
  const [workerFormError, setWorkerFormError] = useState('');

  /* ── Event staffing state ── */
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(initialEventId);
  const [staffingLines, setStaffingLines] = useState<StaffingLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [expandedLineId, setExpandedLineId] = useState<string | null>(null);
  const [showLineForm, setShowLineForm] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [lineForm, setLineForm] = useState({
    role: '',
    slots_needed: '1',
    start_time: '',
    end_time: '',
    location: '',
    attire: '',
    status: 'open',
  });
  const [savingLine, setSavingLine] = useState(false);

  /* ── Offer modal state ── */
  const [offerLineId, setOfferLineId] = useState<string | null>(null);
  const [offerLineRole, setOfferLineRole] = useState('');
  const [offerSelectedWorkers, setOfferSelectedWorkers] = useState<Set<string>>(new Set());
  const [sendingOffers, setSendingOffers] = useState(false);

  /* ───────────────────────────────────────────────────────────────── */
  /*  Data loading                                                     */
  /* ───────────────────────────────────────────────────────────────── */

  const loadWorkers = useCallback(async () => {
    try {
      setLoadingWorkers(true);
      const res = await fetch('/api/workers');
      const data = await res.json();
      if (data.success) setWorkers(data.data || []);
    } catch { /* ignore */ }
    finally { setLoadingWorkers(false); }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?limit=200');
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadStaffingLines = useCallback(async (eventId: string) => {
    if (!eventId) { setStaffingLines([]); return; }
    try {
      setLoadingLines(true);
      const res = await fetch(`/api/staffing/lines?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) setStaffingLines(data.data || []);
      else setStaffingLines([]);
    } catch { setStaffingLines([]); }
    finally { setLoadingLines(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'workers') loadWorkers();
    if (activeTab === 'event_staffing' && events.length === 0) loadEvents();
    // Auto-load events if we have an initial event_id from URL
    if (initialEventId && events.length === 0) loadEvents();
  }, [activeTab, loadWorkers, loadEvents, events.length, initialEventId]);

  useEffect(() => {
    if (selectedEvent) loadStaffingLines(selectedEvent);
  }, [selectedEvent, loadStaffingLines]);

  /* ───────────────────────────────────────────────────────────────── */
  /*  Derived data                                                     */
  /* ───────────────────────────────────────────────────────────────── */

  const filteredWorkers = useMemo(() => {
    if (!searchWorker) return workers;
    const q = searchWorker.toLowerCase();
    return workers.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.phone.includes(q) ||
        w.roles.some((r) => r.toLowerCase().includes(q))
    );
  }, [workers, searchWorker]);

  const activeWorkersCount = useMemo(
    () => workers.filter((w) => w.active).length,
    [workers]
  );

  const workersForOffer = useMemo(() => {
    if (!offerLineRole) return [];
    return workers.filter(
      (w) => w.active && w.roles.includes(offerLineRole)
    );
  }, [workers, offerLineRole]);

  /* ───────────────────────────────────────────────────────────────── */
  /*  Worker actions                                                   */
  /* ───────────────────────────────────────────────────────────────── */

  const resetWorkerForm = () => {
    setWorkerForm({ name: '', phone: '', roles: [], uniform: '', active: true });
    setWorkerFormError('');
    setEditingWorkerId(null);
    setShowWorkerForm(false);
  };

  const startEditWorker = (w: Worker) => {
    setEditingWorkerId(w.id);
    setWorkerForm({ name: w.name, phone: w.phone, roles: w.roles, uniform: w.uniform, active: w.active });
    setShowWorkerForm(true);
    setWorkerFormError('');
  };

  const toggleWorkerRole = (role: string) => {
    setWorkerForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  };

  const saveWorker = async () => {
    if (!workerForm.name.trim()) { setWorkerFormError('El nombre es obligatorio'); return; }
    if (workerForm.roles.length === 0) { setWorkerFormError('Selecciona al menos un rol'); return; }
    setSavingWorker(true);
    try {
      const method = editingWorkerId ? 'PUT' : 'POST';
      const url = editingWorkerId ? `/api/workers?id=${editingWorkerId}` : '/api/workers';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workerForm),
      });
      if (res.ok) {
        resetWorkerForm();
        await loadWorkers();
      }
    } catch { /* ignore */ }
    finally { setSavingWorker(false); }
  };

  const deleteWorker = async (id: string) => {
    if (!confirm('¿Eliminar este trabajador?')) return;
    try {
      const res = await fetch(`/api/workers?id=${id}`, { method: 'DELETE' });
      if (res.ok) await loadWorkers();
    } catch { /* ignore */ }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Line actions                                                     */
  /* ───────────────────────────────────────────────────────────────── */

  const resetLineForm = () => {
    setLineForm({ role: '', slots_needed: '1', start_time: '', end_time: '', location: '', attire: '', status: 'open' });
    setEditingLineId(null);
    setShowLineForm(false);
  };

  const startEditLine = (line: StaffingLine) => {
    setEditingLineId(line.id);
    setLineForm({
      role: line.role,
      slots_needed: String(line.slots_needed),
      start_time: line.start_time || '',
      end_time: line.end_time || '',
      location: line.location || '',
      attire: line.attire || '',
      status: line.status,
    });
    setShowLineForm(true);
  };

  const saveLine = async () => {
    if (!lineForm.role.trim() || !selectedEvent) return;
    setSavingLine(true);
    try {
      const method = editingLineId ? 'PUT' : 'POST';
      const url = editingLineId ? `/api/staffing/lines?id=${editingLineId}` : '/api/staffing/lines';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...lineForm, event_id: selectedEvent, slots_needed: parseInt(lineForm.slots_needed) || 1 }),
      });
      if (res.ok) {
        resetLineForm();
        await loadStaffingLines(selectedEvent);
      }
    } catch { /* ignore */ }
    finally { setSavingLine(false); }
  };

  const deleteLine = async (id: string) => {
    if (!confirm('¿Eliminar esta línea de staffing?')) return;
    try {
      const res = await fetch(`/api/staffing/lines?id=${id}`, { method: 'DELETE' });
      if (res.ok && selectedEvent) await loadStaffingLines(selectedEvent);
    } catch { /* ignore */ }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Offer actions                                                    */
  /* ───────────────────────────────────────────────────────────────── */

  const openOfferModal = (lineId: string, role: string) => {
    setOfferLineId(lineId);
    setOfferLineRole(role);
    setOfferSelectedWorkers(new Set());
  };

  const closeOfferModal = () => {
    setOfferLineId(null);
    setOfferLineRole('');
    setOfferSelectedWorkers(new Set());
  };

  const toggleOfferWorker = (workerId: string) => {
    setOfferSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(workerId)) next.delete(workerId);
      else next.add(workerId);
      return next;
    });
  };

  const sendOffers = async () => {
    if (!offerLineId || offerSelectedWorkers.size === 0) return;
    setSendingOffers(true);
    try {
      const res = await fetch('/api/staffing/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_id: offerLineId,
          worker_ids: Array.from(offerSelectedWorkers),
        }),
      });
      if (res.ok) {
        closeOfferModal();
        if (selectedEvent) await loadStaffingLines(selectedEvent);
      }
    } catch { /* ignore */ }
    finally { setSendingOffers(false); }
  };

  /* ───────────────────────────────────────────────────────────────── */
  /*  Shared styles                                                    */
  /* ───────────────────────────────────────────────────────────────── */

  const selectCls =
    'px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all';

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2
            className="text-xl font-semibold text-[#1A1A1A]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Personal & Staffing
          </h2>
          <p className="text-sm text-[#6B7280] mt-1">
            Gestión de trabajadores y asignación a eventos
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F8F3E6] rounded-xl p-1 border border-[#ECECF1]">
        {([
          { key: 'workers' as Tab, label: 'Trabajadores', icon: 'user' },
          { key: 'event_staffing' as Tab, label: 'Staffing por Evento', icon: 'calendar' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#ECECF1]'
                : 'text-[#6B7280] hover:text-[#1A1A1A] hover:bg-white/50'
            }`}
          >
            <Icon name={tab.icon} className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============================================================= */}
      {/*  WORKERS TAB                                                   */}
      {/* ============================================================= */}
      {activeTab === 'workers' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="user" className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Trabajadores</h3>
            <span className="text-xs text-[#9CA3AF] ml-auto">
              {filteredWorkers.length} trabajador{filteredWorkers.length !== 1 ? 'es' : ''}
              {activeWorkersCount > 0 && <span className="ml-1 text-[#16A34A]">· {activeWorkersCount} activos</span>}
            </span>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A8B0]" />
              <input
                type="text"
                placeholder="Buscar por nombre, teléfono o rol..."
                value={searchWorker}
                onChange={(e) => setSearchWorker(e.target.value)}
                className="pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all w-full"
              />
            </div>
            <button
              onClick={() => { resetWorkerForm(); setShowWorkerForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              <Icon name="plus" className="w-4 h-4" />
              Nuevo trabajador
            </button>
          </div>

          {/* Inline worker form */}
          {showWorkerForm && (
            <div className="bg-white rounded-2xl border border-[#C9A84C]/30 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1A1A1A]">
                  {editingWorkerId ? 'Editar trabajador' : 'Nuevo trabajador'}
                </h4>
                <button onClick={resetWorkerForm} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] transition-colors">
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              {workerFormError && (
                <div className="text-xs text-[#DC2626] bg-[#FEF3F3] rounded-lg px-3 py-2">{workerFormError}</div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={workerForm.name}
                    onChange={(e) => setWorkerForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="Nombre completo"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="600 000 000"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Uniforme</label>
                  <input
                    type="text"
                    value={workerForm.uniform}
                    onChange={(e) => setWorkerForm((f) => ({ ...f, uniform: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="Ej: Camisa blanca"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-2">Roles *</label>
                <div className="flex flex-wrap gap-2">
                  {ROLE_OPTIONS.map((role) => (
                    <button
                      key={role}
                      onClick={() => toggleWorkerRole(role)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        workerForm.roles.includes(role)
                          ? 'text-white shadow-sm'
                          : 'bg-[#F5F5F8] text-[#6B7280] hover:bg-[#ECECF1]'
                      }`}
                      style={workerForm.roles.includes(role) ? { background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' } : undefined}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={workerForm.active}
                    onChange={(e) => setWorkerForm((f) => ({ ...f, active: e.target.checked }))}
                    className="w-4 h-4 rounded border-[#E5E5EC] text-[#C9A84C] focus:ring-[#C9A84C]"
                  />
                  <span className="text-sm text-[#6B7280]">Activo</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveWorker}
                  disabled={savingWorker}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  {savingWorker ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
                  {editingWorkerId ? 'Actualizar' : 'Crear'}
                </button>
                <button onClick={resetWorkerForm} className="px-4 py-2 rounded-xl text-sm font-medium text-[#6B7280] bg-[#F5F5F8] hover:bg-[#ECECF1] transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Workers table */}
          <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="max-h-[calc(100vh-420px)] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[#FAFAFC] z-10">
                  <tr className="border-b border-[#ECECF1]">
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Nombre</th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Teléfono</th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Roles</th>
                    <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Uniforme</th>
                    <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Estado</th>
                    <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkers.map((w) => {
                    const st = statusBadge(w.active ? 'active' : 'inactive');
                    return (
                      <tr key={w.id} className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors">
                        <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium max-w-[200px] truncate" title={w.name}>
                          {w.name}
                        </td>
                        <td className="px-4 py-2.5 text-[#6B7280] text-[13px]">
                          {w.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Icon name="phone" className="w-3 h-3 text-[#C9A84C]" />
                              {w.phone}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {w.roles.map((r) => (
                              <span key={r} className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FBF6E9] text-[#A88A3A]">
                                {r}
                              </span>
                            ))}
                            {w.roles.length === 0 && <span className="text-[#A8A8B0] text-[12px]">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-[#6B7280] text-[13px] max-w-[160px] truncate" title={w.uniform}>
                          {w.uniform || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.color}`}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEditWorker(w)}
                              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors"
                              title="Editar"
                            >
                              <Icon name="edit" className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteWorker(w.id)}
                              className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors"
                              title="Eliminar"
                            >
                              <Icon name="trash" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {loadingWorkers && (
              <div className="text-center py-12 text-[#9CA3AF]">
                <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
                Cargando trabajadores...
              </div>
            )}
            {!loadingWorkers && filteredWorkers.length === 0 && (
              <div className="text-center py-12 text-[#9CA3AF]">
                <Icon name="user" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                {searchWorker ? 'No se encontraron trabajadores' : 'No hay trabajadores registrados'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  EVENT STAFFING TAB                                            */}
      {/* ============================================================= */}
      {activeTab === 'event_staffing' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="calendar" className="w-4 h-4 text-[#C9A84C]" />
            <h3 className="text-sm font-semibold text-[#1A1A1A]">Staffing por Evento</h3>
          </div>

          {/* Event selector */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedEvent}
              onChange={(e) => setSelectedEvent(e.target.value)}
              className={`${selectCls} sm:w-96`}
            >
              <option value="">Seleccionar evento...</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.client_name} — {formatDate(ev.event_date)}
                </option>
              ))}
            </select>

            {selectedEvent && (
              <button
                onClick={() => { resetLineForm(); setShowLineForm(true); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:shadow-md"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
              >
                <Icon name="plus" className="w-4 h-4" />
                Nueva línea
              </button>
            )}
          </div>

          {/* Inline line form */}
          {showLineForm && selectedEvent && (
            <div className="bg-white rounded-2xl border border-[#C9A84C]/30 p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[#1A1A1A]">
                  {editingLineId ? 'Editar línea' : 'Nueva línea de staffing'}
                </h4>
                <button onClick={resetLineForm} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] transition-colors">
                  <Icon name="close" className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Rol *</label>
                  <select
                    value={lineForm.role}
                    onChange={(e) => setLineForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  >
                    <option value="">Seleccionar rol...</option>
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Plazas</label>
                  <input
                    type="number"
                    min="1"
                    value={lineForm.slots_needed}
                    onChange={(e) => setLineForm((f) => ({ ...f, slots_needed: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Inicio</label>
                  <input
                    type="time"
                    value={lineForm.start_time}
                    onChange={(e) => setLineForm((f) => ({ ...f, start_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Fin</label>
                  <input
                    type="time"
                    value={lineForm.end_time}
                    onChange={(e) => setLineForm((f) => ({ ...f, end_time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Lugar</label>
                  <input
                    type="text"
                    value={lineForm.location}
                    onChange={(e) => setLineForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="Ej: Sala principal"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Vestimenta</label>
                  <input
                    type="text"
                    value={lineForm.attire}
                    onChange={(e) => setLineForm((f) => ({ ...f, attire: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                    placeholder="Ej: Traje negro"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wider mb-1">Estado</label>
                  <select
                    value={lineForm.status}
                    onChange={(e) => setLineForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:outline-none"
                  >
                    <option value="open">Abierto</option>
                    <option value="draft">Borrador</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveLine}
                  disabled={savingLine || !lineForm.role}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  {savingLine ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="check" className="w-4 h-4" />}
                  {editingLineId ? 'Actualizar' : 'Crear'}
                </button>
                <button onClick={resetLineForm} className="px-4 py-2 rounded-xl text-sm font-medium text-[#6B7280] bg-[#F5F5F8] hover:bg-[#ECECF1] transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Staffing lines table */}
          {selectedEvent && (
            <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="max-h-[calc(100vh-460px)] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#FAFAFC] z-10">
                    <tr className="border-b border-[#ECECF1]">
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Rol</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Plazas</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Horario</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Lugar</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Vestimenta</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Estado</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffingLines.map((line) => {
                      const st = statusBadge(line.status);
                      const isExpanded = expandedLineId === line.id;
                      const filled = line.assigned_count >= line.slots_needed;

                      return (
                        <>
                          <tr
                            key={line.id}
                            className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors cursor-pointer"
                            onClick={() => setExpandedLineId(isExpanded ? null : line.id)}
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <Icon name="chevronDown" className={`w-3 h-3 text-[#9CA3AF] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                <span className="text-[#1A1A1A] text-[13px] font-medium">{line.role}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-[13px] font-medium ${filled ? 'text-[#16A34A]' : 'text-[#6B7280]'}`}>
                                {line.assigned_count}/{line.slots_needed}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[#6B7280] text-[13px]">
                              {formatTime(line.start_time)} — {formatTime(line.end_time)}
                            </td>
                            <td className="px-4 py-2.5 text-[#6B7280] text-[13px] max-w-[140px] truncate" title={line.location}>
                              {line.location || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-[#6B7280] text-[13px] max-w-[140px] truncate" title={line.attire}>
                              {line.attire || '—'}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${st.bg} ${st.color}`}>
                                {st.label}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={() => openOfferModal(line.id, line.role)}
                                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition-colors"
                                  title="Difundir oferta"
                                >
                                  <Icon name="send" className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => startEditLine(line)}
                                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors"
                                  title="Editar"
                                >
                                  <Icon name="edit" className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => deleteLine(line.id)}
                                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors"
                                  title="Eliminar"
                                >
                                  <Icon name="trash" className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr key={`${line.id}-detail`}>
                              <td colSpan={7} className="px-4 py-3 bg-[#FAFAFE] border-b border-[#ECECF1]">
                                <div className="pl-6 space-y-3">
                                  {/* Assigned workers */}
                                  {line.assignments && line.assignments.length > 0 && (
                                    <div>
                                      <h5 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                                        Trabajadores asignados
                                      </h5>
                                      <div className="flex flex-wrap gap-2">
                                        {line.assignments
                                          .sort((a, b) => a.position - b.position)
                                          .map((a) => (
                                            <span
                                              key={a.id}
                                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#ECECF1] text-[12px]"
                                            >
                                              <span className="text-[#C9A84C] font-semibold">#{a.position}</span>
                                              <span className="text-[#1A1A1A] font-medium">{a.worker_name}</span>
                                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusBadge(a.status).bg} ${statusBadge(a.status).color}`}>
                                                {statusBadge(a.status).label}
                                              </span>
                                            </span>
                                          ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Pending offers */}
                                  {line.offers && line.offers.length > 0 && (
                                    <div>
                                      <h5 className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                                        Ofertas pendientes
                                      </h5>
                                      <div className="flex flex-wrap gap-2">
                                        {line.offers.map((o) => (
                                          <span
                                            key={o.id}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#ECECF1] text-[12px]"
                                          >
                                            <span className="text-[#1A1A1A]">{o.worker_name}</span>
                                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${statusBadge(o.status).bg} ${statusBadge(o.status).color}`}>
                                              {statusBadge(o.status).label}
                                            </span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Empty state */}
                                  {(!line.assignments || line.assignments.length === 0) &&
                                    (!line.offers || line.offers.length === 0) && (
                                    <p className="text-xs text-[#9CA3AF] pl-2">
                                      Sin trabajadores asignados ni ofertas pendientes
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {loadingLines && (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando líneas de staffing...
                </div>
              )}
              {!loadingLines && staffingLines.length === 0 && (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <Icon name="clipboardList" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No hay líneas de staffing para este evento
                </div>
              )}
              {staffingLines.length > 0 && (
                <div className="px-4 py-2 border-t border-[#F2F2F5] text-xs text-[#9CA3AF] text-right">
                  {staffingLines.length} línea{staffingLines.length !== 1 ? 's' : ''} ·{' '}
                  {staffingLines.filter((l) => l.assigned_count >= l.slots_needed).length} completa{staffingLines.filter((l) => l.assigned_count >= l.slots_needed).length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          )}

          {!selectedEvent && (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-12 text-center text-[#9CA3AF]">
              <Icon name="calendar" className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Selecciona un evento para ver y gestionar su staffing</p>
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/*  OFFER MODAL                                                   */}
      {/* ============================================================= */}
      {offerLineId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={closeOfferModal}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl border border-[#ECECF1] shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#ECECF1] flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Difundir oferta
                </h3>
                <p className="text-xs text-[#9CA3AF] mt-0.5">Rol: {offerLineRole} · Selecciona trabajadores para enviar la oferta</p>
              </div>
              <button onClick={closeOfferModal} className="p-2 rounded-lg text-[#6B7280] hover:bg-[#F5F5F8] transition-colors">
                <Icon name="close" className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto px-6 py-4 space-y-2">
              {workersForOffer.length === 0 ? (
                <div className="text-center py-8 text-[#9CA3AF]">
                  <Icon name="user" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay trabajadores activos con el rol &ldquo;{offerLineRole}&rdquo;</p>
                </div>
              ) : (
                workersForOffer.map((w) => (
                  <label
                    key={w.id}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all ${
                      offerSelectedWorkers.has(w.id)
                        ? 'border-[#C9A84C] bg-[#FBF6E9]'
                        : 'border-[#ECECF1] hover:border-[#D0D0D8] hover:bg-[#FAFCFE]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={offerSelectedWorkers.has(w.id)}
                      onChange={() => toggleOfferWorker(w.id)}
                      className="w-4 h-4 rounded border-[#E5E5EC] text-[#C9A84C] focus:ring-[#C9A84C]"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-[#1A1A1A]">{w.name}</span>
                      {w.phone && (
                        <span className="text-xs text-[#9CA3AF] ml-2">{w.phone}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {w.roles.slice(0, 3).map((r) => (
                        <span key={r} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#F5F5F8] text-[#6B7280]">
                          {r}
                        </span>
                      ))}
                    </div>
                  </label>
                ))
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#F2F2F5] flex items-center justify-between">
              <span className="text-xs text-[#9CA3AF]">
                {offerSelectedWorkers.size} seleccionado{offerSelectedWorkers.size !== 1 ? 's' : ''}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={closeOfferModal}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-[#6B7280] bg-[#F5F5F8] hover:bg-[#ECECF1] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={sendOffers}
                  disabled={sendingOffers || offerSelectedWorkers.size === 0}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  {sendingOffers ? <Icon name="spinner" className="w-4 h-4 animate-spin" /> : <Icon name="send" className="w-4 h-4" />}
                  Enviar oferta{offerSelectedWorkers.size > 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
