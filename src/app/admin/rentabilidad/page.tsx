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
import { PageHeader, Spinner, EmptyState } from '@/components/ui';

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
  costeRealCongelado: number;
  costBreakdown: CostBreakdown;
  breakdownTypes: string[];
  laborCostPaid: number;
  laborCostTotal: number;
  laborCostPending: number;
  totalCostFull: number;
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
  totalLaborCost: number;
  totalCostFull: number;
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
          <PageHeader
            title="Rentabilidad"
            subtitle="Margen real (incl. personal pagado), ingresos y costes por evento"
          />
        </div>

        {/* Totals bar */}
        {totals && (
          <div className="grid grid-cols-6 gap-3 mb-6">
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Eventos</p>
              <p className="text-2xl font-bold text-ink mt-1">{totals.totalEvents}</p>
              <p className="text-xs text-ink-soft-60">{totals.eventsWithCosts} con costes</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Ingresos</p>
              <p className="text-2xl font-bold text-success mt-1">{totals.totalPvp.toLocaleString('es-ES')}€</p>
              <p className="text-xs text-ink-soft-60">{totals.totalPaid.toLocaleString('es-ES')}€ cobrado</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Costes (comida+extras)</p>
              <p className="text-2xl font-bold text-danger mt-1">{totals.totalCost.toLocaleString('es-ES')}€</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Personal pagado</p>
              <p className="text-2xl font-bold text-danger mt-1">{totals.totalLaborCost.toLocaleString('es-ES')}€</p>
              <p className="text-xs text-ink-soft-60">coste total real: {totals.totalCostFull.toLocaleString('es-ES')}€</p>
            </div>
            <div className={`bg-white border rounded-xl p-4 ${totals.averageMarginPct >= 30 ? 'border-success/30' : totals.averageMarginPct >= 15 ? 'border-warning/30' : 'border-danger/30'}`}>
              <p className="text-xs text-ink-soft uppercase tracking-wider">Margen medio</p>
              <p className={`text-2xl font-bold mt-1 ${totals.averageMarginPct >= 30 ? 'text-success' : totals.averageMarginPct >= 15 ? 'text-warning' : 'text-danger'}`}>
                {totals.averageMarginPct}%
              </p>
              <p className="text-xs text-ink-soft-60">{totals.totalMargin.toLocaleString('es-ES')}€</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Pagados</p>
              <p className="text-2xl font-bold text-ink mt-1">{totals.fullyPaidCount}/{totals.totalEvents}</p>
              <p className="text-xs text-ink-soft-60">{totals.totalEvents - totals.fullyPaidCount} pendientes</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="text-xs bg-white border border-cream-dark rounded-lg px-3 py-2 text-ink-soft"
          >
            <option value="date">Más recientes</option>
            <option value="margin">Mayor margen</option>
            <option value="pvp">Mayor importe</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="text-xs bg-white border border-cream-dark rounded-lg px-3 py-2 text-ink-soft"
          >
            <option value="">Todos los estados</option>
            {Object.entries(statusLabel).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && <Spinner label="Cargando rentabilidad..." />}

        {/* Events */}
        {!loading && sorted.length === 0 && (
          <EmptyState title="No hay eventos con datos financieros" />
        )}

        <div className="space-y-3">
          {sorted.map(ev => (
            <Link
              key={ev.id}
              href={`/admin/evento?id=${ev.id}`}
              className="block bg-white border border-cream-dark rounded-xl hover:border-gold/40 hover:shadow-md transition-all"
            >
              <div className="p-5">
                {/* Row 1: nombre + estado + margen */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-ink">{ev.clientName}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-ink-soft">
                      <span>{new Date(ev.eventDate).toLocaleDateString('es-ES')}</span>
                      <span>{ev.guestCount} invitados</span>
                      <span>{ev.eventType}</span>
                      <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-medium ${statusColor[ev.status] || 'bg-ink-soft'}`}>
                        {statusLabel[ev.status] || ev.status}
                      </span>
                    </div>
                  </div>

                  {/* Margen indicator */}
                  <div className="text-right">
                    <div className={`text-lg font-bold font-mono ${ev.marginPct >= 30 ? 'text-success' : ev.marginPct >= 15 ? 'text-warning' : 'text-danger'}`}>
                      {ev.marginPct}%
                    </div>
                    <p className="text-[10px] text-ink-soft-60 uppercase tracking-wider">Margen</p>
                  </div>
                </div>

                {/* Barra de margen */}
                <div className="w-full h-1.5 bg-cream rounded-full overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ev.marginPct >= 30 ? 'bg-success' : ev.marginPct >= 15 ? 'bg-warning' : 'bg-danger'
                    }`}
                    style={{ width: `${Math.min(ev.marginPct * 2, 100)}%` }}
                  />
                </div>

                {/* Row 2: financial grid */}
                <div className="grid grid-cols-6 gap-2">
                  <div className="text-center p-2 rounded-lg bg-cream">
                    <p className="text-sm font-bold text-ink-light">{ev.totalPvp.toLocaleString('es-ES')}€</p>
                    <p className="text-[10px] text-ink-soft-60">PVP</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cream">
                    <p className="text-sm font-bold text-ink-light">{ev.totalCost.toLocaleString('es-ES')}€</p>
                    <p className="text-[10px] text-ink-soft-60">Comida+extras</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cream">
                    <p className="text-sm font-bold text-ink-light">{ev.laborCostPaid.toLocaleString('es-ES')}€</p>
                    <p className="text-[10px] text-ink-soft-60">
                      Personal{ev.laborCostPending > 0 ? ` (+${ev.laborCostPending.toLocaleString('es-ES')}€ pend.)` : ''}
                    </p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cream">
                    <p className="text-sm font-bold text-ink-light">{ev.revenuePerGuest.toFixed(2)}€</p>
                    <p className="text-[10px] text-ink-soft-60">Ingreso/pax</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cream">
                    <p className="text-sm font-bold text-ink-light">{ev.costPerGuest.toFixed(2)}€</p>
                    <p className="text-[10px] text-ink-soft-60">Coste/pax real</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${ev.isFullyPaid ? 'bg-success/10' : 'bg-warning/10'}`}>
                    <p className={`text-sm font-bold ${ev.isFullyPaid ? 'text-success' : 'text-warning'}`}>
                      {ev.totalPaid.toLocaleString('es-ES')}€
                    </p>
                    <p className="text-[10px] text-ink-soft-60">
                      {ev.isFullyPaid ? 'Pagado' : `${ev.paidCount}/${ev.paymentCount} pagos`}
                    </p>
                  </div>
                </div>

                {/* Desglose de costes */}
                {ev.breakdownTypes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ev.breakdownTypes.map(type => (
                      <span key={type} className="text-[10px] px-2 py-0.5 rounded-full bg-cream text-ink-soft">
                        {type}: {ev.costBreakdown[type].toLocaleString('es-ES')}€
                      </span>
                    ))}
                  </div>
                )}

                {/* Coste real congelado (AC2.4): desviación del escandallo tras el cierre */}
                {ev.costeRealCongelado > 0 && (
                  <div className="mt-2 text-[10px] text-ink-soft-60 text-right">
                    Coste real congelado: {ev.costeRealCongelado.toFixed(2)}€
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