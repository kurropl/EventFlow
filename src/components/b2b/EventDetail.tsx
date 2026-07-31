'use client';

/**
 * EventFlow — Ficha del Evento
 * Unified view showing ALL data for a single event.
 * Fetches from: events, quotes, escandallos, staffing, payments APIs.
 */

import { useState, useEffect, useCallback } from 'react';
import StatusBadge from './StatusBadge';
import BriefingCamareros from './BriefingCamareros';
import EventTimeline from './EventTimeline';
import EventClosure from './EventClosure';
import EventMessages from './EventMessages';
import { PageHeader, EmptyState } from '@/components/ui';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CalendarDays,
  Users,
  ClipboardList,
  ShoppingBag,
  Shirt,
  WalletMinimal,
  Calculator,
  Table,
  History,
  Mail,
  Phone,
  Euro,
  Clock,
  Check,
  Package,
  Truck,
  FileText,
  Receipt,
  MapPin,
  MessageCircle,
} from 'lucide-react';

/* ── Helpers ───────────────────────────────────────────────────── */
const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
};

const VENUE_OPTIONS: { value: string; label: string }[] = [
  { value: 'salon-arriba', label: 'Salón de Arriba' },
  { value: 'salon-abajo', label: 'Salón de Abajo' },
  { value: 'externo', label: 'Fuera de los salones (externo)' },
];

/* ── Loading Skeleton ──────────────────────────────────────────── */
function SectionSkeleton() {
  return (
    <div className="bg-cream-dark rounded-xl p-6 space-y-4 animate-pulse">
      <div className="h-5 w-40 bg-gold/20 rounded" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-gold/10 rounded" />
        <div className="h-4 w-3/4 bg-gold/10 rounded" />
        <div className="h-4 w-1/2 bg-gold/10 rounded" />
      </div>
    </div>
  );
}

function FullSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="h-8 w-64 bg-gold/15 rounded-lg animate-pulse" />
      {Array.from({ length: 4 }).map((_, i) => (
        <SectionSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── Section Header ────────────────────────────────────────────── */
function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-5 h-5 text-gold" />
      <h2 className="font-heading text-lg font-semibold text-gold">{title}</h2>
    </div>
  );
}

/* ── Field Row ─────────────────────────────────────────────────── */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-ink-soft-60 font-semibold mb-0.5">{label}</p>
      <p className="text-sm text-ink">{value || '—'}</p>
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────────── */
function EmptyMessage({ text }: { text: string }) {
  return (
    <p className="text-sm text-ink-soft-60 italic">{text}</p>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main Component
   ══════════════════════════════════════════════════════════════════ */
interface EventDetailProps {
  eventId: string;
}

export default function EventDetail({ eventId }: EventDetailProps) {
  const [event, setEvent] = useState<any>(null);
  const [quote, setQuote] = useState<any>(null);
  const [escandalloItems, setEscandalloItems] = useState<any[]>([]);
  const [staffingLines, setStaffingLines] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [contract, setContract] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeEffects, setCloseEffects] = useState<string[] | null>(null);
  const [closeError, setCloseError] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [venueSaving, setVenueSaving] = useState(false);
  const [venueMsg, setVenueMsg] = useState('');
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractMsg, setContractMsg] = useState('');
  const [extraInvoiceAmount, setExtraInvoiceAmount] = useState('');
  const [invoicing, setInvoicing] = useState(false);
  const [invoiceMsg, setInvoiceMsg] = useState('');
  // F4.3: protocolo del evento — completa junto a F0.2 (intolerancias) los 7
  // campos del memo de camareros. La columna y el memo ya existían, faltaba
  // el propio caller (PUT no lo aceptaba y no había campo en la ficha).
  const [protocolNotes, setProtocolNotes] = useState('');
  const [savingProtocol, setSavingProtocol] = useState(false);
  const [protocolMsg, setProtocolMsg] = useState('');
  // F3.2: cancelación excepcional de un evento aceptado — gobernada por
  // INV-3 (transitions/route.ts), exige motivo. Único punto de la app donde
  // se puede cancelar un evento ya aceptado (se eliminó del Kanban).
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelMsg, setCancelMsg] = useState('');

  // F3.4: gastos previos (FR-A06) — backend ya existía, sin ningún caller en la UI.
  const [gastosPrevios, setGastosPrevios] = useState<any[]>([]);
  const [gastosTotal, setGastosTotal] = useState(0);
  const [gastoConcept, setGastoConcept] = useState('');
  const [gastoAmount, setGastoAmount] = useState('');
  const [savingGasto, setSavingGasto] = useState(false);
  const [gastoMsg, setGastoMsg] = useState('');
  // WP-23: Hitos de pago y facturación por hitos
  const [milestones, setMilestones] = useState<any[]>([]);
  const [milestoneMsg, setMilestoneMsg] = useState('');
  const [generatingMilestone, setGeneratingMilestone] = useState<string | null>(null);
  const [generatingFinal, setGeneratingFinal] = useState(false);
  const [finalInvoiceMsg, setFinalInvoiceMsg] = useState('');

  const fetchGastosPrevios = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/gastos-previos`);
      const data = await res.json();
      if (data.success) {
        setGastosPrevios(data.data || []);
        setGastosTotal(Number(data.total) || 0);
      }
    } catch { /* no bloquea el resto de la ficha */ }
  }, [eventId]);

  useEffect(() => { fetchGastosPrevios(); }, [fetchGastosPrevios]);

  const fetchAll = useCallback(async () => {
    try {
      const [eventRes, escRes, staffRes, payRes, quoteRes, contractRes, invRes, milestoneRes] = await Promise.allSettled([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/stock/escandallos?event_id=${eventId}`),
        fetch(`/api/staffing/lines?event_id=${eventId}`),
        fetch(`/api/payments?event_id=${eventId}`),
        fetch(`/api/quotes?event_id=${eventId}`),
        fetch(`/api/events/${eventId}/contract`),
        fetch(`/api/invoices?event_id=${eventId}`),
        fetch(`/api/events/${eventId}/milestones`),
      ]);

      // Event (required)
      if (eventRes.status === 'fulfilled' && eventRes.value.ok) {
        const j = await eventRes.value.json();
        setEvent(j.data || null);
      } else {
        setError('No se pudo cargar el evento');
        setLoading(false);
        return;
      }

      // Escandallo
      if (escRes.status === 'fulfilled' && escRes.value.ok) {
        const j = await escRes.value.json();
        const grouped = j.data || {};
        const items = grouped[eventId]?.items || [];
        setEscandalloItems(items);
      }

      // Staffing
      if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
        const j = await staffRes.value.json();
        setStaffingLines(j.data || []);
      }

      // Payments
      if (payRes.status === 'fulfilled' && payRes.value.ok) {
        const j = await payRes.value.json();
        setPayments(j.data || []);
      }

      // Quotes
      if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
        const j = await quoteRes.value.json();
        const quotes = j.data || [];
        setQuote(quotes.length > 0 ? quotes[0] : null);
      }

      // Contrato (Sprint 3, G8) — puede no existir todavía (404), no es un error
      if (contractRes.status === 'fulfilled' && contractRes.value.ok) {
        const j = await contractRes.value.json();
        setContract(j.data || null);
      } else {
        setContract(null);
      }

      // Facturas (Sprint 4, B5) — puede haber varias (facturación parcial)
      if (invRes.status === 'fulfilled' && invRes.value.ok) {
        const j = await invRes.value.json();
        setInvoices(j.data || []);
      }

      // WP-23: Hitos de pago para facturación por hitos
      if (milestoneRes.status === 'fulfilled' && milestoneRes.value.ok) {
        const j = await milestoneRes.value.json();
        setMilestones(j.data || []);
      }
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (event) setProtocolNotes(event.protocol_notes || '');
  }, [event?.id, event?.protocol_notes]);

  /* ── Loading ──────────────────────────────────────────────────── */
  if (loading) return <FullSkeleton />;

  /* ── Error ────────────────────────────────────────────────────── */
  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <p className="text-sm text-danger mb-2">{error || 'Evento no encontrado'}</p>
        <p className="text-xs text-ink-soft-60">ID: {eventId}</p>
      </div>
    );
  }

  const items: any[] = event.selected_items || [];
  const totalInvoiced = invoices.filter((i) => i.status !== 'cancelled').reduce((s, i) => s + Number(i.subtotal || 0), 0);
  const totalPvp = Number(event.total_pvp || 0);
  const remainingToInvoice = Math.max(0, totalPvp - totalInvoiced);

  const setVenue = async (venue: string) => {
    setVenueSaving(true);
    setVenueMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ venue }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAll();
      } else {
        setVenueMsg(data.error || 'Error al asignar el salón');
      }
    } catch {
      setVenueMsg('Error de conexión');
    }
    setVenueSaving(false);
  };

  const generateContract = async () => {
    setGeneratingContract(true);
    setContractMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}/contract/generate`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setContract(data.data);
      } else {
        setContractMsg(data.error || 'Error al generar el contrato');
      }
    } catch {
      setContractMsg('Error de conexión');
    }
    setGeneratingContract(false);
  };

  const closeEvent = async () => {
    setClosing(true);
    setCloseError('');
    setCloseEffects(null);
    try {
      const amount = invoiceAmount ? Number(invoiceAmount) : undefined;
      const res = await fetch(`/api/events/${event.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(amount !== undefined ? { invoiceAmount: amount } : {}),
      });
      const data = await res.json();
      if (data.success) {
        setCloseEffects(data.data?.results || []);
        fetchAll();
      } else {
        setCloseError(data.error || 'Error al cerrar el evento');
      }
    } catch {
      setCloseError('Error de conexión');
    }
    setClosing(false);
  };

  const invoiceRemainder = async () => {
    if (!extraInvoiceAmount || Number(extraInvoiceAmount) <= 0) return;
    setInvoicing(true);
    setInvoiceMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(extraInvoiceAmount) }),
      });
      const data = await res.json();
      if (data.success) {
        setInvoiceMsg(`✓ Factura ${data.data?.invoice_number || ''} generada` + (data.warning ? ` — ${data.warning}` : ''));
        setExtraInvoiceAmount('');
        fetchAll();
      } else {
        setInvoiceMsg('Error: ' + (data.error || ''));
      }
    } catch {
      setInvoiceMsg('Error de conexión');
    }
    setInvoicing(false);
  };

  // WP-23: Generar factura de anticipo por hito pagado
  const generateAdvanceInvoice = async (milestoneId: string) => {
    setGeneratingMilestone(milestoneId);
    setMilestoneMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}/milestones/${milestoneId}/invoice`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setMilestoneMsg(`✓ ${data.message || 'Factura de anticipo generada'}`);
        fetchAll();
      } else {
        setMilestoneMsg('Error: ' + (data.error || ''));
      }
    } catch {
      setMilestoneMsg('Error de conexión');
    }
    setGeneratingMilestone(null);
  };

  // WP-23: Generar factura final deduciendo anticipos
  const generateFinalInvoice = async () => {
    setGeneratingFinal(true);
    setFinalInvoiceMsg('');
    try {
      const res = await fetch(`/api/events/${event.id}/invoice/final`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        const deducted = data.data?.advances_deducted || 0;
        setFinalInvoiceMsg(
          `✓ ${data.message || 'Factura final generada'}` +
          (deducted > 0 ? ` (anticipos deducidos: ${money(deducted)})` : '')
        );
        fetchAll();
      } else {
        setFinalInvoiceMsg('Error: ' + (data.error || ''));
      }
    } catch {
      setFinalInvoiceMsg('Error de conexión');
    }
    setGeneratingFinal(false);
  };

  // G5 (Sprint 3): huecos de trazabilidad — se separan del resto de efectos
  // del cierre para que se vean como aviso, no como confirmación genérica.
  const closeWarnings = (closeEffects || []).filter((e) => e.startsWith('⚠'));
  const closeConfirmations = (closeEffects || []).filter((e) => !e.startsWith('⚠'));

  /* ════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* ── Page Title ──────────────────────────────────────────── */}
      <PageHeader title="Ficha del Evento" actions={<StatusBadge status={event.status} />} />

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="messages">Mensajes</TabsTrigger>
          <TabsTrigger value="closure">Cierre</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">

      {/* ──────────────────────────────────────────────────────────
         1. DATOS DEL EVENTO
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={CalendarDays} title="Datos del Evento" />
        <div className="bg-cream-dark rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Cliente" value={event.client_name} />
          <Field
            label="Email"
            value={
              event.client_email ? (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-ink-soft-60" />
                  {event.client_email}
                </span>
              ) : null
            }
          />
          <Field
            label="Telefono"
            value={
              event.client_phone ? (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-ink-soft-60" />
                  {event.client_phone}
                </span>
              ) : null
            }
          />
          <Field label="Tipo de evento" value={event.event_type} />
          <Field label="Fecha" value={fmtDate(event.event_date)} />
          <Field
            label="Comensales"
            value={
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 text-ink-soft-60" />
                {event.guest_count || 0}
                {event.kids_count ? ` (+ ${event.kids_count} ninos)` : ''}
              </span>
            }
          />
          <Field
            label="Total PVP"
            value={
              <span className="flex items-center gap-1 font-semibold text-ink">
                <Euro className="w-3 h-3 text-gold" />
                {money(event.total_pvp || event.total_display)}
              </span>
            }
          />
          <Field label="Coste total" value={money(event.total_cost)} />
          <Field
            label="Bar"
            value={event.bar_price ? `${money(event.bar_price)} (${event.bar_hours || '?'}h)` : null}
          />
          {event.linen_type && <Field label="Tela" value={event.linen_type} />}
          {event.centerpiece && <Field label="Centro de mesa" value={event.centerpiece} />}
          {event.notes && (
            <div className="col-span-full">
              <Field label="Notas" value={event.notes} />
            </div>
          )}
          <div className="col-span-full">
            <label className="block text-[11px] uppercase tracking-wider text-ink-soft-60 font-medium mb-1">Protocolo</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                value={protocolNotes}
                onChange={(e) => setProtocolNotes(e.target.value)}
                placeholder="Notas de protocolo para el memo de camareros (orden de ceremonia, tratamiento a invitados VIP…)"
                rows={2}
                className="flex-1 text-sm border border-cream-dark rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-gold/30"
              />
              <button
                onClick={async () => {
                  setSavingProtocol(true);
                  setProtocolMsg('');
                  try {
                    const res = await fetch(`/api/events/${eventId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ protocol_notes: protocolNotes || null }),
                    });
                    const data = await res.json();
                    if (data.success) { setProtocolMsg('✓ Guardado'); fetchAll(); }
                    else setProtocolMsg('Error: ' + (data.error || ''));
                  } catch { setProtocolMsg('Error de conexión'); }
                  setSavingProtocol(false);
                  setTimeout(() => setProtocolMsg(''), 2000);
                }}
                disabled={savingProtocol}
                className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink-light disabled:opacity-50 whitespace-nowrap self-start"
              >
                {savingProtocol ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
            {protocolMsg && <p className="text-xs text-ink-soft-60 mt-1">{protocolMsg}</p>}
          </div>
        </div>

        {/* Selector de salón (G1, Sprint 1/5) */}
        <div className="mt-4 bg-cream-dark rounded-lg p-4">
          <p className="text-[11px] uppercase tracking-wider text-ink-soft-60 font-semibold mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            Salón
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {VENUE_OPTIONS.map((opt) => {
              const isActive = event.venue_id
                ? opt.value !== 'externo' && event.venue_slug === opt.value
                : opt.value === 'externo';
              return (
                <button
                  key={opt.value}
                  onClick={() => setVenue(opt.value)}
                  disabled={venueSaving}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 ${
                    isActive
                      ? 'bg-gold text-ink border-gold'
                      : 'bg-white text-ink-soft border-cream-dark hover:border-gold'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {venueMsg && <p className="text-xs text-danger mt-2">{venueMsg}</p>}
        </div>

        {/* Selected items mini-table */}
        {items.length > 0 && (
          <div className="mt-4 bg-cream-dark rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-wider text-ink-soft-60 font-semibold mb-2">
              Items seleccionados ({items.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold/20">
                    <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Nombre</th>
                    <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Categoria</th>
                    <th className="text-right py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-gold/10 last:border-0">
                      <td className="py-1.5 text-ink">{item.name}</td>
                      <td className="py-1.5 text-ink-soft-60">{item.category || '—'}</td>
                      <td className="py-1.5 text-right text-ink">{item.quantity || 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
         2. PRESUPUESTO
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={ClipboardList} title="Presupuesto" />
        {quote ? (
          <div className="bg-cream-dark rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Field label="Estado" value={<StatusBadge status={quote.status} />} />
            <Field label="PVP base" value={money(quote.base_pvp)} />
            <Field label="Coste base" value={money(quote.base_cost)} />
            <Field label="Bar" value={money(quote.bar_price)} />
            <Field label="PVP total" value={money(quote.total_pvp)} />
            <Field label="Coste total" value={money(quote.total_cost)} />
            <Field label="IVA" value={quote.iva_pct ? `${quote.iva_pct}%` : null} />
            <Field label="Margen" value={quote.margin_pct ? `${quote.margin_pct}%` : null} />
            {quote.valid_until && <Field label="Valido hasta" value={fmtDate(quote.valid_until)} />}
            {quote.accepted_at && <Field label="Aceptado" value={fmtDate(quote.accepted_at)} />}
          </div>
        ) : (
          <EmptyMessage text="Sin datos" />
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
         3. SEÑAL Y CONFIRMACIÓN
         ────────────────────────────────────────────────────────── */}
      {(quote || event.status === 'sent' || event.status === 'draft' || event.status === 'accepted') && (
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={WalletMinimal} title="Señal y Confirmación" />
        <div className="bg-cream-dark rounded-lg p-4 space-y-4">
          {/* Estado actual */}
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              event.status === 'accepted'
                ? 'bg-success/10 text-success'
                : quote?.deposit_paid === true
                  ? 'bg-success/10 text-success'
                  : event.status === 'completed' || event.status === 'paid'
                    ? 'bg-ink/10 text-ink'
                    : 'bg-warning/10 text-warning'
            }`}>
              {event.status === 'accepted' ? '✓ Confirmado'
                : event.status === 'completed' ? 'Completado'
                : event.status === 'paid' ? 'Pagado'
                : quote?.deposit_paid ? 'Señal pagada — pendiente de confirmar'
                : 'Pendiente de señal'}
            </div>
            {quote && (
              <span className="text-xs text-ink-soft-60">
                Señal: {money(quote.deposit_amount || (Number(quote.total_pvp || 0) * Number(quote.deposit_pct || 40) / 100))}
                ({quote.deposit_pct || 40}%)
              </span>
            )}
          </div>

          {/* If not yet confirmed and not already accepted/completed */}
          {event.status !== 'accepted' && event.status !== 'completed' && event.status !== 'paid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Signal amount card */}
              <div className="p-4 bg-white rounded-lg border border-cream-dark">
                <p className="text-xs text-ink-soft mb-2">Importe de la señal</p>
                <p className="text-xl font-bold font-mono">
                  {money(quote?.deposit_amount || (Number(event.total_pvp || 0) * Number(quote?.deposit_pct || 40) / 100))}
                </p>
                <p className="text-xs text-ink-soft-60 mt-1">
                  {quote?.deposit_pct || 40}% del total · {money(event.total_pvp || 0)}
                </p>
              </div>

              {/* Confirm button */}
              <div className="p-4 bg-white rounded-lg border border-cream-dark flex flex-col justify-between">
                <button
                  onClick={async () => {
                    setConfirming(true);
                    setConfirmMsg('');
                    try {
                      const res = await fetch(`/api/events/${event.id}/confirm`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ method: 'transferencia' }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setConfirmMsg('✓ Evento confirmado. Enlace de invitados activado.');
                        fetchAll();
                      } else {
                        setConfirmMsg('Error: ' + (data.error || ''));
                      }
                    } catch { setConfirmMsg('Error de conexión'); }
                    setConfirming(false);
                  }}
                  disabled={confirming || quote?.deposit_paid}
                  className="w-full py-2.5 rounded-lg bg-success text-white text-sm font-medium hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming ? 'Confirmando...' : quote?.deposit_paid
                    ? 'Señal ya registrada'
                    : '✓ Registrar señal y confirmar evento'}
                </button>
                {confirmMsg && (
                  <p className={`text-xs mt-2 ${confirmMsg.includes('Error') ? 'text-danger' : 'text-success'}`}>
                    {confirmMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Guest invitation link (show when confirmed) */}
          {(event.status === 'accepted' || event.status === 'completed' || event.status === 'paid') && event.client_token && (
            <div className="p-4 bg-white rounded-lg border border-success/30">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">ACTIVO</span>
                <span className="text-xs text-ink-soft">Enlace para invitados</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-cream border border-cream-dark rounded-lg p-2.5 truncate font-mono text-ink-soft">
                  {`${window.location.origin}/invitados/${event.client_token}`}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invitados/${event.client_token}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-2 rounded-lg bg-ink text-white text-xs font-medium hover:bg-ink-light shrink-0"
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-[10px] text-ink-soft-60 mt-1">Comparte este enlace con el cliente para que rellene los invitados</p>
            </div>
          )}

          {/* F3.2: cancelación excepcional (INV-3) — solo desde la ficha, con motivo obligatorio */}
          {event.status === 'accepted' && (
            <div className="p-4 bg-white rounded-lg border border-danger/20">
              {!showCancelModal ? (
                <button
                  onClick={() => { setShowCancelModal(true); setCancelMsg(''); }}
                  className="text-xs font-medium text-danger hover:underline"
                >
                  Cancelar evento (excepcional)
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-ink-soft">
                    La señal cobrada se retiene como penalización. Requiere motivo.
                  </p>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Motivo de la cancelación…"
                    rows={2}
                    className="w-full text-xs border border-cream-dark rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-danger/20"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowCancelModal(false); setCancelReason(''); }}
                      disabled={cancelling}
                      className="flex-1 text-xs font-medium border border-cream-dark text-ink-soft py-2 rounded-lg hover:bg-cream disabled:opacity-50"
                    >
                      Volver
                    </button>
                    <button
                      onClick={async () => {
                        if (!cancelReason.trim()) { setCancelMsg('El motivo es obligatorio.'); return; }
                        setCancelling(true);
                        setCancelMsg('');
                        try {
                          const res = await fetch(`/api/events/${event.id}/transitions`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ transition: 'INV-3', motivo: cancelReason.trim() }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            setShowCancelModal(false);
                            setCancelReason('');
                            fetchAll();
                          } else {
                            setCancelMsg('Error: ' + (data.error || ''));
                          }
                        } catch {
                          setCancelMsg('Error de conexión');
                        }
                        setCancelling(false);
                      }}
                      disabled={cancelling || !cancelReason.trim()}
                      className="flex-1 text-xs font-medium bg-danger text-white py-2 rounded-lg hover:bg-danger/90 disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelando…' : 'Confirmar cancelación'}
                    </button>
                  </div>
                  {cancelMsg && <p className="text-xs text-danger">{cancelMsg}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ──────────────────────────────────────────────────────────
         4. CONTRATO (Sprint 3, G8)
         ────────────────────────────────────────────────────────── */}
      {event.client_token && (
        <section className="bg-cream border border-gold/20 rounded-xl p-6">
          <SectionHeader icon={FileText} title="Contrato" />
          <div className="bg-cream-dark rounded-lg p-4">
            {contract ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                    contract.status === 'signed' ? 'bg-success/10 text-success'
                      : contract.status === 'voided' ? 'bg-danger/10 text-danger'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    {contract.status === 'signed' ? 'Firmado' : contract.status === 'voided' ? 'Anulado' : 'Pendiente de firma'}
                  </span>
                  {contract.signed_by_name && (
                    <span className="text-xs text-ink-soft">
                      {contract.signed_by_name} · {fmtDate(contract.signed_at)}
                    </span>
                  )}
                </div>
                <a
                  href={`/contrato/${event.client_token}`}
                  target="_blank"
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border border-cream-dark hover:bg-cream transition-colors"
                >
                  Ver contrato
                </a>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-ink-soft-60">Sin contrato generado todavía</p>
                <button
                  onClick={generateContract}
                  disabled={generatingContract}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
                >
                  {generatingContract ? 'Generando...' : 'Generar contrato'}
                </button>
              </div>
            )}
            {contractMsg && <p className="text-xs text-danger mt-2">{contractMsg}</p>}
          </div>
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────
         5. ESCANDALLO
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={ShoppingBag} title="Escandallo" />
        {escandalloItems.length > 0 ? (
          <div className="bg-cream-dark rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Ingrediente</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Proveedor</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Gramos</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Unidades</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Ml</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Completado</th>
                </tr>
              </thead>
              <tbody>
                {escandalloItems.map((item: any) => (
                  <tr key={item.id} className="border-b border-gold/10 last:border-0">
                    <td className="py-1.5 text-ink flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-gold" />
                      {item.ingredient_name}
                    </td>
                    <td className="py-1.5 text-ink-soft-60 flex items-center gap-1">
                      {item.provider_name && <Truck className="w-3 h-3" />}
                      {item.provider_name || '—'}
                    </td>
                    <td className="py-1.5 text-right text-ink">{item.total_grams || '—'}</td>
                    <td className="py-1.5 text-right text-ink">{item.total_units || '—'}</td>
                    <td className="py-1.5 text-right text-ink">{item.total_ml || '—'}</td>
                    <td className="py-1.5 text-center">
                      {item.completed ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success/10 text-success">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cream-dark text-ink-soft-60">
                          <span className="w-1.5 h-1.5 rounded-full bg-ink-soft-60" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyMessage text="Sin datos de escandallo" />
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
         5b. GASTOS PREVIOS (F3.4, FR-A06)
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={WalletMinimal} title="Gastos previos" />
        <div className="bg-cream-dark rounded-lg p-4 space-y-3">
          {gastosPrevios.length > 0 ? (
            <div className="space-y-1.5">
              {gastosPrevios.map((g: any) => (
                <div key={g.id} className="flex items-center justify-between text-sm bg-white rounded-lg px-3 py-2">
                  <span className="text-ink">{String(g.description || '').replace(/^Gasto previo:\s*/, '')}</span>
                  <span className="text-ink-soft-60 font-mono">{money(g.total)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm font-semibold pt-2 border-t border-gold/20">
                <span className="text-ink">Total gastos previos</span>
                <span className="text-ink font-mono">{money(gastosTotal)}</span>
              </div>
            </div>
          ) : (
            <EmptyMessage text="Sin gastos previos registrados (gasolina, desplazamientos, compras puntuales…)" />
          )}
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <input
              value={gastoConcept}
              onChange={(e) => setGastoConcept(e.target.value)}
              placeholder="Concepto (p. ej. Gasolina furgoneta)"
              className="flex-1 text-sm border border-cream-dark rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <input
              type="number" min={0} step={0.01}
              value={gastoAmount}
              onChange={(e) => setGastoAmount(e.target.value)}
              placeholder="Importe €"
              className="w-32 text-sm border border-cream-dark rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-gold/30"
            />
            <button
              onClick={async () => {
                if (!gastoConcept.trim() || !gastoAmount) return;
                setSavingGasto(true);
                setGastoMsg('');
                try {
                  const res = await fetch(`/api/events/${eventId}/gastos-previos`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ concept: gastoConcept.trim(), amount: Number(gastoAmount) }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setGastoConcept('');
                    setGastoAmount('');
                    fetchGastosPrevios();
                    fetchAll();
                  } else {
                    setGastoMsg('Error: ' + (data.error || ''));
                  }
                } catch {
                  setGastoMsg('Error de conexión');
                }
                setSavingGasto(false);
              }}
              disabled={savingGasto || !gastoConcept.trim() || !gastoAmount}
              className="px-4 py-2 rounded-lg bg-ink text-white text-sm font-medium hover:bg-ink-light disabled:opacity-50 whitespace-nowrap"
            >
              {savingGasto ? 'Guardando…' : '+ Añadir gasto'}
            </button>
          </div>
          {gastoMsg && <p className="text-xs text-danger">{gastoMsg}</p>}
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         6. PERSONAL
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={Shirt} title="Personal" />
        {staffingLines.length > 0 ? (
          <div className="bg-cream-dark rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Rol</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Plazas</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Horario</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Ubicacion</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Asignados</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {staffingLines.map((line: any) => (
                  <tr key={line.id} className="border-b border-gold/10 last:border-0">
                    <td className="py-1.5 text-ink font-medium">{line.role}</td>
                    <td className="py-1.5 text-center text-ink">{line.slots_needed}</td>
                    <td className="py-1.5 text-ink-soft-60">
                      {line.start_time && line.end_time
                        ? `${line.start_time} — ${line.end_time}`
                        : '—'}
                    </td>
                    <td className="py-1.5 text-ink-soft-60">{line.location || '—'}</td>
                    <td className="py-1.5 text-center text-ink">
                      {line.assigned_count || 0}/{line.slots_needed}
                    </td>
                    <td className="py-1.5 text-center">
                      <StatusBadge status={line.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyMessage text="Sin personal asignado" />
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
         7. PAGOS Y FACTURACIÓN
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={WalletMinimal} title="Pagos" />
        {payments.length > 0 ? (
          <div className="bg-cream-dark rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Concepto</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Importe</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Vencimiento</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Estado</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Pagado</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Metodo</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-gold/10 last:border-0">
                    <td className="py-1.5 text-ink">{p.concept}</td>
                    <td className="py-1.5 text-right font-semibold text-ink">{money(p.amount)}</td>
                    <td className="py-1.5 text-ink-soft-60">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtDate(p.due_date)}
                      </span>
                    </td>
                    <td className="py-1.5 text-center">
                      {p.paid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-ink-soft-60">{fmtDate(p.paid_date)}</td>
                    <td className="py-1.5 text-ink-soft-60">{p.method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Summary */}
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <span className="text-ink-soft-60">
                Total: <strong className="text-ink">{money(payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</strong>
              </span>
              <span className="text-success">
                Pagado: <strong>{money(payments.filter((p: any) => p.paid).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</strong>
              </span>
              <span className="text-warning">
                Pendiente: <strong>{money(payments.filter((p: any) => !p.paid).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</strong>
              </span>
            </div>
          </div>
        ) : (
          <EmptyMessage text="Sin pagos registrados" />
        )}

        {/* Facturación parcial/posterior (Sprint 4, B5) */}
        {invoices.length > 0 && (
          <div className="mt-4 bg-cream-dark rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-wider text-ink-soft-60 font-semibold mb-2 flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5" />
              Facturas ({invoices.length})
            </p>
            <div className="space-y-1.5">
              {invoices.map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink">{inv.invoice_number}</span>
                  <span className="text-ink-soft-60">{money(inv.subtotal)} · {inv.status === 'paid' ? 'Pagada' : 'Pendiente'}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-ink-soft-60 mt-2">
              Facturado: {money(totalInvoiced)} de {money(totalPvp)}
              {remainingToInvoice > 0 && ` — quedan ${money(remainingToInvoice)} por facturar`}
            </p>
          </div>
        )}

        {(event.status === 'completed' || event.status === 'paid') && remainingToInvoice > 0 && (
          <div className="mt-4 bg-white rounded-lg border border-cream-dark p-4">
            <p className="text-xs text-ink-soft mb-2">Facturar importe adicional (el resto ya cobrado manualmente)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={`Máx. ${remainingToInvoice.toFixed(2)}`}
                value={extraInvoiceAmount}
                onChange={(e) => setExtraInvoiceAmount(e.target.value)}
                className="flex-1 text-sm border border-cream-dark rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
              />
              <button
                onClick={invoiceRemainder}
                disabled={invoicing || !extraInvoiceAmount}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
              >
                {invoicing ? 'Facturando...' : 'Facturar'}
              </button>
            </div>
            {invoiceMsg && (
              <p className={`text-xs mt-2 ${invoiceMsg.includes('Error') ? 'text-danger' : 'text-success'}`}>{invoiceMsg}</p>
            )}
          </div>
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
         7b. FACTURACIÓN POR HITOS (WP-23)
         ────────────────────────────────────────────────────────── */}
      {milestones.length > 0 && (
        <section className="bg-cream border border-gold/20 rounded-xl p-6">
          <SectionHeader icon={Receipt} title="Facturación por Hitos" />
          <div className="bg-cream-dark rounded-lg p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/20">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Hito</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Importe</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Estado</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Factura</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-ink-soft-60 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((ms: any) => (
                  <tr key={ms.id} className="border-b border-gold/10 last:border-0">
                    <td className="py-1.5 text-ink font-medium">{ms.label}</td>
                    <td className="py-1.5 text-right font-semibold text-ink">{money(ms.amount)}</td>
                    <td className="py-1.5 text-center">
                      {ms.status === 'pagado' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Pagado
                        </span>
                      ) : ms.status === 'vencido' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-danger bg-danger/10 px-2 py-0.5 rounded-full">
                          Vencido
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-ink-soft-60 text-xs">
                      {ms.invoice_number ? (
                        <span className="text-success font-medium">{ms.invoice_number}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-1.5 text-right">
                      {ms.status === 'pagado' && !ms.invoice_id && (
                        <button
                          onClick={() => generateAdvanceInvoice(ms.id)}
                          disabled={generatingMilestone === ms.id}
                          className="text-xs font-medium px-3 py-1 rounded-lg bg-gold text-ink hover:bg-gold-dark disabled:opacity-50 transition-colors"
                        >
                          {generatingMilestone === ms.id ? 'Generando...' : 'Facturar anticipo'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {milestoneMsg && (
              <p className={`text-xs mt-3 ${milestoneMsg.includes('Error') ? 'text-danger' : 'text-success'}`}>{milestoneMsg}</p>
            )}
          </div>

          {/* Botón Factura Final */}
          <div className="mt-4 flex items-center justify-between bg-white rounded-lg border border-cream-dark p-4">
            <div>
              <p className="text-sm font-medium text-ink">Factura Final</p>
              <p className="text-xs text-ink-soft-60">
                Genera la factura del evento deduciendo los anticipos ya facturados
              </p>
              {milestones.filter(m => m.invoice_id).length > 0 && (
                <p className="text-xs text-success mt-1">
                  Anticipos facturados: {milestones.filter(m => m.invoice_id).length} ({money(milestones.filter(m => m.invoice_id).reduce((s: number, m: any) => s + Number(m.amount || 0), 0))})
                </p>
              )}
            </div>
            <button
              onClick={generateFinalInvoice}
              disabled={generatingFinal}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] disabled:opacity-50 transition-colors"
            >
              {generatingFinal ? 'Generando...' : 'Generar Factura Final'}
            </button>
          </div>
          {finalInvoiceMsg && (
            <p className={`text-xs mt-2 ${finalInvoiceMsg.includes('Error') ? 'text-danger' : 'text-success'}`}>{finalInvoiceMsg}</p>
          )}
        </section>
      )}

      {/* ──────────────────────────────────────────────────────────
         8. HISTORIAL
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={History} title="Historial" />
        <div className="bg-cream-dark rounded-lg p-4">
          <EmptyMessage text="Sin datos de historial" />
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         9. BRIEFING CAMAREROS
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={Users} title="Briefing Camareros" />
        <BriefingCamareros eventId={event.id} />
      </section>

      {/* ──────────────────────────────────────────────────────────
         10. CÁLCULO AUTOMÁTICO Y CIERRE
         ────────────────────────────────────────────────────────── */}
      <section className="bg-cream border border-gold/20 rounded-xl p-6">
        <SectionHeader icon={Calculator} title="Cálculos del Evento" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={async () => {
              setCalculating(true);
              try {
                const res = await fetch(`/api/event-flow/${event.id}/calculate`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                  setCalcResult(data.data);
                }
              } catch {}
              setCalculating(false);
            }}
            disabled={calculating}
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-cream-dark hover:border-gold transition-all disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-cream-dark flex items-center justify-center">
              <Table className="w-5 h-5 text-gold" />
            </div>
            <div className="text-left">
              <p className="font-medium text-ink">Calcular mesas y camareros</p>
              <p className="text-xs text-ink-soft-60">{event?.guest_count || 0} invitados → mesas de 10</p>
            </div>
          </button>

          <button
            onClick={async () => {
              setCalculating(true);
              try {
                const res = await fetch(`/api/escandallo/${event.id}/freeze/recalc`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'recalc' }),
                });
                const data = await res.json();
                if (data.success) fetchAll();
              } catch {}
              setCalculating(false);
            }}
            disabled={calculating}
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-cream-dark hover:border-gold transition-all disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-cream-dark flex items-center justify-center">
              <Calculator className="w-5 h-5 text-gold" />
            </div>
            <div className="text-left">
              <p className="font-medium text-ink">Recalcular escandallo</p>
              <p className="text-xs text-ink-soft-60">Desde recetas activas</p>
            </div>
          </button>
        </div>
        {calcResult && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-success/30 text-sm">
            <p className="font-medium text-success mb-2">Resultado:</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-ink-soft-60">Mesas</span>
                <p className="text-lg font-bold font-mono">{calcResult.tables_needed}</p>
              </div>
              <div>
                <span className="text-ink-soft-60">Camareros</span>
                <p className="text-lg font-bold font-mono">{calcResult.waiters_needed}</p>
              </div>
              <div>
                <span className="text-ink-soft-60">Ocupación</span>
                <p className="text-lg font-bold font-mono">{calcResult.capacity_used}%</p>
              </div>
            </div>
          </div>
        )}
        {event.status === 'accepted' || event.status === 'in_progress' ? (
          <div className="mt-6 pt-4 border-t border-cream-dark">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg border border-cream-dark">
                <p className="text-xs text-ink-soft mb-2">Importe a facturar (opcional)</p>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={`Por defecto: ${money(totalPvp)}`}
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  className="w-full text-sm border border-cream-dark rounded-lg px-3 py-2 focus:outline-none focus:border-gold"
                />
                <p className="text-[10px] text-ink-soft-60 mt-1">
                  Deja en blanco para facturar el total. El resto se podrá facturar más tarde.
                </p>
              </div>
              <button
                onClick={closeEvent}
                disabled={closing}
                className="flex items-center gap-3 p-4 bg-white rounded-lg border border-cream-dark hover:border-danger transition-all disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-ink">
                    {closing ? 'Cerrando evento...' : 'Cerrar Evento'}
                  </p>
                  <p className="text-xs text-ink-soft-60">
                    Congela escandallo · Deduce stock · Genera factura · Marca completado
                  </p>
                </div>
              </button>
            </div>
            {closeError && (
              <div className="mt-3 p-3 rounded-lg text-sm bg-danger/10 text-danger border border-danger/30">
                {closeError}
              </div>
            )}
            {closeConfirmations.length > 0 && (
              <div className="mt-3 p-3 rounded-lg text-sm bg-success/10 text-success border border-success/30">
                ✓ {closeConfirmations.join(', ')}
              </div>
            )}
            {closeWarnings.length > 0 && (
              <div className="mt-3 p-3 rounded-lg text-sm bg-warning/10 text-warning border border-warning/30 space-y-1">
                {closeWarnings.map((w, i) => (
                  <p key={i}>{w}</p>
                ))}
              </div>
            )}
          </div>
        ) : event.status === 'completed' || event.status === 'paid' ? (
          <div className="mt-6 pt-4 border-t border-cream-dark">
            <div className="p-4 bg-ink/10 rounded-lg border border-ink/20 text-sm text-ink">
              Evento cerrado. Escandallo congelado y stock deducido.
            </div>
          </div>
        ) : null}
      </section>
        </TabsContent>

        <TabsContent value="messages" className="space-y-6">
          <section className="bg-cream border border-gold/20 rounded-xl p-6">
            <SectionHeader icon={MessageCircle} title="Mensajes Cliente ↔ Equipo" />
            <div className="bg-cream-dark rounded-lg p-4">
              <EventMessages eventId={event.id} />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="closure" className="space-y-6">
          <section className="bg-cream border border-gold/20 rounded-xl p-6">
            <SectionHeader icon={Check} title="Cierre Operativo" />
            <div className="bg-cream-dark rounded-lg p-4">
              <EventClosure
                eventId={event.id}
                eventStatus={event.status}
                onStatusChange={fetchAll}
              />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          <section className="bg-cream border border-gold/20 rounded-xl p-6">
            <SectionHeader icon={History} title="Timeline del Evento" />
            <div className="bg-cream-dark rounded-lg p-4">
              <EventTimeline eventId={event.id} />
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
