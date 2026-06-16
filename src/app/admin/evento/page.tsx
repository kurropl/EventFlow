'use client';

/**
 * EventFlow — Lista de Eventos
 * Shows all events in a table with links to /admin/evento/[id] detail view.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/b2b/AdminLayout';
import StatusBadge from '@/components/b2b/StatusBadge';
import { CalendarDays, Users, ChevronRight, FolderOpen } from 'lucide-react';

/* ── Types ─────────────────────────────────────────────────────── */
interface EventItem {
  id: string;
  client_name: string;
  event_date: string | null;
  event_type: string | null;
  status: string;
  guest_count: number | null;
}

/* ── Helpers ────────────────────────────────────────────────────── */
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  return `${parseInt(day)}/${parseInt(m)}/${y}`;
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda',
  bautizo: 'Bautizo',
  communion: 'Comunion',
  comunio: 'Comunion',
  cumpleanos: 'Cumpleanos',
  empresa: 'Empresa',
  privado: 'Privado',
  other: 'Otro',
};

const formatEventType = (t: string | null) => {
  if (!t) return '—';
  return EVENT_TYPE_LABELS[t.toLowerCase()] || t.charAt(0).toUpperCase() + t.slice(1);
};

/* ── Loading Skeleton ───────────────────────────────────────────── */
function TableSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 bg-white/60 rounded-xl animate-pulse flex items-center px-5 gap-6">
          <div className="h-4 w-40 bg-[#C9A86A]/10 rounded" />
          <div className="h-4 w-24 bg-[#C9A86A]/10 rounded" />
          <div className="h-4 w-20 bg-[#C9A86A]/10 rounded" />
          <div className="h-5 w-16 bg-[#C9A86A]/10 rounded-full" />
          <div className="h-4 w-12 bg-[#C9A86A]/10 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ── Empty State ────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-[#C9A86A]/10 flex items-center justify-center mb-4">
        <FolderOpen className="w-7 h-7 text-[#C9A86A]" />
      </div>
      <p className="text-lg font-medium text-[#3F3A36] mb-1">No hay eventos</p>
      <p className="text-sm text-[#9CA3AF]">
        Los eventos apareceran aqui cuando se creen desde el formulario de reservas.
      </p>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   Main Page Component
   ══════════════════════════════════════════════════════════════════ */
export default function EventoListPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const res = await fetch('/api/events?limit=200');
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setEvents(json.data);
        } else {
          setError('Error al cargar eventos');
        }
      } catch {
        setError('Error de conexion');
      } finally {
        setLoading(false);
      }
    }
    fetchEvents();
  }, []);

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <CalendarDays className="w-6 h-6 text-[#C9A86A]" />
          <div>
            <h1 className="font-serif text-xl font-bold text-[#3F3A36]">
              Ficha Evento
            </h1>
            <p className="text-sm text-[#9CA3AF]">
              {loading ? 'Cargando...' : `${events.length} evento${events.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <TableSkeleton />
        ) : error ? (
          <div className="bg-white rounded-xl border border-red-200 p-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-sm">
            {/* Table Header */}
            <div className="grid grid-cols-[1fr_120px_120px_110px_80px_40px] gap-4 px-5 py-3 bg-[#F8F3E6] border-b border-stone-200 text-[11px] uppercase tracking-wider font-semibold text-[#9CA3AF]">
              <span>Cliente</span>
              <span>Fecha</span>
              <span>Tipo</span>
              <span>Estado</span>
              <span className="text-right">Invitados</span>
              <span />
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-stone-100">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/admin/evento/${event.id}`}
                  className="grid grid-cols-[1fr_120px_120px_110px_80px_40px] gap-4 px-5 py-3.5 items-center hover:bg-[#FAF8F5] transition-colors group"
                >
                  {/* Client Name */}
                  <span className="text-sm font-medium text-[#3F3A36] truncate">
                    {event.client_name || 'Sin nombre'}
                  </span>

                  {/* Event Date */}
                  <span className="text-sm text-[#6B6560] flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5 text-[#C9A86A] shrink-0" />
                    {fmtDate(event.event_date)}
                  </span>

                  {/* Event Type */}
                  <span className="text-sm text-[#6B6560]">
                    {formatEventType(event.event_type)}
                  </span>

                  {/* Status Badge */}
                  <StatusBadge status={event.status || 'draft'} />

                  {/* Guest Count */}
                  <span className="text-sm text-[#6B6560] text-right flex items-center justify-end gap-1">
                    <Users className="w-3.5 h-3.5 text-[#C9A86A] shrink-0" />
                    {event.guest_count ?? '—'}
                  </span>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-[#C9A86A]/50 group-hover:text-[#C9A86A] transition-colors justify-self-end" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
