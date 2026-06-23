'use client';

/**
 * EventFlow — Ficha del Evento
 * Unified view showing ALL data for a single event.
 * Fetches from: events, quotes, escandallos, staffing, payments APIs.
 */

import { useState, useEffect, useCallback } from 'react';
import StatusBadge from './StatusBadge';
import BriefingCamareros from './BriefingCamareros';
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
} from 'lucide-react';

/* ── Helpers ───────────────────────────────────────────────────── */
const money = (n: number | string | null | undefined) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
};

/* ── Loading Skeleton ──────────────────────────────────────────── */
function SectionSkeleton() {
  return (
    <div className="bg-[#F8F3E6] rounded-xl p-6 space-y-4 animate-pulse">
      <div className="h-5 w-40 bg-[#C9A86A]/20 rounded" />
      <div className="space-y-2">
        <div className="h-4 w-full bg-[#C9A86A]/10 rounded" />
        <div className="h-4 w-3/4 bg-[#C9A86A]/10 rounded" />
        <div className="h-4 w-1/2 bg-[#C9A86A]/10 rounded" />
      </div>
    </div>
  );
}

function FullSkeleton() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="h-8 w-64 bg-[#C9A86A]/15 rounded-lg animate-pulse" />
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
      <Icon className="w-5 h-5 text-[#C9A86A]" />
      <h2 className="font-serif text-lg font-semibold text-[#C9A86A]">{title}</h2>
    </div>
  );
}

/* ── Field Row ─────────────────────────────────────────────────── */
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[#9CA3AF] font-semibold mb-0.5">{label}</p>
      <p className="text-sm text-[#0a0a0a]">{value || '—'}</p>
    </div>
  );
}

/* ── Empty State ───────────────────────────────────────────────── */
function EmptyMessage({ text }: { text: string }) {
  return (
    <p className="text-sm text-[#9CA3AF] italic">{text}</p>
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [calcResult, setCalcResult] = useState<any>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeMsg, setCloseMsg] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [eventRes, escRes, staffRes, payRes, quoteRes] = await Promise.allSettled([
        fetch(`/api/events/${eventId}`),
        fetch(`/api/stock/escandallos?event_id=${eventId}`),
        fetch(`/api/staffing/lines?event_id=${eventId}`),
        fetch(`/api/payments?event_id=${eventId}`),
        fetch(`/api/quotes?event_id=${eventId}`),
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
    } catch {
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  /* ── Loading ──────────────────────────────────────────────────── */
  if (loading) return <FullSkeleton />;

  /* ── Error ────────────────────────────────────────────────────── */
  if (error || !event) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
        <p className="text-sm text-red-500 mb-2">{error || 'Evento no encontrado'}</p>
        <p className="text-xs text-[#9CA3AF]">ID: {eventId}</p>
      </div>
    );
  }

  const items: any[] = event.selected_items || [];

  /* ════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* ── Page Title ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl font-bold text-[#0a0a0a]">Ficha del Evento</h1>
        <StatusBadge status={event.status} />
      </div>

      {/* ──────────────────────────────────────────────────────────
         1. DATOS DEL EVENTO
         ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={CalendarDays} title="Datos del Evento" />
        <div className="bg-[#F8F3E6] rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="Cliente" value={event.client_name} />
          <Field
            label="Email"
            value={
              event.client_email ? (
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3 text-[#9CA3AF]" />
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
                  <Phone className="w-3 h-3 text-[#9CA3AF]" />
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
                <Users className="w-3 h-3 text-[#9CA3AF]" />
                {event.guest_count || 0}
                {event.kids_count ? ` (+ ${event.kids_count} ninos)` : ''}
              </span>
            }
          />
          <Field
            label="Total PVP"
            value={
              <span className="flex items-center gap-1 font-semibold text-[#0a0a0a]">
                <Euro className="w-3 h-3 text-[#C9A86A]" />
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
        </div>

        {/* Selected items mini-table */}
        {items.length > 0 && (
          <div className="mt-4 bg-[#F8F3E6] rounded-lg p-4">
            <p className="text-[11px] uppercase tracking-wider text-[#9CA3AF] font-semibold mb-2">
              Items seleccionados ({items.length})
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#C9A86A]/20">
                    <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Nombre</th>
                    <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Categoria</th>
                    <th className="text-right py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[#C9A86A]/10 last:border-0">
                      <td className="py-1.5 text-[#0a0a0a]">{item.name}</td>
                      <td className="py-1.5 text-[#9CA3AF]">{item.category || '—'}</td>
                      <td className="py-1.5 text-right text-[#0a0a0a]">{item.quantity || 1}</td>
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
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={ClipboardList} title="Presupuesto" />
        {quote ? (
          <div className="bg-[#F8F3E6] rounded-lg p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
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
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={WalletMinimal} title="Señal y Confirmación" />
        <div className="bg-[#F8F3E6] rounded-lg p-4 space-y-4">
          {/* Estado actual */}
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              event.status === 'accepted'
                ? 'bg-emerald-100 text-emerald-700'
                : quote?.deposit_paid === true
                  ? 'bg-emerald-100 text-emerald-700'
                  : event.status === 'completed' || event.status === 'paid'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-amber-100 text-amber-700'
            }`}>
              {event.status === 'accepted' ? '✓ Confirmado'
                : event.status === 'completed' ? 'Completado'
                : event.status === 'paid' ? 'Pagado'
                : quote?.deposit_paid ? 'Señal pagada — pendiente de confirmar'
                : 'Pendiente de señal'}
            </div>
            {quote && (
              <span className="text-xs text-stone-400">
                Señal: {money(quote.deposit_amount || (Number(quote.total_pvp || 0) * Number(quote.deposit_pct || 40) / 100))}
                ({quote.deposit_pct || 40}%)
              </span>
            )}
          </div>

          {/* If not yet confirmed and not already accepted/completed */}
          {event.status !== 'accepted' && event.status !== 'completed' && event.status !== 'paid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Signal amount card */}
              <div className="p-4 bg-white rounded-lg border border-stone-200">
                <p className="text-xs text-stone-500 mb-2">Importe de la señal</p>
                <p className="text-xl font-bold font-mono">
                  {money(quote?.deposit_amount || (Number(event.total_pvp || 0) * Number(quote?.deposit_pct || 40) / 100))}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {quote?.deposit_pct || 40}% del total · {money(event.total_pvp || 0)}
                </p>
              </div>

              {/* Confirm button */}
              <div className="p-4 bg-white rounded-lg border border-stone-200 flex flex-col justify-between">
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
                  className="w-full py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {confirming ? 'Confirmando...' : quote?.deposit_paid
                    ? 'Señal ya registrada'
                    : '✓ Registrar señal y confirmar evento'}
                </button>
                {confirmMsg && (
                  <p className={`text-xs mt-2 ${confirmMsg.includes('Error') ? 'text-red-600' : 'text-emerald-600'}`}>
                    {confirmMsg}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Guest invitation link (show when confirmed) */}
          {(event.status === 'accepted' || event.status === 'completed' || event.status === 'paid') && event.client_token && (
            <div className="p-4 bg-white rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">ACTIVO</span>
                <span className="text-xs text-stone-500">Enlace para invitados</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-stone-50 border border-stone-200 rounded-lg p-2.5 truncate font-mono text-stone-600">
                  {`${window.location.origin}/invitados/${event.client_token}`}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/invitados/${event.client_token}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="px-3 py-2 rounded-lg bg-stone-800 text-white text-xs font-medium hover:bg-stone-700 shrink-0"
                >
                  {copied ? '✓ Copiado' : 'Copiar'}
                </button>
              </div>
              <p className="text-[10px] text-stone-400 mt-1">Comparte este enlace con el cliente para que rellene los invitados</p>
            </div>
          )}
        </div>
      </section>
      )}

      {/* ──────────────────────────────────────────────────────────
         4. ESCANDALLO
         ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={ShoppingBag} title="Escandallo" />
        {escandalloItems.length > 0 ? (
          <div className="bg-[#F8F3E6] rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C9A86A]/20">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Ingrediente</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Proveedor</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Gramos</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Unidades</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Ml</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Completado</th>
                </tr>
              </thead>
              <tbody>
                {escandalloItems.map((item: any) => (
                  <tr key={item.id} className="border-b border-[#C9A86A]/10 last:border-0">
                    <td className="py-1.5 text-[#0a0a0a] flex items-center gap-1.5">
                      <Package className="w-3 h-3 text-[#C9A86A]" />
                      {item.ingredient_name}
                    </td>
                    <td className="py-1.5 text-[#9CA3AF] flex items-center gap-1">
                      {item.provider_name && <Truck className="w-3 h-3" />}
                      {item.provider_name || '—'}
                    </td>
                    <td className="py-1.5 text-right text-[#0a0a0a]">{item.total_grams || '—'}</td>
                    <td className="py-1.5 text-right text-[#0a0a0a]">{item.total_units || '—'}</td>
                    <td className="py-1.5 text-right text-[#0a0a0a]">{item.total_ml || '—'}</td>
                    <td className="py-1.5 text-center">
                      {item.completed ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700">
                          <Check className="w-3 h-3" />
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-[#9CA3AF]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#9CA3AF]" />
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
         5. PERSONAL
         ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={Shirt} title="Personal" />
        {staffingLines.length > 0 ? (
          <div className="bg-[#F8F3E6] rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C9A86A]/20">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Rol</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Plazas</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Horario</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Ubicacion</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Asignados</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {staffingLines.map((line: any) => (
                  <tr key={line.id} className="border-b border-[#C9A86A]/10 last:border-0">
                    <td className="py-1.5 text-[#0a0a0a] font-medium">{line.role}</td>
                    <td className="py-1.5 text-center text-[#0a0a0a]">{line.slots_needed}</td>
                    <td className="py-1.5 text-[#9CA3AF]">
                      {line.start_time && line.end_time
                        ? `${line.start_time} — ${line.end_time}`
                        : '—'}
                    </td>
                    <td className="py-1.5 text-[#9CA3AF]">{line.location || '—'}</td>
                    <td className="py-1.5 text-center text-[#0a0a0a]">
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
         6. PAGOS
         ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={WalletMinimal} title="Pagos" />
        {payments.length > 0 ? (
          <div className="bg-[#F8F3E6] rounded-lg p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#C9A86A]/20">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Concepto</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Importe</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Vencimiento</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Estado</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Pagado</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-[#9CA3AF] font-semibold">Metodo</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-[#C9A86A]/10 last:border-0">
                    <td className="py-1.5 text-[#0a0a0a]">{p.concept}</td>
                    <td className="py-1.5 text-right font-semibold text-[#0a0a0a]">{money(p.amount)}</td>
                    <td className="py-1.5 text-[#9CA3AF]">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtDate(p.due_date)}
                      </span>
                    </td>
                    <td className="py-1.5 text-center">
                      {p.paid ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Pagado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-[#9CA3AF]">{fmtDate(p.paid_date)}</td>
                    <td className="py-1.5 text-[#9CA3AF]">{p.method || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Summary */}
            <div className="mt-3 flex justify-end gap-6 text-sm">
              <span className="text-[#9CA3AF]">
                Total: <strong className="text-[#0a0a0a]">{money(payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</strong>
              </span>
              <span className="text-green-700">
                Pagado: <strong>{money(payments.filter((p: any) => p.paid).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</strong>
              </span>
              <span className="text-amber-700">
                Pendiente: <strong>{money(payments.filter((p: any) => !p.paid).reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0))}</strong>
              </span>
            </div>
          </div>
        ) : (
          <EmptyMessage text="Sin pagos registrados" />
        )}
      </section>

      {/* ──────────────────────────────────────────────────────────
         7. HISTORIAL
         ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={History} title="Historial" />
        <div className="bg-[#F8F3E6] rounded-lg p-4">
          <EmptyMessage text="Sin datos de historial" />
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────
         8. BRIEFING CAMAREROS
         ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
        <SectionHeader icon={Users} title="Briefing Camareros" />
        <BriefingCamareros eventId={event.id} />
      </section>

      {/* ──────────────────────────────────────────────────────────
         9. CÁLCULO AUTOMÁTICO
         ────────────────────────────────────────────────────────── */}
      <section className="bg-[#FAF8F5] border border-[#C9A86A]/20 rounded-xl p-6">
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
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-stone-200 hover:border-[#C9A86A] transition-all disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FBF6E9] flex items-center justify-center">
              <Table className="w-5 h-5 text-[#C9A86A]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-stone-800">Calcular mesas y camareros</p>
              <p className="text-xs text-stone-500">{event?.guest_count || 0} invitados → mesas de 10</p>
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
            className="flex items-center gap-3 p-4 bg-white rounded-lg border border-stone-200 hover:border-[#C9A86A] transition-all disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-lg bg-[#FBF6E9] flex items-center justify-center">
              <Calculator className="w-5 h-5 text-[#C9A86A]" />
            </div>
            <div className="text-left">
              <p className="font-medium text-stone-800">Recalcular escandallo</p>
              <p className="text-xs text-stone-500">Desde recetas activas</p>
            </div>
          </button>
        </div>
        {calcResult && (
          <div className="mt-4 p-4 bg-white rounded-lg border border-emerald-200 text-sm">
            <p className="font-medium text-emerald-800 mb-2">Resultado:</p>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-stone-500">Mesas</span>
                <p className="text-lg font-bold font-mono">{calcResult.tables_needed}</p>
              </div>
              <div>
                <span className="text-stone-500">Camareros</span>
                <p className="text-lg font-bold font-mono">{calcResult.waiters_needed}</p>
              </div>
              <div>
                <span className="text-stone-500">Ocupación</span>
                <p className="text-lg font-bold font-mono">{calcResult.capacity_used}%</p>
              </div>
            </div>
          </div>
        )}
        {event.status === 'accepted' || event.status === 'in_progress' ? (
          <div className="mt-6 pt-4 border-t border-stone-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={async () => {
                  setClosing(true);
                  setCloseMsg('');
                  try {
                    const res = await fetch(`/api/events/${event.id}/close`, { method: 'POST' });
                    const data = await res.json();
                    if (data.success) {
                      setCloseMsg('✓ ' + (data.data?.results || []).join(', '));
                      fetchAll();
                    } else {
                      setCloseMsg('Error: ' + (data.error || ''));
                    }
                  } catch { setCloseMsg('Error de conexión'); }
                  setClosing(false);
                }}
                disabled={closing}
                className="flex items-center gap-3 p-4 bg-white rounded-lg border border-stone-200 hover:border-red-400 transition-all disabled:opacity-50 col-span-full"
              >
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <p className="font-medium text-stone-800">
                    {closing ? 'Cerrando evento...' : 'Cerrar Evento'}
                  </p>
                  <p className="text-xs text-stone-500">
                    Congela escandallo · Deduce stock · Genera factura · Marca completado
                  </p>
                </div>
              </button>
            </div>
            {closeMsg && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${
                closeMsg.includes('Error') ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {closeMsg}
              </div>
            )}
          </div>
        ) : event.status === 'completed' || event.status === 'paid' ? (
          <div className="mt-6 pt-4 border-t border-stone-200">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 text-sm text-blue-700">
              Evento cerrado. Escandallo congelado y stock deducido.
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
