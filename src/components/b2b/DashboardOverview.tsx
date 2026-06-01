'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

type EventStatus = 'draft' | 'sent' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled';

interface Evt {
  id: string;
  client_name: string;
  client_email: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  event_date: string;
  status: EventStatus;
  created_at: string;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro',
};

const STATUS_META: Record<EventStatus, { label: string; dot: string; chip: string }> = {
  draft: { label: 'Borrador', dot: '#3B82F6', chip: 'bg-[#EFF4FF] text-[#2563EB]' },
  sent: { label: 'Enviado', dot: '#D9920B', chip: 'bg-[#FFF8EC] text-[#B45309]' },
  accepted: { label: 'Aceptado', dot: '#16A34A', chip: 'bg-[#EFFAF2] text-[#15803D]' },
  in_progress: { label: 'En Curso', dot: '#8B5CF6', chip: 'bg-[#F3EFFC] text-[#7C3AED]' },
  completed: { label: 'Completado', dot: '#059669', chip: 'bg-[#ECFDF5] text-[#047857]' },
  paid: { label: 'Pagado', dot: '#0284C7', chip: 'bg-[#EFF6FF] text-[#0369A1]' },
  cancelled: { label: 'Cancelado', dot: '#DC2626', chip: 'bg-[#FEF3F3] text-[#DC2626]' },
};

const DEMO: Evt[] = [
  { id: 'd1', client_name: 'María García', client_email: 'maria@email.com', event_type: 'boda', guest_count: 150, kids_count: 10, event_date: '2026-09-15', status: 'accepted', created_at: '2026-05-18T10:00:00Z' },
  { id: 'd2', client_name: 'Carlos López', client_email: 'carlos@empresa.com', event_type: 'corporativo', guest_count: 80, kids_count: 0, event_date: '2026-07-20', status: 'sent', created_at: '2026-05-15T14:30:00Z' },
  { id: 'd3', client_name: 'Ana Martínez', client_email: 'ana@email.com', event_type: 'comunión', guest_count: 200, kids_count: 50, event_date: '2026-08-10', status: 'draft', created_at: '2026-05-10T09:00:00Z' },
];

function fmtDate(d: string) {
  const iso = (d || '').slice(0, 10);
  const [y, m, day] = iso.split('-');
  if (!y || !m || !day) return iso;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase()).join('');
}

export default function DashboardOverview() {
  const [events, setEvents] = useState<Evt[]>([]);
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
          setEvents(data.data); setIsDemo(false);
        } else { setEvents(DEMO); setIsDemo(true); }
      } catch {
        if (!cancelled) { setEvents(DEMO); setIsDemo(true); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const active = events.filter((e) => e.status !== 'cancelled');
  const countBy = (s: EventStatus) => events.filter((e) => e.status === s).length;
  const totalGuests = active.reduce((s, e) => s + (e.guest_count || 0) + (e.kids_count || 0), 0);
  const confirmed = countBy('accepted');
  const conversion = events.length ? Math.round((confirmed / events.length) * 100) : 0;

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = [...active]
    .filter((e) => (e.event_date || '').slice(0, 10) >= todayIso)
    .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
    .slice(0, 6);

  const pipeline: EventStatus[] = ['draft', 'sent', 'accepted'];
  const pipelineMax = Math.max(1, ...pipeline.map(countBy));

  const KPIS = [
    { label: 'Presupuestos activos', value: active.length, accent: '#C9A84C', href: '/admin/kanban' },
    { label: 'Confirmados', value: confirmed, accent: '#16A34A', href: '/admin/kanban' },
    { label: 'Comensales previstos', value: totalGuests, accent: '#6B2737', href: '/admin/operations' },
    { label: 'Tasa de conversión', value: `${conversion}%`, accent: '#3B82F6', href: '/admin/kanban' },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Hola de nuevo 👋
          </h2>
          <p className="text-[#6B7280] text-sm">Resumen de la actividad de tu salón de celebraciones.</p>
        </div>
        <Link href="/admin/kanban" className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all self-start sm:self-auto"
          style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
          Ver pipeline
        </Link>
      </div>

      {isDemo && !loading && (
        <p className="text-xs text-[#9CA3AF] -mt-2">Mostrando datos de demostración (aún no hay presupuestos reales).</p>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link href={k.href} className="block bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)] hover:border-[#E0D3A8] transition-all">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: k.accent }} />
                <span className="text-[12px] text-[#6B7280]">{k.label}</span>
              </div>
              <div className="text-3xl font-semibold text-[#1A1A1A] tabular-nums">{loading ? '—' : k.value}</div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Upcoming events */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F0F0F4] flex items-center justify-between">
            <h3 className="font-semibold text-sm text-[#1A1A1A]">Próximos eventos</h3>
            <Link href="/admin/kanban" className="text-xs text-[#A88A3A] hover:underline">Ver todos</Link>
          </div>
          <div className="divide-y divide-[#F2F2F5]">
            {loading && <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">Cargando…</div>}
            {!loading && upcoming.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No hay eventos próximos.</div>
            )}
            {upcoming.map((e) => {
              const m = STATUS_META[e.status];
              return (
                <div key={e.id} className="px-5 py-3.5 flex items-center gap-3 hover:bg-[#FAFAFC] transition-colors">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                    {initials(e.client_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[#1A1A1A] truncate">{e.client_name}</div>
                    <div className="text-[12px] text-[#9CA3AF] truncate">
                      {EVENT_TYPE_LABELS[e.event_type] || e.event_type} · {e.guest_count}{e.kids_count > 0 ? ` +${e.kids_count}` : ''} pax
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px] font-medium text-[#374151]">{fmtDate(e.event_date)}</div>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full mt-0.5 ${m.chip}`}>
                      {m.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pipeline summary + quick links */}
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="font-semibold text-sm text-[#1A1A1A] mb-4">Pipeline</h3>
            <div className="space-y-3">
              {pipeline.map((s) => {
                const m = STATUS_META[s];
                const n = countBy(s);
                return (
                  <div key={s}>
                    <div className="flex items-center justify-between text-[12px] mb-1">
                      <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
                        <span className="w-2 h-2 rounded-full" style={{ background: m.dot }} />{m.label}
                      </span>
                      <span className="font-semibold text-[#1A1A1A] tabular-nums">{n}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F0F0F4] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(n / pipelineMax) * 100}%`, background: m.dot }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Accesos rápidos</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Agenda', href: '/admin/agenda' },
                { label: 'Clientes', href: '/admin/clientes' },
                { label: 'Cobros', href: '/admin/cobros' },
                { label: 'Invitados', href: '/admin/invitados' },
                { label: 'Catálogo', href: '/admin/catalog' },
                { label: 'Mapa de mesas', href: '/admin/operations' },
              ].map((q) => (
                <Link key={q.href} href={q.href}
                  className="text-[12px] font-medium text-[#374151] bg-[#FAFAFC] border border-[#ECECF1] rounded-xl px-3 py-2.5 hover:border-[#E0D3A8] hover:bg-[#FBF6E9] transition-all text-center">
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
