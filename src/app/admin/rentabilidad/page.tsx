'use client';

/**
 * Dashboard de Rentabilidad — EventFlow ERP
 * J.Benitez
 *
 * Muestra margen bruto, ingresos, costes y estado de pagos por evento.
 */

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/b2b/AdminLayout';
import Link from 'next/link';

interface CostBreakdown {
  [key: string]: number;
}

interface EventProfitability {
  id: string;
  clientName: string;
  eventDate: string;
  guestCount: number;
  status: string;
  eventType: string;
  totalPvp: number;
  totalCost: number;
  grossMargin: number;
  marginPct: number;
  costPerGuest: number;
  revenuePerGuest: number;
  totalPaid: number;
  balance: number;
  paymentCount: number;
  paidCount: number;
  unpaidCount: number;
  isFullyPaid: boolean;
  escandalloTotal: number;
  costBreakdown: CostBreakdown;
  breakdownTypes: string[];
}

interface Totals {
  totalEvents: number;
  totalPvp: number;
  totalCost: number;
  totalMargin: number;
  totalPaid: number;
  averageMarginPct: number;
  fullyPaidCount: number;
  eventsWithCosts: number;
}

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  quoted: 'Presupuestado',
  accepted: 'Aceptado',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
  lost: 'Perdido',
  cancelled: 'Cancelado',
};

const statusColor: Record<string, string> = {
  draft: 'bg-stone-400',
  quoted: 'bg-amber-500',
  accepted: 'bg-emerald-500',
  confirmed: 'bg-emerald-600',
  in_progress: 'bg-blue-500',
  completed: 'bg-sky-500',
  lost: 'bg-red-400',
  cancelled: 'bg-stone-300',
};

export default function RentabilidadPage() {
  const [events, setEvents] = useState<EventProfitability[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'margin' | 'pvp'>('date');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetch('/api/rentabilidad')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setEvents(d.data);
          setTotals(d.totals);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...events]
    .filter(e => !filterStatus || e.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'margin') return b.marginPct - a.marginPct;
      if (sortBy === 'pvp') return b.totalPvp - a.totalPvp;
      return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
    });

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-[#1A1208] tracking-tight">
            Rentabilidad
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Margen bruto, ingresos y costes por evento
          </p>
        </div>

        {/* Totals bar */}
        {totals && (
          <div className="grid grid-cols-5 gap-3 mb-6">
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Eventos</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">{totals.totalEvents}</p>
              <p className="text-xs text-stone-400">{totals.eventsWithCosts} con costes</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Ingresos</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{totals.totalPvp.toLocaleString('es-ES')}€</p>
              <p className="text-xs text-stone-400">{totals.totalPaid.toLocaleString('es-ES')}€ cobrado</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Costes</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{totals.totalCost.toLocaleString('es-ES')}€</p>
            </div>
            <div className={`bg-white border rounded-xl p-4 ${totals.averageMarginPct >= 30 ? 'border-emerald-200' : totals.averageMarginPct >= 15 ? 'border-amber-200' : 'border-red-200'}`}>
              <p className="text-xs text-stone-500 uppercase tracking-wider">Margen medio</p>
              <p className={`text-2xl font-bold mt-1 ${totals.averageMarginPct >= 30 ? 'text-emerald-700' : totals.averageMarginPct >= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                {totals.averageMarginPct}%
              </p>
              <p className="text-xs text-stone-400">{totals.totalMargin.toLocaleString('es-ES')}€</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Pagados</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">{totals.fullyPaidCount}/{totals.totalEvents}</p>
              <p className="text-xs text-stone-400">{totals.totalEvents - totals.fullyPaidCount} pendientes</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-600"
          >
            <option value="date">Más recientes</option>
            <option value="margin">Mayor margen</option>
            <option value="pvp">Mayor importe</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-600"
          >
            <option value="">Todos los estados</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-stone-400 text-sm">Cargando rentabilidad...</div>
        )}

        {/* Events */}
        {!loading && sorted.length === 0 && (
          <div className="text-center py-16 text-stone-400 text-sm">
            No hay eventos con datos financieros
          </div>
        )}

        <div className="space-y-3">
          {sorted.map(ev => (
            <Link
              key={ev.id}
              href={`/admin/evento?id=${ev.id}`}
              className="block bg-white border border-stone-200 rounded-xl hover:border-[#C9A84C]/40 hover:shadow-md transition-all"
            >
              <div className="p-5">
                {/* Row 1: nombre + estado + margen */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-stone-800">{ev.clientName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                      <span>{new Date(ev.eventDate).toLocaleDateString('es-ES')}</span>
                      <span>{ev.guestCount} invitados</span>
                      <span>{ev.eventType}</span>
                      <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-medium ${statusColor[ev.status] || 'bg-stone-400'}`}>
                        {statusLabel[ev.status] || ev.status}
                      </span>
                    </div>
                  </div>

                  {/* Margen indicator */}
                  <div className="text-right">
                    <div className={`text-lg font-bold font-mono ${ev.marginPct >= 30 ? 'text-emerald-600' : ev.marginPct >= 15 ? 'text-amber-600' : 'text-red-500'}`}>
                      {ev.marginPct}%
                    </div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider">Margen</p>
                  </div>
                </div>

                {/* Barra de margen */}
                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ev.marginPct >= 30 ? 'bg-emerald-500' : ev.marginPct >= 15 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${Math.min(ev.marginPct * 2, 100)}%` }}
                  />
                </div>

                {/* Row 2: financial grid */}
                <div className="grid grid-cols-5 gap-2">
                  <div className="text-center p-2 rounded-lg bg-stone-50">
                    <p className="text-sm font-bold text-stone-700">{ev.totalPvp.toLocaleString('es-ES')}€</p>
                    <p className="text-[10px] text-stone-400">PVP</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-stone-50">
                    <p className="text-sm font-bold text-stone-700">{ev.totalCost.toLocaleString('es-ES')}€</p>
                    <p className="text-[10px] text-stone-400">Coste</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-stone-50">
                    <p className="text-sm font-bold text-stone-700">{ev.revenuePerGuest.toFixed(2)}€</p>
                    <p className="text-[10px] text-stone-400">Ingreso/pax</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-stone-50">
                    <p className="text-sm font-bold text-stone-700">{ev.costPerGuest.toFixed(2)}€</p>
                    <p className="text-[10px] text-stone-400">Coste/pax</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${ev.isFullyPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}>
                    <p className={`text-sm font-bold ${ev.isFullyPaid ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {ev.totalPaid.toLocaleString('es-ES')}€
                    </p>
                    <p className="text-[10px] text-stone-400">
                      {ev.isFullyPaid ? 'Pagado' : `${ev.paidCount}/${ev.paymentCount} pagos`}
                    </p>
                  </div>
                </div>

                {/* Desglose de costes */}
                {ev.breakdownTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ev.breakdownTypes.map(type => (
                      <span key={type} className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500">
                        {type}: {ev.costBreakdown[type].toLocaleString('es-ES')}€
                      </span>
                    ))}
                  </div>
                )}

                {/* Escandallo */}
                {ev.escandalloTotal > 0 && (
                  <div className="mt-2 text-[10px] text-stone-400 text-right">
                    Escandallo real: {ev.escandalloTotal.toFixed(2)}€
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}