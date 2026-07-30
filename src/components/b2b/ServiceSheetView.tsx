'use client';

/**
 * EventFlow — ServiceSheetView (WP-19)
 *
 * Vista de la Hoja de Servicio:
 * - Responsive (móvil-first)
 * - Sección de Timing / Cronograma
 * - Distribución por zonas (mesas)
 * - Turnos confirmados
 * - Resumen de dietas especiales
 * - Botón para imprimir/exportar PDF
 */

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TimingItem {
  id: string;
  title: string;
  description: string | null;
  planned_time: string | null;
  category: string;
  completed: boolean;
  sort_order: number;
}

interface TableGuest {
  guest_id: string | null;
  guest_name: string;
  seat_number: number;
  rsvp: string;
  menu_type: string;
  dietary: string[];
  dietary_notes: string | null;
}

interface TableZone {
  table_id: string;
  table_number: number;
  capacity: number;
  shape: string;
  guests: TableGuest[];
  dietary_summary: {
    total: number;
    by_type: Record<string, number>;
    special: { type: string; count: number; guests: string[] }[];
  };
}

interface ShiftAssignment {
  worker_name: string;
  worker_phone: string;
  position: number;
  confirmed_at: string;
}

interface ShiftInfo {
  id: string;
  role: string;
  slots_needed: number;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  uniform: string | null;
  notes: string | null;
  status: string;
  assigned: ShiftAssignment[];
}

interface DietarySpecial {
  type: string;
  count: number;
  guests: string[];
}

interface ServiceSheetData {
  event: {
    id: string;
    name: string;
    date: string | null;
    guest_count: number;
    kids_count: number;
    venue_type: string;
    location: string | null;
    status: string;
    service_type: string;
  };
  timing: TimingItem[];
  zones: TableZone[];
  shifts: ShiftInfo[];
  dietary_overview: {
    total_guests: number;
    confirmed: number;
    pending: number;
    rejected: number;
    by_menu_type: Record<string, number>;
    special_diets: DietarySpecial[];
  };
  generated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmtDate(d: string | null) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return d;
  return date.toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function fmtTime(t: string | null) {
  if (!t) return '—';
  // Handle ISO timestamps
  if (t.includes('T')) {
    const d = new Date(t);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  // Handle plain "HH:MM"
  return t;
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const DIET_COLORS: Record<string, string> = {
  celiaco: 'bg-amber-100 text-amber-800 border-amber-300',
  celíaco: 'bg-amber-100 text-amber-800 border-amber-300',
  vegetariano: 'bg-green-100 text-green-800 border-green-300',
  vegano: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  sin_gluten: 'bg-orange-100 text-orange-800 border-orange-300',
  'sin gluten': 'bg-orange-100 text-orange-800 border-orange-300',
  lactosa: 'bg-blue-100 text-blue-800 border-blue-300',
  'sin lactosa': 'bg-blue-100 text-blue-800 border-blue-300',
  alergia_frutos: 'bg-red-100 text-red-800 border-red-300',
};

function getDietClass(type: string): string {
  const lower = type.toLowerCase();
  return DIET_COLORS[lower] || 'bg-gray-100 text-gray-700 border-gray-300';
}

/* ------------------------------------------------------------------ */
/*  Section: Timing                                                    */
/* ------------------------------------------------------------------ */

function TimingSection({ timing }: { timing: TimingItem[] }) {
  if (timing.length === 0) {
    return (
      <div className="text-center py-6 text-ink-soft-60 text-sm">
        Sin cronograma definido
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {timing.map((item) => (
        <div
          key={item.id}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            item.completed
              ? 'bg-success/5 border-success/20'
              : 'bg-white border-gold/20'
          }`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {item.completed ? (
              <div className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
                <Icon name="check" className="w-3 h-3 text-white" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-gold/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span
                className={`font-medium text-sm ${
                  item.completed ? 'line-through text-ink-soft-60' : 'text-ink'
                }`}
              >
                {item.title}
              </span>
              {item.planned_time && (
                <span className="flex-shrink-0 text-xs font-mono text-gold bg-gold/10 px-2 py-0.5 rounded">
                  {fmtTime(item.planned_time)}
                </span>
              )}
            </div>
            {item.description && (
              <p className="text-xs text-ink-soft-60 mt-1">{item.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Zones (Mesas)                                             */
/* ------------------------------------------------------------------ */

function ZonesSection({ zones }: { zones: TableZone[] }) {
  if (zones.length === 0) {
    return (
      <div className="text-center py-6 text-ink-soft-60 text-sm">
        Sin mesas asignadas
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {zones.map((zone) => (
        <div
          key={zone.table_id}
          className="rounded-xl border border-gold/20 bg-white overflow-hidden"
        >
          {/* Mesa header */}
          <div className="px-3 py-2 bg-cream-dark border-b border-gold/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="table" className="w-4 h-4 text-gold" />
              <span className="font-semibold text-sm text-ink">
                Mesa {zone.table_number}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-ink-soft-60">
                {zone.guests.length}/{zone.capacity}
              </span>
              {zone.dietary_summary.special.length > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-medium">
                  <Icon name="alertCircle" className="w-2.5 h-2.5" />
                  {zone.dietary_summary.special.length} dieta{zone.dietary_summary.special.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Guest list */}
          {zone.guests.length === 0 ? (
            <p className="p-3 text-xs text-ink-soft-60 italic">Sin invitados asignados</p>
          ) : (
            <div className="divide-y divide-gold/10">
              {zone.guests.map((guest, idx) => (
                <div
                  key={guest.guest_id || idx}
                  className="px-3 py-2 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-ink-soft-60 font-mono w-5 text-center">
                      {guest.seat_number || idx + 1}
                    </span>
                    <span className="text-sm text-ink truncate">{guest.guest_name}</span>
                    {guest.rsvp === 'confirmado' && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-success" />
                    )}
                    {guest.rsvp === 'rechazado' && (
                      <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {guest.menu_type && guest.menu_type !== 'adulto' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-cream-dark text-ink-soft-60 font-medium">
                        {guest.menu_type === 'nino' ? '👶 Niño' : '🍼 Bebé'}
                      </span>
                    )}
                    {guest.dietary.map((d, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getDietClass(d)}`}
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Dietary summary for this table */}
          {zone.dietary_summary.special.length > 0 && (
            <div className="px-3 py-2 bg-amber-50 border-t border-amber-200">
              <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-1">
                Dietas especiales en esta mesa
              </p>
              <div className="flex flex-wrap gap-1">
                {zone.dietary_summary.special.map((s, i) => (
                  <span
                    key={i}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getDietClass(s.type)}`}
                  >
                    {s.type}: {s.guests.join(', ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Shifts (Turnos)                                           */
/* ------------------------------------------------------------------ */

function ShiftsSection({ shifts }: { shifts: ShiftInfo[] }) {
  if (shifts.length === 0) {
    return (
      <div className="text-center py-6 text-ink-soft-60 text-sm">
        Sin turnos planificados
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {shifts.map((shift) => {
        const assigned = shift.assigned.length;
        const needed = shift.slots_needed;
        const filled = assigned >= needed;

        return (
          <div
            key={shift.id}
            className={`rounded-xl border overflow-hidden ${
              filled
                ? 'border-success/30 bg-success/5'
                : 'border-gold/20 bg-white'
            }`}
          >
            {/* Shift header */}
            <div className="px-3 py-2 border-b border-gold/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="users" className="w-4 h-4 text-gold" />
                <span className="font-semibold text-sm text-ink capitalize">{shift.role}</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`font-mono px-2 py-0.5 rounded ${
                    filled
                      ? 'bg-success/20 text-success'
                      : 'bg-warning/20 text-warning'
                  }`}
                >
                  {assigned}/{needed}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    shift.status === 'filled'
                      ? 'bg-success/20 text-success'
                      : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {shift.status === 'filled' ? 'Completo' : 'Abierto'}
                </span>
              </div>
            </div>

            {/* Shift details */}
            <div className="px-3 py-2 space-y-1">
              <div className="flex items-center gap-4 text-xs text-ink-soft-60">
                {shift.start_time && (
                  <span className="flex items-center gap-1">
                    <Icon name="clock" className="w-3 h-3" />
                    {fmtTime(shift.start_time)} — {fmtTime(shift.end_time)}
                  </span>
                )}
                {shift.location && (
                  <span className="flex items-center gap-1">
                    <Icon name="pin" className="w-3 h-3" />
                    {shift.location}
                  </span>
                )}
              </div>
              {shift.uniform && (
                <p className="text-xs text-ink-soft-60">
                  <Icon name="shirt" className="w-3 h-3 inline mr-1" />
                  {shift.uniform}
                </p>
              )}
              {shift.notes && (
                <p className="text-xs text-ink-soft-60 italic">{shift.notes}</p>
              )}
            </div>

            {/* Assigned workers */}
            {shift.assigned.length > 0 && (
              <div className="px-3 py-2 border-t border-gold/10 bg-cream-dark/30">
                <p className="text-[10px] font-semibold text-ink-soft-60 uppercase tracking-wider mb-1">
                  Asignados
                </p>
                <div className="flex flex-wrap gap-1">
                  {shift.assigned.map((a, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-white border border-gold/20"
                    >
                      <span className="w-4 h-4 rounded-full bg-gold/20 flex items-center justify-center text-[9px] font-bold text-gold">
                        {a.position}
                      </span>
                      <span className="text-ink">{a.worker_name}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section: Dietary Overview                                          */
/* ------------------------------------------------------------------ */

function DietaryOverviewSection({
  overview,
}: {
  overview: ServiceSheetData['dietary_overview'];
}) {
  return (
    <div className="space-y-3">
      {/* RSVP Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-success/10 p-3 text-center">
          <p className="text-lg font-bold text-success">{overview.confirmed}</p>
          <p className="text-[10px] text-ink-soft-60 uppercase tracking-wider">Confirmados</p>
        </div>
        <div className="rounded-lg bg-warning/10 p-3 text-center">
          <p className="text-lg font-bold text-warning">{overview.pending}</p>
          <p className="text-[10px] text-ink-soft-60 uppercase tracking-wider">Pendientes</p>
        </div>
        <div className="rounded-lg bg-red-50 p-3 text-center">
          <p className="text-lg font-bold text-red-500">{overview.rejected}</p>
          <p className="text-[10px] text-ink-soft-60 uppercase tracking-wider">Rechazados</p>
        </div>
      </div>

      {/* Menu types */}
      {Object.keys(overview.by_menu_type).length > 0 && (
        <div className="rounded-lg border border-gold/20 bg-white p-3">
          <p className="text-[10px] font-semibold text-ink-soft-60 uppercase tracking-wider mb-2">
            Por tipo de menú
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(overview.by_menu_type).map(([type, count]) => (
              <span
                key={type}
                className="text-xs px-2 py-1 rounded-lg bg-cream-dark text-ink"
              >
                {type === 'adulto' ? '🍽️ Adulto' : type === 'nino' ? '👶 Niño' : '🍼 Bebé'}:{' '}
                <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Special diets */}
      {overview.special_diets.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-2">
            ⚠️ Dietas especiales ({overview.special_diets.reduce((s, d) => s + d.count, 0)} personas)
          </p>
          <div className="space-y-1.5">
            {overview.special_diets.map((diet, i) => (
              <div key={i} className="flex items-start gap-2">
                <span
                  className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-medium ${getDietClass(
                    diet.type
                  )}`}
                >
                  {diet.type}
                </span>
                <span className="text-xs text-ink-soft-60">
                  {diet.guests.join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {overview.special_diets.length === 0 &&
        Object.keys(overview.by_menu_type).length <= 1 && (
          <div className="text-center py-4 text-ink-soft-60 text-sm">
            Sin dietas especiales registradas
          </div>
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

type Section = 'timing' | 'zones' | 'shifts' | 'dietary';

interface ServiceSheetViewProps {
  eventId: string;
  onBack?: () => void;
}

export default function ServiceSheetView({ eventId, onBack }: ServiceSheetViewProps) {
  const [data, setData] = useState<ServiceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<Section>('timing');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/cocina/event/${eventId}/service-sheet`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Error al cargar');
      }
    } catch {
      setError('Error de conexión');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-8 w-48 bg-cream-dark rounded" />
        <div className="h-12 bg-cream-dark rounded-xl" />
        <div className="h-32 bg-cream-dark rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-center">
        <Icon name="alertCircle" className="w-8 h-8 text-ink-soft-60 mx-auto mb-3" />
        <p className="text-sm text-ink-soft-60">{error || 'No se pudieron cargar los datos'}</p>
        <button
          onClick={fetchData}
          className="mt-3 text-xs text-gold hover:text-gold-dark font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  const sections: { id: Section; label: string; icon: string; count?: number }[] = [
    { id: 'timing', label: 'Timing', icon: 'clock', count: data.timing.length },
    { id: 'zones', label: 'Mesas', icon: 'table', count: data.zones.length },
    { id: 'shifts', label: 'Turnos', icon: 'users', count: data.shifts.length },
    { id: 'dietary', label: 'Dietas', icon: 'alertCircle', count: data.dietary_overview.special_diets.length },
  ];

  return (
    <div className="min-h-screen bg-cream">
      {/* Print header (hidden on screen) */}
      <div className="hidden print:block mb-6 border-b-2 border-ink pb-4">
        <h1 className="text-xl font-bold text-ink">HOJA DE SERVICIO</h1>
        <p className="text-sm text-ink-soft-60">
          {data.event.name} · {fmtDate(data.event.date)} · {data.event.guest_count} pax
        </p>
      </div>

      {/* Screen header */}
      <div className="no-print sticky top-0 z-10 bg-cream border-b border-gold/20 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 rounded-lg hover:bg-white transition-colors text-ink-soft"
              >
                <Icon name="arrowLeft" className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-sm font-semibold text-ink">Hoja de Servicio</h2>
              <p className="text-[10px] text-ink-soft-60">{data.event.name}</p>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-medium hover:opacity-90 transition-opacity"
          >
            <Icon name="printer" className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Event summary card */}
      <div className="px-4 py-3">
        <div className="rounded-xl border border-gold/20 bg-white p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink">{data.event.name}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/20 text-gold font-medium">
              {data.event.venue_type === 'externo' ? '🏠 Externo' : '🏢 Benítez'}
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-soft-60">
            <span className="flex items-center gap-1">
              <Icon name="calendar" className="w-3 h-3" />
              {fmtDate(data.event.date)}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="users" className="w-3 h-3" />
              {data.event.guest_count} pax
              {data.event.kids_count > 0 && ` (${data.event.kids_count} niños)`}
            </span>
          </div>
          {data.event.location && (
            <p className="text-xs text-ink-soft-60 flex items-center gap-1">
              <Icon name="pin" className="w-3 h-3" />
              {data.event.location}
            </p>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div className="no-print px-4 pb-2">
        <div className="flex gap-1 p-1 rounded-lg bg-cream-dark border border-gold/20">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-md text-xs font-medium transition-all ${
                activeSection === s.id
                  ? 'bg-gold text-black shadow-sm'
                  : 'text-ink-soft hover:text-ink hover:bg-white'
              }`}
            >
              <Icon name={s.icon} className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{s.label}</span>
              {s.count !== undefined && s.count > 0 && (
                <span
                  className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                    activeSection === s.id
                      ? 'bg-black/10 text-black'
                      : 'bg-gold/20 text-gold'
                  }`}
                >
                  {s.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Section content (screen: active section only) */}
      <div className="px-4 py-2 print:hidden">
        {activeSection === 'timing' && <TimingSection timing={data.timing} />}
        {activeSection === 'zones' && <ZonesSection zones={data.zones} />}
        {activeSection === 'shifts' && <ShiftsSection shifts={data.shifts} />}
        {activeSection === 'dietary' && <DietaryOverviewSection overview={data.dietary_overview} />}
      </div>

      {/* Print: show ALL sections */}
      <div className="hidden print:block px-4 space-y-6">
        <div className="border-b border-ink/20 pb-3">
          <h3 className="text-sm font-bold text-ink mb-2 uppercase tracking-wider">
            ⏰ Timing / Cronograma
          </h3>
          <TimingSection timing={data.timing} />
        </div>
        <div className="border-b border-ink/20 pb-3">
          <h3 className="text-sm font-bold text-ink mb-2 uppercase tracking-wider">
            🪑 Distribución por Mesas
          </h3>
          <ZonesSection zones={data.zones} />
        </div>
        <div className="border-b border-ink/20 pb-3">
          <h3 className="text-sm font-bold text-ink mb-2 uppercase tracking-wider">
            👥 Turnos Confirmados
          </h3>
          <ShiftsSection shifts={data.shifts} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-ink mb-2 uppercase tracking-wider">
            🍽️ Dietas Especiales
          </h3>
          <DietaryOverviewSection overview={data.dietary_overview} />
        </div>
      </div>

      {/* Print footer */}
      <div className="hidden print:block mt-6 pt-4 border-t border-ink/20 text-center">
        <p className="text-[10px] text-ink-soft-60">
          Generado: {fmtDateTime(data.generated_at)} · EventFlow
        </p>
      </div>

      {/* Print: all sections hidden on screen, shown when printing */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:hidden { display: none !important; }
          body { background: white; }
          .min-h-screen { min-height: auto; }
        }
      `}</style>
    </div>
  );
}
