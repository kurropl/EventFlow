/**
 * EventFlow — Public Quote Acceptance Page
 * /presupuesto/[id] — Public page for clients to view and accept quotes
 * No auth required.
 */
'use client';

import { useState, useEffect } from 'react';

interface QuoteData {
  id: string;
  event_id: string;
  status: string;
  total_pvp: number;
  base_pvp: number;
  bar_price: number;
  extras_pvp: number;
  iva_pct: number;
  valid_until: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  notes: string | null;
  event: {
    client_name: string;
    client_email: string;
    event_type: string;
    event_date: string;
    guest_count: number;
    selected_items: any[];
  };
  payments?: { concept: string; amount: number; paid: boolean; paid_date: string | null; due_date: string }[];
}

const EVENT_TYPE: Record<string, string> = {
  boda: 'Boda',
  'cumpleaños': 'Cumpleaños',
  corporativo: 'Corporativo',
  bautizo: 'Bautizo',
  'comunión': 'Comunión',
  otro: 'Otro',
};

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function fmtDate(k: string) {
  const [y, m, d] = k.split('-');
  return `${parseInt(d)} de ${MONTHS[parseInt(m) - 1]} de ${y}`;
}

function fmtEUR(v: number) {
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export default function PresupuestoPage({ params }: { params: { id: string } }) {
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejected, setRejected] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/quotes/public/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setQuote(data.data);
          if (data.data.status === 'accepted') setAccepted(true);
          if (data.data.status === 'rejected') setRejected(true);
        } else {
          setError(data.error || 'Presupuesto no encontrado');
        }
      } catch {
        setError('Error al cargar el presupuesto');
      }
      setLoading(false);
    }
    load();
  }, [params.id]);

  const handleAccept = async () => {
    if (!quote || accepting) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/quotes/public/${params.id}/accept`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setAccepted(true);
        setQuote((prev) => prev ? { ...prev, status: 'accepted', accepted_at: new Date().toISOString() } : prev);
      } else {
        setError(data.error || 'No se pudo aceptar');
      }
    } catch {
      setError('Error al aceptar el presupuesto');
    }
    setAccepting(false);
  };

  const handleReject = async () => {
    if (!quote || rejecting || accepting) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/quotes/public/${params.id}/reject`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setRejected(true);
        setQuote((prev) => prev ? { ...prev, status: 'rejected' } : prev);
      } else {
        setError(data.error || 'No se pudo rechazar');
      }
    } catch {
      setError('Error al rechazar el presupuesto');
    }
    setRejecting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Cargando presupuesto...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#FAF8F5' }}>
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <p className="text-gray-600">{error || 'Presupuesto no encontrado'}</p>
        </div>
      </div>
    );
  }

  const items = quote.event?.selected_items || [];
  const isExpired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const canAccept = quote.status === 'sent' && !isExpired && !accepted && !rejected;

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: '#FAF8F5' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            J.Benitez
          </h1>
          <p className="text-sm text-[#6B7280] mt-1">Salon de Celebraciones — Sevilla</p>
        </div>

        {/* Quote card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Status banner */}
          {accepted ? (
            <div className="bg-green-50 border-b border-green-200 px-6 py-4 text-center">
              <p className="text-green-700 font-semibold">Presupuesto aceptado</p>
              <p className="text-green-600 text-sm mt-1">
                {quote.accepted_at && `Aceptado el ${fmtDate(quote.accepted_at.slice(0, 10))}`}
              </p>
              {quote.event_id && (
                <a href={`/evento/${quote.event_id}`} className="inline-block mt-2 text-sm font-semibold text-green-700 underline">
                  Ver mi evento
                </a>
              )}
            </div>
          ) : rejected ? (
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 text-center">
              <p className="text-gray-700 font-semibold">Presupuesto rechazado</p>
            </div>
          ) : isExpired ? (
            <div className="bg-red-50 border-b border-red-200 px-6 py-4 text-center">
              <p className="text-red-700 font-semibold">Presupuesto expirado</p>
              <p className="text-red-600 text-sm mt-1">
                Valido hasta {quote.valid_until ? fmtDate(quote.valid_until) : 'N/A'}
              </p>
            </div>
          ) : quote.status === 'sent' ? (
            <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 text-center">
              <p className="text-amber-700 font-semibold">Pendiente de revision</p>
              <p className="text-amber-600 text-sm mt-1">
                Valido hasta {quote.valid_until ? fmtDate(quote.valid_until) : 'Sin fecha limite'}
              </p>
            </div>
          ) : null}

          <div className="p-6">
            {/* Client info */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-[#1A1A1A] mb-1">
                {quote.event?.client_name}
              </h2>
              <p className="text-sm text-[#6B7280]">
                {EVENT_TYPE[quote.event?.event_type] || quote.event?.event_type} — {quote.event?.event_date ? fmtDate(quote.event.event_date) : 'Fecha por confirmar'}
              </p>
              <p className="text-sm text-[#6B7280]">
                {quote.event?.guest_count || 0} invitados
              </p>
            </div>

            {/* Items */}
            {items.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider mb-3">Menu seleccionado</h3>
                <div className="space-y-2">
                  {items.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm text-[#1A1A1A]">{item.name}</p>
                        {item.quantity > 0 && (
                          <p className="text-xs text-[#9CA3AF]">{item.quantity} ud. × {fmtEUR(item.unit_price_pvp || 0)}</p>
                        )}
                      </div>
                      <p className="text-sm font-medium text-[#1A1A1A]">{fmtEUR(item.subtotal_pvp || 0)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="bg-[#FAF8F5] rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">Base imponible</span>
                <span>{fmtEUR(quote.base_pvp)}</span>
              </div>
              {quote.bar_price > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Barra</span>
                  <span>{fmtEUR(quote.bar_price)}</span>
                </div>
              )}
              {quote.extras_pvp > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Extras</span>
                  <span>{fmtEUR(quote.extras_pvp)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-[#6B7280]">IVA ({quote.iva_pct}%)</span>
                <span>{fmtEUR((quote.base_pvp + quote.bar_price + quote.extras_pvp) * quote.iva_pct / 100)}</span>
              </div>
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-[#1A1A1A]">Total</span>
                  <span className="text-xl font-bold text-[#C9A84C]">{fmtEUR(quote.total_pvp)}</span>
                </div>
              </div>
            </div>

            {/* Señal/saldo y estado de pago (AC4.4) */}
            {quote.payments && quote.payments.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider mb-3">Pagos</h3>
                <div className="space-y-2">
                  {quote.payments.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm text-[#1A1A1A]">{p.concept}</p>
                        <p className="text-xs text-[#9CA3AF]">Vence {fmtDate(p.due_date.slice(0, 10))}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-[#1A1A1A]">{fmtEUR(p.amount)}</p>
                        <span className={`text-xs font-semibold ${p.paid ? 'text-green-600' : 'text-amber-600'}`}>
                          {p.paid ? 'Pagado' : 'Pendiente'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {quote.notes && (
              <div className="mt-4 p-3 bg-blue-50 rounded-xl">
                <p className="text-xs font-semibold text-blue-700 mb-1">Notas</p>
                <p className="text-sm text-blue-600">{quote.notes}</p>
              </div>
            )}

            {/* Accept / Reject buttons */}
            {canAccept && (
              <div className="mt-6 space-y-2">
                <button
                  onClick={handleAccept}
                  disabled={accepting || rejecting}
                  className="w-full py-3 px-6 rounded-xl text-white font-semibold text-base transition-colors disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #D4B85C)' }}
                >
                  {accepting ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Procesando...
                    </span>
                  ) : (
                    'Aceptar presupuesto'
                  )}
                </button>
                <button
                  onClick={handleReject}
                  disabled={accepting || rejecting}
                  className="w-full py-3 px-6 rounded-xl text-[#6B7280] font-semibold text-base border border-gray-200 transition-colors disabled:opacity-50 hover:bg-gray-50"
                >
                  {rejecting ? 'Procesando...' : 'Rechazar presupuesto'}
                </button>
                <p className="text-center text-xs text-[#9CA3AF] mt-2">
                  Al aceptar, confirmaras el servicio de catering para tu evento.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#9CA3AF] mt-6">
          J.Benitez — Salon de Celebraciones — Sevilla
        </p>
      </div>
    </div>
  );
}
