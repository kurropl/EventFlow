'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatEUR, formatDate } from '@/lib/format';

// ============================================================
// Portal Home — Página principal del portal del cliente
// Resumen del evento, pagos, cuenta atrás y fecha de congelación
// ============================================================

interface PortalSummary {
  event: {
    eventId: string;
    clientName: string;
    eventType: string;
    eventDate: string;
    guestCount: number;
    kidsCount: number;
    venueType: string;
    location: string;
    status: string;
    totalPvp: number;
    totalPaid: number;
    pendingAmount: number;
  };
  milestones: Array<{
    id: string;
    kind: string;
    label: string;
    amount: number;
    due_date: string | null;
    status: string;
  }>;
  stats: {
    guests: {
      total: number;
      confirmed: number;
      pending: number;
      declined: number;
    };
    extras: number;
    unreadMessages: number;
  };
}

export default function PortalHomePage() {
  const params = useParams();
  const token = params.token as string;
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        const response = await fetch(`/api/portal/${token}/summary`);
        const data = await response.json();
        
        if (!data.success) {
          setError(data.error);
          return;
        }

        setSummary(data);
      } catch (err) {
        setError('Error al cargar el resumen');
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="text-center py-12">
        <p className="text-[#6B7280]">{error || 'Error al cargar datos'}</p>
      </div>
    );
  }

  const { event, milestones, stats } = summary;

  // Format event date
  const eventDateFormatted = event.eventDate
    ? new Date(event.eventDate).toLocaleDateString('es-ES', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'Por confirmar';

  // Calculate days until event
  const daysUntilEvent = event.eventDate
    ? Math.ceil((new Date(event.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Calculate freeze date (event_date - 14 days)
  const freezeDate = event.eventDate
    ? new Date(new Date(event.eventDate).getTime() - 14 * 24 * 60 * 60 * 1000)
    : null;

  // Get next milestone
  const nextMilestone = milestones.find(m => m.status === 'pendiente');

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-[#C9A84C] to-[#B8973D] rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">
          ¡Hola, {event.clientName}!
        </h2>
        <p className="text-white/90">
          Bienvenido a tu portal de {event.eventType}
        </p>
      </div>

      {/* Countdown */}
      {daysUntilEvent !== null && daysUntilEvent > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center">
          <p className="text-sm text-[#6B7280] mb-2">Faltan</p>
          <div className="text-5xl font-bold text-[#C9A84C] mb-2">
            {daysUntilEvent}
          </div>
          <p className="text-lg text-[#1A1A1A]">
            días para tu {event.eventType}
          </p>
          <p className="text-sm text-[#6B7280] mt-2">
            {eventDateFormatted}
          </p>
        </div>
      )}

      {/* Event details */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">
          Detalles del evento
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-[#6B7280]">Tipo</p>
            <p className="font-medium text-[#1A1A1A] capitalize">{event.eventType}</p>
          </div>
          <div>
            <p className="text-sm text-[#6B7280]">Fecha</p>
            <p className="font-medium text-[#1A1A1A]">{eventDateFormatted}</p>
          </div>
          <div>
            <p className="text-sm text-[#6B7280]">Invitados</p>
            <p className="font-medium text-[#1A1A1A]">
              {event.guestCount} personas
              {event.kidsCount > 0 && ` + ${event.kidsCount} niños`}
            </p>
          </div>
          <div>
            <p className="text-sm text-[#6B7280]">Ubicación</p>
            <p className="font-medium text-[#1A1A1A] capitalize">
              {event.venueType === 'benitez' ? 'Salón Benítez' : event.location || 'Externo'}
            </p>
          </div>
        </div>
      </div>

      {/* Payment summary */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <h3 className="text-lg font-semibold text-[#1A1A1A] mb-4">
          Estado de pagos
        </h3>
        
        <div className="space-y-4">
          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="text-[#6B7280]">Total del evento</span>
            <span className="text-xl font-bold text-[#1A1A1A]">
              {formatEUR(event.totalPvp)}
            </span>
          </div>

          {/* Paid */}
          <div className="flex justify-between items-center">
            <span className="text-[#6B7280]">Pagado</span>
            <span className="text-lg font-semibold text-green-600">
              {formatEUR(event.totalPaid)}
            </span>
          </div>

          {/* Pending */}
          {event.pendingAmount > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-[#6B7280]">Pendiente</span>
              <span className="text-lg font-semibold text-amber-600">
                {formatEUR(event.pendingAmount)}
              </span>
            </div>
          )}

          {/* Progress bar */}
          <div className="pt-2">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{
                  width: `${Math.min(100, (event.totalPaid / (event.totalPvp || 1)) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Next milestone */}
        {nextMilestone && (
          <div className="mt-6 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm font-medium text-amber-800 mb-1">
              Próximo pago: {nextMilestone.label}
            </p>
            <p className="text-lg font-bold text-amber-900">
              {formatEUR(nextMilestone.amount)}
            </p>
            {nextMilestone.due_date && (
              <p className="text-sm text-amber-700 mt-1">
                Fecha límite: {formatDate(nextMilestone.due_date)}
              </p>
            )}
          </div>
        )}

        <Link
          href={`/portal/${token}/payments`}
          className="block mt-4 text-center text-[#C9A84C] font-medium hover:underline"
        >
          Ver historial de pagos →
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          href={`/portal/${token}/guests`}
          className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center hover:border-[#C9A84C] transition-colors"
        >
          <div className="text-3xl font-bold text-[#C9A84C]">
            {stats.guests.confirmed}
          </div>
          <div className="text-sm text-[#6B7280]">Invitados confirmados</div>
          <div className="text-xs text-[#9CA3AF] mt-1">
            de {stats.guests.total} total
          </div>
        </Link>

        <Link
          href={`/portal/${token}/extras`}
          className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center hover:border-[#C9A84C] transition-colors"
        >
          <div className="text-3xl font-bold text-[#C9A84C]">
            {stats.extras}
          </div>
          <div className="text-sm text-[#6B7280]">Extras seleccionados</div>
        </Link>

        <Link
          href={`/portal/${token}/messages`}
          className="bg-white rounded-xl border border-[#E5E7EB] p-4 text-center hover:border-[#C9A84C] transition-colors relative"
        >
          <div className="text-3xl font-bold text-[#C9A84C]">
            {stats.unreadMessages}
          </div>
          <div className="text-sm text-[#6B7280]">Mensajes nuevos</div>
          {stats.unreadMessages > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">{stats.unreadMessages}</span>
            </div>
          )}
        </Link>
      </div>

      {/* Freeze date warning */}
      {freezeDate && freezeDate > new Date() && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-600 text-xl">⚠️</span>
            <div>
              <p className="font-medium text-amber-800">
                Fecha límite de cambios
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Las listas de invitados, mesas y menús se congelarán el{' '}
                <strong>
                  {freezeDate.toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </strong>
                . Asegúrate de completar todos los cambios antes de esa fecha.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
