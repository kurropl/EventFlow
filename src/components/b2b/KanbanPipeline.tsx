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

const COLUMNS: { status: EventStatus; label: string; dot: string; tint: string; soft: string }[] = [
  { status: 'nuevo', label: 'Nuevo', dot: '#3B82F6', tint: '#EFF4FF', soft: '#DCE7FF' },
  { status: 'propuesta_enviada', label: 'Propuesta enviada', dot: '#D9920B', tint: '#FFF8EC', soft: '#FBE8C4' },
  { status: 'confirmado', label: 'Confirmado', dot: '#16A34A', tint: '#EFFAF2', soft: '#CDEBD6' },
  { status: 'cancelado', label: 'Cancelado', dot: '#DC2626', tint: '#FEF3F3', soft: '#F6D6D6' },
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
  const iso = d.slice(0, 10);
  const [y, m, day] = iso.split('-');
  if (!y || !m || !day) return iso;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
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

  const totalGuests = events.filter((e) => e.status !== 'cancelado').reduce((s, e) => s + (e.guest_count || 0), 0);
  const confirmedCount = getEventsByStatus('confirmado').length;
  const activeCount = events.filter((e) => e.status !== 'cancelado').length;

  const STATS = [
    { label: 'Presupuestos activos', value: activeCount, accent: '#C9A84C' },
    { label: 'Nuevos', value: getEventsByStatus('nuevo').length, accent: '#3B82F6' },
    { label: 'Confirmados', value: confirmedCount, accent: '#16A34A' },
    { label: 'Comensales (total)', value: totalGuests, accent: '#6B2737' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: s.accent }} />
              <span className="text-[12px] text-[#6B7280]">{s.label}</span>
            </div>
            <div className="text-2xl font-semibold text-[#1A1A1A] tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      {isDemo && !loading && (
        <p className="text-xs text-[#9CA3AF]">Mostrando datos de demostración (aún no hay presupuestos reales).</p>
      )}
      {loading && <p className="text-xs text-[#9CA3AF]">Cargando presupuestos…</p>}

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const colEvents = getEventsByStatus(col.status);
          return (
            <div key={col.status} className="flex-shrink-0 w-[300px] flex flex-col rounded-2xl bg-[#FAFAFC] border border-[#ECECF1] max-h-[calc(100vh-280px)]">
              {/* Column header */}
              <div className="px-4 py-3 flex items-center justify-between rounded-t-2xl" style={{ background: col.tint }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: col.dot }} />
                  <span className="text-[13px] font-semibold text-[#374151]">{col.label}</span>
                </div>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-white/70 text-[#6B7280]">
                  {colEvents.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                {colEvents.length === 0 && (
                  <div className="text-center text-[12px] text-[#B0B0B8] py-8">Sin presupuestos</div>
                )}
                {colEvents.map((event, i) => (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3) }}
                    className="bg-white rounded-xl p-3.5 border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)] hover:border-[#E0D3A8] transition-all cursor-pointer group"
                  >
                    {/* Client */}
                    <div className="flex items-start gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                        {initials(event.client_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-[13px] font-semibold text-[#1A1A1A] leading-tight truncate">{event.client_name}</h4>
                        <p className="text-[11px] text-[#9CA3AF] truncate">{event.client_email}</p>
                      </div>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#FBF6E9] text-[#A88A3A] whitespace-nowrap">
                        {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#6B7280] mb-3">
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3 text-[#B0B0B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                        {formatDate(event.event_date)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <svg className="w-3 h-3 text-[#B0B0B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                        {event.guest_count}{event.kids_count > 0 ? ` +${event.kids_count}` : ''}
                      </span>
                      {event.bar_hours > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <svg className="w-3 h-3 text-[#B0B0B8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                          {event.bar_hours}h barra
                        </span>
                      )}
                    </div>

                    {/* Items preview */}
                    {(event.selected_items || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {(event.selected_items || []).slice(0, 2).map((item, j) => (
                          <span key={j} className="text-[10px] bg-[#F5F5F8] text-[#6B7280] px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                            {item.name}
                          </span>
                        ))}
                        {(event.selected_items || []).length > 2 && (
                          <span className="text-[10px] text-[#B0B0B8] px-1">+{event.selected_items.length - 2}</span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {col.status !== 'nuevo' && col.status !== 'cancelado' && (
                        <button onClick={() => moveEvent(event.id, statusOrder[statusOrder.indexOf(col.status) - 1])}
                          className="flex-1 text-[11px] font-medium bg-[#F5F5F8] text-[#6B7280] hover:bg-[#ECECF1] py-1.5 rounded-lg transition-colors">
                          ← Atrás
                        </button>
                      )}
                      {col.status !== 'confirmado' && col.status !== 'cancelado' && (
                        <button onClick={() => moveEvent(event.id, statusOrder[statusOrder.indexOf(col.status) + 1])}
                          className="flex-1 text-[11px] font-medium bg-[#FBF6E9] text-[#A88A3A] hover:bg-[#F5EAD0] py-1.5 rounded-lg transition-colors">
                          Avanzar →
                        </button>
                      )}
                      {col.status !== 'cancelado' && (
                        <button onClick={() => moveEvent(event.id, 'cancelado')}
                          className="text-[11px] bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FCE3E3] px-2.5 py-1.5 rounded-lg transition-colors">
                          ✕
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
