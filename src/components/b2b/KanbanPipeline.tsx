'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

type EventStatus = 'nuevo' | 'propuesta_enviada' | 'confirmado' | 'cancelado';

interface KanbanEvent {
  id: string;
  client_name: string;
  client_email: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  event_date: string;
  status: EventStatus;
  selected_items: Array<{ name: string; category: string; quantity: number }>;
  bar_hours: number;
  notes: string | null;
  created_at: string;
}

const COLUMNS: { status: EventStatus; label: string; accent: string }[] = [
  { status: 'nuevo', label: 'Nuevo', accent: 'border-l-blue-500 bg-blue-500/5' },
  { status: 'propuesta_enviada', label: 'Propuesta Enviada', accent: 'border-l-amber-500 bg-amber-500/5' },
  { status: 'confirmado', label: 'Confirmado', accent: 'border-l-green-500 bg-green-500/5' },
  { status: 'cancelado', label: 'Cancelado', accent: 'border-l-red-500 bg-red-500/5' },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro',
};

const statusOrder: EventStatus[] = ['nuevo', 'propuesta_enviada', 'confirmado', 'cancelado'];

const DEMO_EVENTS: KanbanEvent[] = [
  {
    id: 'demo-1', client_name: 'María García', client_email: 'maria@email.com',
    event_type: 'boda', guest_count: 150, kids_count: 10, event_date: '2025-09-15',
    status: 'nuevo', selected_items: [{ name: 'Carrillera a baja temperatura', category: 'carne', quantity: 150 }],
    bar_hours: 3, notes: null, created_at: '2025-05-18T10:00:00Z',
  },
  {
    id: 'demo-2', client_name: 'Carlos López', client_email: 'carlos@empresa.com',
    event_type: 'corporativo', guest_count: 80, kids_count: 0, event_date: '2025-07-20',
    status: 'propuesta_enviada', selected_items: [{ name: 'Presa a la brasa', category: 'carne', quantity: 80 }],
    bar_hours: 2, notes: 'Evento de empresa', created_at: '2025-05-15T14:30:00Z',
  },
  {
    id: 'demo-3', client_name: 'Ana Martínez', client_email: 'ana@email.com',
    event_type: 'comunión', guest_count: 200, kids_count: 50, event_date: '2025-08-10',
    status: 'confirmado', selected_items: [{ name: 'Merluza gratinada', category: 'pescado', quantity: 200 }],
    bar_hours: 3, notes: null, created_at: '2025-05-10T09:00:00Z',
  },
];

function formatDate(d: string) {
  if (!d) return '';
  return d.slice(0, 10);
}

export default function KanbanPipeline() {
  const [events, setEvents] = useState<KanbanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/events?limit=200');
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.success && Array.isArray(data.data) && data.data.length > 0) {
          setEvents(data.data.map((e: any) => ({ ...e, selected_items: e.selected_items ?? [] })));
          setIsDemo(false);
        } else {
          setEvents(DEMO_EVENTS);
          setIsDemo(true);
        }
      } catch {
        if (!cancelled) { setEvents(DEMO_EVENTS); setIsDemo(true); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const moveEvent = useCallback(async (eventId: string, toStatus: EventStatus) => {
    setEvents((prev) => prev.map((e) => (e.id === eventId ? { ...e, status: toStatus } : e)));
    // Persist only real (DB) events
    if (!eventId.startsWith('demo-')) {
      try {
        await fetch(`/api/events/${eventId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: toStatus }),
        });
      } catch { /* keep optimistic update */ }
    }
  }, []);

  const getEventsByStatus = (status: EventStatus) => events.filter((e) => e.status === status);

  return (
    <div className="space-y-3">
      {(isDemo || loading) && (
        <p className="text-xs text-cream/40">
          {loading ? 'Cargando presupuestos…' : 'Mostrando datos de demostración (aún no hay presupuestos reales).'}
        </p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-160px)]">
        {COLUMNS.map((col) => (
          <div key={col.status} className={`flex-shrink-0 w-72 rounded-xl border-l-2 border border-gold/10 ${col.accent} flex flex-col max-h-[calc(100vh-180px)]`}>
            {/* Column header */}
            <div className="px-4 py-3 border-b border-gold/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-cream font-medium text-sm">{col.label}</span>
                <span className="text-[10px] text-cream/40 bg-ink/40 px-2 py-0.5 rounded-full font-mono">
                  {getEventsByStatus(col.status).length}
                </span>
              </div>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {getEventsByStatus(col.status).map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-ink-900/60 rounded-lg p-3 border border-gold/10 hover:border-gold/30 transition-colors cursor-pointer group"
                >
                  {/* Client info */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-cream text-sm font-medium">{event.client_name}</h4>
                      <p className="text-cream/40 text-xs">{event.client_email}</p>
                    </div>
                    <span className="text-[10px] bg-gold/10 text-gold px-2 py-0.5 rounded-full whitespace-nowrap">
                      {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                    </span>
                  </div>

                  {/* Event details */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-cream/50 mb-3">
                    <span className="text-cream/30">{formatDate(event.event_date)}</span>
                    <span className="text-right">{event.guest_count} adultos</span>
                    {event.kids_count > 0 && (
                      <>
                        <span className="text-cream/30">Infantil</span>
                        <span className="text-right">{event.kids_count}</span>
                      </>
                    )}
                    {event.bar_hours > 0 && (
                      <>
                        <span className="text-cream/30">Barra libre</span>
                        <span className="text-right">{event.bar_hours}h</span>
                      </>
                    )}
                  </div>

                  {/* Selected items preview */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {(event.selected_items || []).slice(0, 2).map((item, j) => (
                      <span key={j} className="text-[10px] bg-cream/5 text-cream/40 px-1.5 py-0.5 rounded">
                        {item.name}
                      </span>
                    ))}
                    {(event.selected_items || []).length > 2 && (
                      <span className="text-[10px] text-cream/30">+{event.selected_items.length - 2}</span>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {col.status !== 'nuevo' && col.status !== 'cancelado' && (
                      <button onClick={() => {
                        const idx = statusOrder.indexOf(col.status);
                        moveEvent(event.id, statusOrder[idx - 1]);
                      }}
                        className="flex-1 text-xs bg-cream/5 text-cream/40 hover:bg-cream/10 py-1 rounded transition-colors">
                        Retroceder
                      </button>
                    )}
                    {col.status !== 'confirmado' && col.status !== 'cancelado' && (
                      <button onClick={() => {
                        const idx = statusOrder.indexOf(col.status);
                        moveEvent(event.id, statusOrder[idx + 1]);
                      }}
                        className="flex-1 text-xs bg-gold/10 text-gold hover:bg-gold/20 py-1 rounded transition-colors">
                        Avanzar
                      </button>
                    )}
                    {col.status !== 'cancelado' && (
                      <button onClick={() => moveEvent(event.id, 'cancelado')}
                        className="text-xs bg-red-500/10 text-red-400/70 hover:bg-red-500/20 px-2 py-1 rounded transition-colors">
                        ✕
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
