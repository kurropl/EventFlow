'use client';
/**
 * EventFlow — Kanban Pipeline (B2B)
 * 
 * Drag & drop board for events: Nuevo → Propuesta Enviada → Confirmado
 * Shows event summary WITHOUT prices (prices are calculated server-side)
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

type EventStatus = 'nuevo' | 'propuesta' | 'confirmado' | 'cancelado';

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

const COLUMNS: { status: EventStatus; label: string; color: string; icon: string }[] = [
  { status: 'nuevo', label: 'Nuevo', color: 'border-blue-500/40 bg-blue-500/5', icon: '🆕' },
  { status: 'propuesta', label: 'Propuesta Enviada', color: 'border-amber-500/40 bg-amber-500/5', icon: '📤' },
  { status: 'confirmado', label: 'Confirmado', color: 'border-green-500/40 bg-green-500/5', icon: '✅' },
  { status: 'cancelado', label: 'Cancelado', color: 'border-red-500/40 bg-red-500/5', icon: '❌' },
];

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro',
};

// Mock data for demo
const MOCK_EVENTS: KanbanEvent[] = [
  {
    id: 'evt-1', client_name: 'María García', client_email: 'maria@email.com',
    event_type: 'boda', guest_count: 150, kids_count: 10, event_date: '2025-09-15',
    status: 'nuevo', selected_items: [{ name: 'Carrillera a baja temperatura', category: 'carne', quantity: 150 }],
    bar_hours: 3, notes: null, created_at: '2025-05-18T10:00:00Z',
  },
  {
    id: 'evt-2', client_name: 'Carlos López', client_email: 'carlos@empresa.com',
    event_type: 'corporativo', guest_count: 80, kids_count: 0, event_date: '2025-07-20',
    status: 'propuesta', selected_items: [{ name: 'Presa a la brasa', category: 'carne', quantity: 80 }],
    bar_hours: 2, notes: 'Evento de empresa', created_at: '2025-05-15T14:30:00Z',
  },
  {
    id: 'evt-3', client_name: 'Ana Martínez', client_email: 'ana@email.com',
    event_type: 'comunion', guest_count: 200, kids_count: 50, event_date: '2025-08-10',
    status: 'confirmado', selected_items: [{ name: 'Merluza gratinada', category: 'pescado', quantity: 200 }],
    bar_hours: 3, notes: null, created_at: '2025-05-10T09:00:00Z',
  },
];

export default function KanbanPipeline() {
  const [events, setEvents] = useState<KanbanEvent[]>(MOCK_EVENTS);

  const moveEvent = (eventId: string, fromStatus: EventStatus, toStatus: EventStatus) => {
    setEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, status: toStatus } : e))
    );
  };

  const getEventsByStatus = (status: EventStatus) =>
    events.filter((e) => e.status === status);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-140px)]">
      {COLUMNS.map((col) => (
        <div
          key={col.status}
          className={`flex-shrink-0 w-72 rounded-xl border-2 ${col.color} flex flex-col max-h-[calc(100vh-160px)]`}
        >
          {/* Column header */}
          <div className="p-4 border-b border-gold/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{col.icon}</span>
              <span className="text-cream font-medium text-sm">{col.label}</span>
              <span className="text-xs text-cream/40 bg-ink/30 px-2 py-0.5 rounded-full">
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
                  <span className="text-xs bg-gold/10 text-gold px-2 py-0.5 rounded-full">
                    {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                  </span>
                </div>

                {/* Event details */}
                <div className="space-y-1 text-xs text-cream/50 mb-3">
                  <div className="flex justify-between">
                    <span>📅 {event.event_date}</span>
                    <span>{event.guest_count} pax</span>
                  </div>
                  {event.kids_count > 0 && (
                    <div className="flex justify-between">
                      <span>👶 Niños:</span>
                      <span>{event.kids_count}</span>
                    </div>
                  )}
                  {event.bar_hours > 0 && (
                    <div className="flex justify-between">
                      <span>🍸 Barra:</span>
                      <span>{event.bar_hours}h</span>
                    </div>
                  )}
                </div>

                {/* Selected items preview */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {event.selected_items.slice(0, 2).map((item, j) => (
                    <span key={j} className="text-[10px] bg-cream/5 text-cream/40 px-1.5 py-0.5 rounded">
                      {item.name}
                    </span>
                  ))}
                  {event.selected_items.length > 2 && (
                    <span className="text-[10px] text-cream/30">+{event.selected_items.length - 2}</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {col.status !== 'nuevo' && col.status !== 'cancelado' && (
                    <button
                      onClick={() => {
                        const idx = COLUMNS.findIndex((c) => c.status === col.status);
                        moveEvent(event.id, col.status, COLUMNS[idx - 1].status);
                      }}
                      className="flex-1 text-xs bg-cream/5 text-cream/40 hover:bg-cream/10 py-1 rounded transition-colors"
                    >
                      ←
                    </button>
                  )}
                  {col.status !== 'confirmado' && col.status !== 'cancelado' && (
                    <button
                      onClick={() => {
                        const idx = COLUMNS.findIndex((c) => c.status === col.status);
                        moveEvent(event.id, col.status, COLUMNS[idx + 1].status);
                      }}
                      className="flex-1 text-xs bg-gold/10 text-gold hover:bg-gold/20 py-1 rounded transition-colors"
                    >
                      →
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
