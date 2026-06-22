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

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: 'Borrador',
      quoted: 'Presupuestado',
      accepted: 'Aceptado',
      confirmed: 'Confirmado',
      in_progress: 'En curso',
      completed: 'Completado',
    };
    return map[s] || s;
  };

  const statusColor = (s: string) => {
    if (s === 'accepted' || s === 'confirmed' || s === 'in_progress') return 'bg-emerald-500';
    if (s === 'completed') return 'bg-blue-500';
    if (s === 'draft') return 'bg-stone-400';
    return 'bg-amber-500';
  };

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-serif font-bold text-[#1A1208] tracking-tight">
            Ocupación en Tiempo Real
          </h1>
          <p className="text-sm text-stone-500 mt-1">
            Estado de todas las mesas por evento
          </p>
        </div>

        {/* Totals bar */}
        {totals && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Eventos</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">{totals.events}</p>
              <p className="text-xs text-stone-400">{totals.eventsWithPlan} con plano</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Plazas totales</p>
              <p className="text-2xl font-bold text-stone-800 mt-1">{totals.totalSeats}</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Ocupados</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{totals.totalOccupied}</p>
            </div>
            <div className="bg-white border border-stone-200 rounded-xl p-4">
              <p className="text-xs text-stone-500 uppercase tracking-wider">Libres</p>
              <p className="text-2xl font-bold text-amber-700 mt-1">{totals.totalSeats - totals.totalOccupied}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-16 text-stone-400 text-sm">Cargando ocupación...</div>
        )}

        {/* Events grid */}
        {!loading && events.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto rounded-full bg-stone-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <p className="text-stone-500 text-sm">No hay eventos activos con plano de mesas</p>
          </div>
        )}

        {/* Event cards */}
        <div className="grid gap-4">
          {events.map(event => (
            <Link
              key={event.id}
              href={`/admin/mapa-mesas?eventId=${event.id}`}
              className="block bg-white border border-stone-200 rounded-xl hover:border-[#C9A84C]/40 hover:shadow-md transition-all overflow-hidden group"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium text-stone-800 group-hover:text-[#C9A84C] transition-colors">
                      {event.clientName}
                    </h3>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-stone-500">
                      <span>{new Date(event.eventDate).toLocaleDateString('es-ES')}</span>
                      <span>{event.guestCount} invitados</span>
                      <span className={`px-2 py-0.5 rounded-full text-white text-[10px] font-medium ${statusColor(event.status)}`}>
                        {statusLabel(event.status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-lg font-bold font-mono ${event.occupancyPct >= 80 ? 'text-emerald-600' : event.occupancyPct >= 40 ? 'text-amber-600' : 'text-stone-400'}`}>
                      {event.occupancyPct}%
                    </span>
                    <p className="text-[10px] text-stone-400 uppercase tracking-wider">Ocupación</p>
                  </div>
                </div>

                {/* Barra de ocupación */}
                <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      event.occupancyPct >= 80 ? 'bg-emerald-500' :
                      event.occupancyPct >= 40 ? 'bg-amber-500' : 'bg-stone-300'
                    }`}
                    style={{ width: `${event.occupancyPct}%` }}
                  />
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <div className="text-center p-2 rounded-lg bg-stone-50">
                    <p className="text-sm font-bold text-stone-700">{event.totalTables}</p>
                    <p className="text-[10px] text-stone-400">Mesas</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-stone-50">
                    <p className="text-sm font-bold text-stone-700">{event.totalSeats}</p>
                    <p className="text-[10px] text-stone-400">Plazas</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-emerald-50">
                    <p className="text-sm font-bold text-emerald-700">{event.occupiedSeats}</p>
                    <p className="text-[10px] text-emerald-600">Ocupados</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-amber-50">
                    <p className="text-sm font-bold text-amber-700">{event.freeSeats}</p>
                    <p className="text-[10px] text-amber-600">Libres</p>
                  </div>
                </div>

                {event.assignedGuests > 0 && (
                  <div className="mt-2 text-xs text-stone-400 text-center">
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
      </div>
    </AdminLayout>
  );
}