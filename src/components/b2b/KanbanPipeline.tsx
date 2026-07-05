'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BudgetEditor from './BudgetEditor';
import { toPhase } from '@/lib/quoteWorkflow';

type EventStatus = 'draft' | 'sent' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled' | 'lost' | 'reopened';

interface KanbanEvent {
  id: string;
  client_name: string;
  client_email: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  event_date: string;
  status: EventStatus;
  selected_items: Array<{ name: string; category: string; quantity: number }>;
  bar_hours: number;
  notes: string | null;
  created_at: string;
  total_pvp: number | string;
  total_cost: number | string;
  total_display?: number | string;
  total_paid: number;
  pending_payments: number;
  total_payments: number;
}

// Workflow único de 4 fases visibles + descartados (FR-A01). El `status` de cada
// columna es su estado técnico representativo (usado por los botones de acción);
// los eventos se agrupan por FASE (toPhase), consolidando completed/paid→Realizado
// y cancelled/lost/reopened/rejected→Descartados.
const COLUMNS: { status: EventStatus; label: string; dot: string; tint: string; soft: string }[] = [
  { status: 'draft', label: 'Borrador', dot: '#3B82F6', tint: '#EFF4FF', soft: '#DCE7FF' },
  { status: 'sent', label: '1º contacto', dot: '#D9920B', tint: '#FFF8EC', soft: '#FBE8C4' },
  { status: 'accepted', label: 'Aceptado', dot: '#16A34A', tint: '#EFFAF2', soft: '#CDEBD6' },
  { status: 'completed', label: 'Realizado', dot: '#7C3AED', tint: '#F3F0FF', soft: '#DDD6FE' },
  { status: 'cancelled', label: 'Descartados', dot: '#DC2626', tint: '#FEF3F3', soft: '#F6D6D6' },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro',
};

const DEMO_EVENTS: KanbanEvent[] = [];

function formatDate(d: string) {
  if (!d) return '';
  const iso = d.slice(0, 10);
  const [y, m, day] = iso.split('-');
  if (!y || !m || !day) return iso;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}

const money = (n: number | string) => {
  const num = Number(n) || 0;
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
};

/* ---------- SendBudgetModal ---------- */
function SendBudgetModal({
  event,
  onClose,
  onSent,
}: {
  event: KanbanEvent;
  onClose: () => void;
  onSent: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setSending(true);
    setError('');
    try {
      // 1. Send email
      const emailRes = await fetch(`/api/send-budget/${event.id}`, {
        method: 'POST',
      });
      const emailData = await emailRes.json();
      if (!emailData.success) {
        setError(emailData.error || 'Error al enviar el email');
        return;
      }
      // 2. Change status to sent
      const statusRes = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      });
      const statusData = await statusRes.json();
      if (!statusData.success) {
        setError(statusData.error || 'Error al actualizar estado');
        return;
      }
      setSent(true);
      onSent();
      setTimeout(() => onClose(), 1500);
    } catch (e: any) {
      setError(e.message || 'Error de red');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="font-heading text-lg text-ink">
            Enviar presupuesto
          </h2>
          <p className="text-[12px] text-ink-soft mt-0.5">{event.client_name}</p>
        </div>

        {/* Email preview */}
        <div className="px-6 py-4">
          <div className="bg-cream rounded-xl border border-cream-dark p-4 text-[13px] space-y-2">
            <p className="font-medium text-ink">
              Hola {event.client_name.split(' ')[0]},
            </p>
            <p className="text-ink-soft leading-relaxed">
              Te adjuntamos el presupuesto para tu{' '}
              <span className="font-medium text-ink">{EVENT_TYPE_LABELS[event.event_type] || event.event_type}</span>{' '}
              del <span className="font-medium text-ink">{formatDate(event.event_date)}</span>.
            </p>
            <div className="bg-white rounded-lg border border-cream-dark p-3 text-[12px] space-y-1">
              <div className="flex justify-between">
                <span className="text-ink-soft-60">Comensales</span>
                <span className="font-medium text-ink">{event.guest_count} adultos{event.kids_count > 0 ? ` + ${event.kids_count} niños` : ''}</span>
              </div>
              {event.bar_hours > 0 && (
                <div className="flex justify-between">
                  <span className="text-ink-soft-60">Barra</span>
                  <span className="font-medium text-ink">{event.bar_hours}h</span>
                </div>
              )}
              <div className="flex justify-between pt-1 border-t border-cream-dark">
                <span className="text-ink-soft-60">Total estimado</span>
                <span className="font-bold text-ink">{money(event.total_display || event.total_pvp)}</span>
              </div>
            </div>
            <p className="text-ink-soft text-[11px] italic">
              * Este presupuesto se enviará por correo electrónico a{' '}
              <span className="font-medium not-italic text-ink">{event.client_email}</span>
            </p>
            {error && (
              <div className="text-[12px] text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</div>
            )}
            {sent && (
              <div className="text-[12px] text-success bg-success/10 rounded-lg px-3 py-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 13l4 4L19 7" />
                </svg>
                Presupuesto enviado correctamente
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            onClick={onClose}
            disabled={sending}
            className="flex-1 text-[13px] font-medium border border-cream-dark text-ink-soft py-2.5 rounded-xl hover:bg-cream disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || sent}
            className="flex-1 text-[13px] font-medium text-white py-2.5 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            style={{ background: sending || sent ? '#9CA3AF' : 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Enviando…
              </>
            ) : sent ? (
              '✓ Enviado'
            ) : (
              'Enviar presupuesto'
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- CancelModal ---------- */
/* F3.2: toda cancelación desde el Kanban exige motivo y va por la
   transición gobernada INV-1 (sent → lost) — antes moveEvent() ponía
   status='cancelled' directo, sin motivo ni auditoría. */
function CancelModal({
  event,
  onClose,
  onCancelled,
}: {
  event: KanbanEvent;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleCancel = async () => {
    if (!motivo.trim()) { setError('El motivo es obligatorio.'); return; }
    setSending(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${event.id}/transitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transition: 'INV-1', motivo: motivo.trim() }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Error al cancelar');
        return;
      }
      onCancelled();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Error de red');
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-lg text-ink mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Cancelar presupuesto
        </h3>
        <p className="text-xs text-ink-soft-60 mb-3">{event.client_name}</p>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo de la cancelación…"
          rows={3}
          className="w-full text-sm border border-cream-dark rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-danger/20"
        />
        {error && <p className="text-xs text-danger mt-2">{error}</p>}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={sending}
            className="flex-1 text-[13px] font-medium border border-cream-dark text-ink-soft py-2.5 rounded-xl hover:bg-cream disabled:opacity-50">
            Volver
          </button>
          <button onClick={handleCancel} disabled={sending || !motivo.trim()}
            className="flex-1 text-[13px] font-medium bg-danger text-white py-2.5 rounded-xl hover:bg-danger/90 disabled:opacity-50">
            {sending ? 'Cancelando…' : 'Confirmar'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- PaymentModal ---------- */
function PaymentModal({
  event,
  type,
  onClose,
  onPaid,
}: {
  event: KanbanEvent;
  type: 'parcial' | 'total';
  onClose: () => void;
  onPaid: () => void;
}) {
  const [amount, setAmount] = useState(type === 'total' ? String(Number(event.total_display || event.total_pvp)) : '');
  const [method, setMethod] = useState('transferencia');
  const [concept, setConcept] = useState(type === 'parcial' ? 'Señal' : 'Saldo');
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [pError, setPError] = useState('');

  const total = Number(event.total_display || event.total_pvp);

  const handlePay = async () => {
    if (!amount || Number(amount) <= 0) {
      setPError('Introduce un importe válido');
      return;
    }
    setProcessing(true);
    setPError('');
    try {
      // Create a new payment record
      const createRes = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          concept,
          amount: Number(amount),
          method,
          paid: true,
          paid_date: new Date().toISOString().slice(0, 10),
        }),
      });
      const createData = await createRes.json();
      if (!createData.success) {
        setPError(createData.error || 'Error al registrar pago');
        return;
      }
      // Mark it paid via PATCH
      await fetch(`/api/payments/${createData.data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true, method, paid_date: new Date().toISOString().slice(0, 10) }),
      });
      setDone(true);
      onPaid();
      setTimeout(() => onClose(), 1500);
    } catch (e: any) {
      setPError(e.message || 'Error de red');
    } finally {
      setProcessing(false);
    }
  };

  const suggestedAmounts = [25, 50, 75].map((pct) => Math.round(total * (pct / 100)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-2">
          <h2 className="font-heading text-lg text-ink">
            {type === 'total' ? 'Cobro total' : 'Cobro parcial'}
          </h2>
          <p className="text-[12px] text-ink-soft mt-0.5">
            {event.client_name} · Total: {money(total)}
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Concept */}
          <div>
            <label className="block text-[12px] font-medium text-ink-soft mb-1">Concepto</label>
            <input
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className="w-full text-[13px] border border-cream-dark rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
              placeholder="Ej: Señal, Saldo..."
              disabled={processing || done}
            />
          </div>

          {/* Amount */}
          <div>
            <label className="block text-[12px] font-medium text-ink-soft mb-1">Importe</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-soft-60">€</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full text-[13px] border border-cream-dark rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold"
                placeholder="0"
                min={0}
                step={0.01}
                disabled={processing || done}
              />
            </div>
            {type === 'parcial' && (
              <div className="flex gap-1.5 mt-2">
                {suggestedAmounts.map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setAmount(String(amt))}
                    className="flex-1 text-[10px] font-medium bg-cream text-ink-soft hover:bg-cream-dark py-1.5 rounded-lg transition-colors"
                    disabled={processing || done}
                  >
                    {money(amt)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Method */}
          <div>
            <label className="block text-[12px] font-medium text-ink-soft mb-1">Método de pago</label>
            <div className="flex gap-2">
              {[
                { value: 'transferencia', label: 'Transferencia' },
                { value: 'efectivo', label: 'Efectivo' },
                { value: 'tarjeta', label: 'Tarjeta' },
                { value: 'bizum', label: 'Bizum' },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`flex-1 text-[11px] font-medium py-2 rounded-lg border transition-colors ${
                    method === m.value
                      ? 'bg-ink text-white border-ink'
                      : 'bg-white text-ink-soft border-cream-dark hover:bg-cream'
                  }`}
                  disabled={processing || done}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {pError && (
            <div className="text-[12px] text-danger bg-danger/10 rounded-lg px-3 py-2">{pError}</div>
          )}
          {done && (
            <div className="text-[12px] text-success bg-success/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M5 13l4 4L19 7" />
              </svg>
              Pago registrado correctamente
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 flex gap-3">
          <button
            onClick={onClose}
            disabled={processing}
            className="flex-1 text-[13px] font-medium border border-cream-dark text-ink-soft py-2.5 rounded-xl hover:bg-cream disabled:opacity-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handlePay}
            disabled={processing || done || !amount}
            className="flex-1 text-[13px] font-medium text-white py-2.5 rounded-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            style={{ background: processing || done ? '#9CA3AF' : '#1A1A2E' }}
          >
            {processing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Registrando…
              </>
            ) : done ? (
              '✓ Cobrado'
            ) : (
              `Cobrar ${money(Number(amount) || 0)}`
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------- Main KanbanPipeline ---------- */
export default function KanbanPipeline() {
  const [events, setEvents] = useState<KanbanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Modal states
  const [sendBudgetEventId, setSendBudgetEventId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<{ eventId: string; type: 'parcial' | 'total' } | null>(null);
  const [cancelModalEventId, setCancelModalEventId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState('');

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?limit=200');
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.data) && data.data.length > 0) {
        setEvents(data.data.map((e: any) => ({ ...e, selected_items: e.selected_items ?? [] })));
        setIsDemo(false);
      } else {
        setEvents([]);
        setIsDemo(false);
      }
    } catch {
      setEvents([]);
      setIsDemo(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadEvents();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadEvents]);

  const editingEvent = editingId ? events.find((e) => e.id === editingId) ?? null : null;

  const handleSaved = () => {
    loadEvents();
  };

  const moveEvent = useCallback(async (eventId: string, toStatus: EventStatus) => {
    // Antes nunca comprobaba res.ok/data.success: un 409 real (conflicto de
    // stock/salón) dejaba la tarjeta en la columna nueva sin avisar de que
    // el cambio no se había guardado.
    const previousStatus = events.find((e) => e.id === eventId)?.status;
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: toStatus } : e)));
    if (!eventId.startsWith('demo-')) {
      try {
        const res = await fetch(`/api/events/${eventId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: toStatus }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          if (previousStatus) {
            setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: previousStatus } : e)));
          }
          setMoveError(data?.error || 'No se pudo mover el evento');
        }
      } catch (e: any) {
        if (previousStatus) {
          setEvents((prev) => prev.map((ev) => (ev.id === eventId ? { ...ev, status: previousStatus } : ev)));
        }
        setMoveError(e?.message || 'Error de red al mover el evento');
      }
    }
  }, [events]);

  // Agrupa por FASE visible (no por estado técnico): 4 columnas + descartados.
  const getEventsByStatus = (status: EventStatus) =>
    events.filter((e) => toPhase(e.status) === toPhase(status));

  const totalGuests = events.filter((e) => e.status !== 'cancelled').reduce((s, e) => s + (e.guest_count || 0), 0);
  const confirmedCount = getEventsByStatus('accepted').length;
  const activeCount = events.filter((e) => e.status !== 'cancelled').length;

  const STATS = [
    { label: 'Presupuestos activos', value: activeCount, accent: '#C9A84C' },
    { label: 'Borradores', value: getEventsByStatus('draft').length, accent: '#3B82F6' },
    { label: 'Aceptados', value: confirmedCount, accent: '#16A34A' },
    { label: 'Comensales (total)', value: totalGuests, accent: '#6B2737' },
  ];

  const sendBudgetEvent = sendBudgetEventId ? events.find((e) => e.id === sendBudgetEventId) ?? null : null;
  const paymentEvent = paymentModal ? events.find((e) => e.id === paymentModal.eventId) ?? null : null;
  const cancelEvent = cancelModalEventId ? events.find((e) => e.id === cancelModalEventId) ?? null : null;

  const isIncompleteDraft = (ev: any) => ev.status === 'draft' && (
    !ev.selected_items?.length || !ev.client_email || !ev.guest_count
  );
  const incompleteReasons = (ev: any) => {
    const r: string[] = [];
    if (!ev.selected_items?.length) r.push('Sin platos');
    if (!ev.client_email) r.push('Sin email');
    if (!ev.guest_count) r.push('Sin comensales');
    return r;
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {moveError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm flex items-center justify-between">
          <span>{moveError}</span>
          <button onClick={() => setMoveError('')} className="text-red-400 hover:text-red-600 ml-3">✕</button>
        </div>
      )}
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-cream-dark p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: s.accent }} />
              <span className="text-[12px] text-ink-soft">{s.label}</span>
            </div>
            <div className="text-2xl font-semibold text-ink tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {!loading && events.length === 0 && (
        <p className="text-xs text-ink-soft-60">No hay presupuestos registrados aún.</p>
      )}
      {loading && <p className="text-xs text-ink-soft-60">Cargando presupuestos…</p>}

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 min-h-0">
        {COLUMNS.map((col) => {
          const colEvents = getEventsByStatus(col.status);
          return (
            <div key={col.status} className="flex-shrink-0 w-[300px] flex flex-col rounded-2xl bg-cream border border-cream-dark h-full">
              {/* Column header */}
              <div className="px-4 py-3 flex items-center justify-between rounded-t-2xl" style={{ background: col.tint }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.dot }} />
                  <span className="text-[13px] font-semibold text-ink">{col.label}</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-ink-soft">
                  {colEvents.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colEvents.length === 0 && (
                  <div className="text-center text-[12px] text-ink-soft-60 py-8">Sin presupuestos</div>
                )}
                {colEvents.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    className={`bg-white rounded-xl p-3.5 border shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)] hover:border-[#E0D3A8] transition-all cursor-pointer group ${isIncompleteDraft(event) ? 'border-orange-300 border-dashed' : 'border-cream-dark'}`}
                    title={isIncompleteDraft(event) ? incompleteReasons(event).join(' · ') : ''}
                    onClick={() => setEditingId(event.id)}
                  >
                    {/* Client */}
                    <div className="flex items-start gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                        {initials(event.client_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13px] font-semibold text-ink leading-tight truncate">{event.client_name}</h4>
                        <p className="text-[11px] text-ink-soft-60 truncate">{event.client_email}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FBF6E9] text-gold-dark whitespace-nowrap">
                        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                      </span>
                      {isIncompleteDraft(event) && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">
                          Incompleto
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft mb-3">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3 text-ink-soft-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        {formatDate(event.event_date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3 text-ink-soft-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        {event.guest_count}{event.kids_count > 0 ? ` +${event.kids_count}` : ''}
                      </span>
                      {event.bar_hours > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3 text-ink-soft-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                          {event.bar_hours}h barra
                        </span>
                      )}
                    </div>

                    {/* Items preview */}
                    {(event.selected_items || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(event.selected_items || []).slice(0, 2).map((item, j) => (
                          <span key={j} className="text-[10px] bg-cream text-ink-soft px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                            {item.name}
                          </span>
                        ))}
                        {(event.selected_items || []).length > 2 && (
                          <span className="text-[10px] text-ink-soft-60 px-1">+{event.selected_items.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Total PVP */}
                    {Number(event.total_pvp) > 0 && (
                      <div className="flex items-center justify-between pt-2 border-t border-[#F2F2F5]">
                        <span className="text-[10px] text-ink-soft">Total</span>
                        <span className="text-[13px] font-bold text-ink">{money(event.total_display || event.total_pvp)}</span>
                      </div>
                    )}

                    {/* === Actions per column === */}
                    <div className="flex flex-wrap gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* --- BORRADOR --- */}
                      {col.status === 'draft' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setSendBudgetEventId(event.id); }}
                          className="flex-1 text-[11px] font-medium bg-[#FBF6E9] text-gold-dark hover:bg-[#F5EAD0] py-1.5 rounded-lg transition-colors"
                        >
                          Enviar presupuesto
                        </button>
                      )}

                      {/* --- ENVIADO --- */}
                      {col.status === 'sent' && (
                        <>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveEvent(event.id, 'accepted'); }}
                            className="flex-1 text-[11px] font-medium bg-success/10 text-success hover:bg-success/20 py-1.5 rounded-lg transition-colors"
                          >
                            Aceptar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSendBudgetEventId(event.id); }}
                            className="text-[11px] font-medium bg-[#FBF6E9] text-gold-dark hover:bg-[#F5EAD0] px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            Reenviar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setCancelModalEventId(event.id); }}
                            className="text-[11px] bg-danger/10 text-danger hover:bg-danger/20 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            Cancelar
                          </button>
                        </>
                      )}

                      {/* --- ACEPTADO ---
                          F3.2: sin botón Cancelar aquí — la cancelación de un
                          evento ya aceptado es excepcional (retiene la señal
                          como penalización) y solo está disponible desde la
                          ficha del evento, gobernada por INV-3 con motivo. */}
                      {col.status === 'accepted' && (() => {
                        const allPaid = Number(event.pending_payments ?? 0) === 0 && Number(event.total_payments ?? 0) > 0;
                        const hasPaid = (event.total_paid ?? 0) > 0;
                        return (
                          <>
                            {!allPaid ? (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPaymentModal({ eventId: event.id, type: 'parcial' }); }}
                                  className="flex-1 text-[11px] font-medium bg-[#FBF6E9] text-gold-dark hover:bg-[#F5EAD0] py-1.5 rounded-lg transition-colors"
                                >
                                  Cobro parcial
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPaymentModal({ eventId: event.id, type: 'total' }); }}
                                  className="flex-1 text-[11px] font-medium bg-success/10 text-success hover:bg-success/20 py-1.5 rounded-lg transition-colors"
                                >
                                  Cobro total
                                </button>
                              </>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-success bg-success/20 px-2.5 py-1 rounded-full">
                                  Pagado completo
                                </span>
                              </div>
                            )}
                          </>
                        );
                      })()}

                      {/* --- Links for accepted events (always visible) --- */}
                      {col.status === 'accepted' && (
                        <div className="w-full flex gap-1.5 mt-1">
                          <a
                            href={`/admin/invitados?event_id=${event.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-center text-[10px] font-medium text-ink-soft bg-cream hover:bg-cream-dark py-1 rounded-lg transition-colors"
                          >
                            Invitados
                          </a>
                          <a
                            href={`/admin/operations?event_id=${event.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 text-center text-[10px] font-medium text-ink-soft bg-cream hover:bg-cream-dark py-1 rounded-lg transition-colors"
                          >
                            Operaciones
                          </a>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <BudgetEditor event={editingEvent} onClose={() => setEditingId(null)} onSaved={handleSaved} />

      {/* Send budget modal */}
      <AnimatePresence>
        {sendBudgetEvent && (
          <SendBudgetModal
            event={sendBudgetEvent}
            onClose={() => setSendBudgetEventId(null)}
            onSent={loadEvents}
          />
        )}
      </AnimatePresence>

      {/* Payment modal */}
      <AnimatePresence>
        {paymentEvent && paymentModal && (
          <PaymentModal
            event={paymentEvent}
            type={paymentModal.type}
            onClose={() => setPaymentModal(null)}
            onPaid={loadEvents}
          />
        )}
      </AnimatePresence>

      {/* Cancel modal (F3.2) */}
      <AnimatePresence>
        {cancelEvent && (
          <CancelModal
            event={cancelEvent}
            onClose={() => setCancelModalEventId(null)}
            onCancelled={loadEvents}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
