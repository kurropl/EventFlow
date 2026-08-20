'use client';

/**
 * Dashboard de Confirmación — Invitados vs Mesas
 *
 * Muestra todos los eventos próximos con:
 * - Nº invitados confirmados / total esperados
 * - Mesas disponibles / capacidad total
 * - Alerta si sobran o faltan mesas
 *
 * J.Benitez — EventFlow ERP
 */

import { useState, useEffect } from 'react';
import { Users, Table, CalendarDays, AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { calcMesas } from '@/lib/operations';
import { formatDate } from '@/lib/format';

export default function ConfirmacionDashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/events/light');
        const data = await res.json();
        setEvents(data.data || []);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 rounded-full border-2 border-stone-300 border-t-stone-600 animate-spin" />
    </div>
  );

  const upcoming = events
    .filter((e: any) => e.status === 'accepted' || e.status === 'presupuestado')
    .sort((a: any, b: any) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());

  if (upcoming.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400 text-sm">
        No hay eventos próximos en estado aceptado/presupuestado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {upcoming.map((ev: any) => {
        const confirmed = Number(ev.confirmed_guests || 0);
        const totalGuests = Number(ev.guest_count || 0);
        const totalTables = Number(ev.total_tables || 0);
        const totalCapacity = Number(ev.total_capacity || 0);
        const tablesNeeded = calcMesas(totalGuests);
        const tablesDiff = totalTables - tablesNeeded;
        const capacityPercent = totalGuests > 0 ? Math.round((confirmed / totalGuests) * 100) : 0;
        const enoughTables = tablesDiff >= 0;

        return (
          <Link key={ev.id} href={`/admin/evento?id=${ev.id}`}
            className="block bg-white border border-stone-200 rounded-xl p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-stone-800">{ev.client_name}</h3>
                <p className="text-xs text-stone-500 flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {formatDate(ev.event_date)} — {ev.event_type}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              {/* Invitados */}
              <div className={`p-3 rounded-lg border ${capacityPercent >= 80 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-1 mb-1">
                  <Users className="w-3.5 h-3.5 text-stone-500" />
                  <span className="font-medium text-stone-600">Invitados</span>
                </div>
                <p className="text-lg font-bold font-mono">{confirmed} / {totalGuests}</p>
                <p className="text-[10px] text-stone-500">{capacityPercent}% confirmados</p>
              </div>

              {/* Mesas */}
              <div className={`p-3 rounded-lg border ${enoughTables ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center gap-1 mb-1">
                  <Table className="w-3.5 h-3.5 text-stone-500" />
                  <span className="font-medium text-stone-600">Mesas</span>
                </div>
                <p className="text-lg font-bold font-mono">{totalTables} disp / {tablesNeeded} req</p>
                <p className="text-[10px] text-stone-500">{totalCapacity} plazas totales</p>
              </div>

              {/* Estado */}
              <div className="p-3 rounded-lg border border-stone-200">
                <div className="flex items-center gap-1 mb-1">
                  {enoughTables ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  )}
                  <span className="font-medium text-stone-600">Estado</span>
                </div>
                {enoughTables ? (
                  <p className="text-sm font-medium text-emerald-700">OK {tablesDiff} mesas libres</p>
                ) : (
                  <p className="text-sm font-medium text-red-700">Faltan {Math.abs(tablesDiff)} mesas</p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
