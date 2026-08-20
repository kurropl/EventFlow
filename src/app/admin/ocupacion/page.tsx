'use client';

/**
 * Panel de Ocupación en Tiempo Real
 * J.Benitez — EventFlow ERP
 *
 * Muestra la ocupación de mesas de todos los eventos activos.
 * Vista tipo dashboard con cards por evento.
 */

import { useState, useEffect } from 'react';
import AdminLayout from '@/components/b2b/AdminLayout';
import Link from 'next/link';
import { PageHeader, Spinner, EmptyState } from '@/components/ui';
import { formatDate } from '@/lib/format';

interface EventOccupancy {
  id: string;
  clientName: string;
  eventDate: string;
  guestCount: number;
  status: string;
  planName: string | null;
  hasPlan: boolean;
  totalTables: number;
  totalSeats: number;
  occupiedSeats: number;
  freeSeats: number;
  assignedGuests: number;
  occupancyPct: number;
}

interface Totals {
  events: number;
  eventsWithPlan: number;
  totalSeats: number;
  totalOccupied: number;
}

const statusLabel: Record<string, string> = {
  draft: 'Borrador',
  quoted: 'Presupuestado',
  accepted: 'Aceptado',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  completed: 'Completado',
};

const statusColor: Record<string, string> = {
  accepted: 'bg-success',
  confirmed: 'bg-success',
  in_progress: 'bg-blue-500',
  completed: 'bg-sky-500',
  draft: 'bg-ink-soft',
};

const statusLinkColor: Record<string, string> = {
  accepted: 'hover:border-gold/40',
  confirmed: 'hover:border-gold/40',
  in_progress: 'hover:border-gold/40',
  completed: 'hover:border-gold/40',
  draft: 'hover:border-cream-dark',
};

export default function OcupacionPage() {
  const [events, setEvents] = useState<EventOccupancy[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/mapa-mesas/ocupacion')
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

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <PageHeader
            title="Ocupación en Tiempo Real"
            subtitle="Estado de todas las mesas por evento"
          />
        </div>

        {/* Totals bar */}
        {totals && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Eventos</p>
              <p className="text-2xl font-bold text-ink mt-1">{totals.events}</p>
              <p className="text-xs text-ink-soft-60">{totals.eventsWithPlan} con plano</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Plazas totales</p>
              <p className="text-2xl font-bold text-ink mt-1">{totals.totalSeats}</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Ocupados</p>
              <p className="text-2xl font-bold text-success mt-1">{totals.totalOccupied}</p>
            </div>
            <div className="bg-white border border-cream-dark rounded-xl p-4">
              <p className="text-xs text-ink-soft uppercase tracking-wider">Libres</p>
              <p className="text-2xl font-bold text-warning mt-1">{totals.totalSeats - totals.totalOccupied}</p>
            </div>
          </div>
        )}

        {/* States */}
        {loading && <Spinner label="Cargando ocupación..." />}

        {!loading && events.length === 0 && (
          <EmptyState title="No hay eventos activos con plano de mesas" />
        )}

        {/* Event cards */}
        {!loading && events.length > 0 && (
          <div className="grid gap-4">
            {events.map(event => (
              <Link
                key={event.id}
                href={`/admin/mapa-mesas?eventId=${event.id}`}
                className={`block bg-white border border-cream-dark rounded-xl ${statusLinkColor[event.status] || 'hover:border-cream-dark'} hover:shadow-md transition-all overflow-hidden group`}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-ink group-hover:text-gold transition-colors">
                        {event.clientName}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-ink-soft">
                        <span>{formatDate(event.eventDate)}</span>
                        <span>{event.guestCount} invitados</span>
                        <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-medium ${statusColor[event.status] || 'bg-ink-soft'}`}>
                          {statusLabel[event.status] || event.status}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-lg font-bold font-mono ${event.occupancyPct >= 80 ? 'text-success' : event.occupancyPct >= 40 ? 'text-warning' : 'text-ink-soft'}`}>
                        {event.occupancyPct}%
                      </span>
                      <p className="text-[10px] text-ink-soft-60 uppercase tracking-wider">Ocupación</p>
                    </div>
                  </div>

                  {/* Occupancy bar */}
                  <div className="w-full h-2 bg-cream rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        event.occupancyPct >= 80 ? 'bg-success' :
                        event.occupancyPct >= 40 ? 'bg-warning' : 'bg-ink-soft/30'
                      }`}
                      style={{ width: `${event.occupancyPct}%` }}
                    />
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    <div className="text-center p-2 rounded-lg bg-cream">
                      <p className="text-sm font-bold text-ink-light">{event.totalTables}</p>
                      <p className="text-[10px] text-ink-soft-60">Mesas</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-cream">
                      <p className="text-sm font-bold text-ink-light">{event.totalSeats}</p>
                      <p className="text-[10px] text-ink-soft-60">Plazas</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-success/10">
                      <p className="text-sm font-bold text-success">{event.occupiedSeats}</p>
                      <p className="text-[10px] text-success/70">Ocupados</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-warning/10">
                      <p className="text-sm font-bold text-warning">{event.freeSeats}</p>
                      <p className="text-[10px] text-warning/70">Libres</p>
                    </div>
                  </div>

                  {event.assignedGuests > 0 && (
                    <div className="mt-2 text-xs text-ink-soft-60 text-center">
                      {event.assignedGuests} invitados asignados a mesas
                      {event.guestCount > 0 && (
                        <span> — {event.guestCount - event.assignedGuests} sin asignar</span>
                      )}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}