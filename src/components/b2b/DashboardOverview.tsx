'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import Icon from '../shared/Icon';

type EventStatus = 'draft' | 'sent' | 'accepted' | 'in_progress' | 'completed' | 'paid' | 'cancelled';

interface Evt {
  id: string; client_name: string; event_type: string;
  guest_count: number; kids_count: number;
  event_date: string; status: EventStatus; created_at: string;
  total_pvp: number; total_display?: number; bar_price?: number;
}

interface Lead {
  id: string; source: string; status: string; created_at: string;
}

interface Payment {
  id: string; amount: number; method: string; created_at: string;
  event_id: string; paid: boolean; due_date?: string;
}

const STATUS_META: Record<string, { label: string; dot: string; chip: string }> = {
  draft: { label: 'Borrador', dot: '#3B82F6', chip: 'bg-[#EFF4FF] text-[#2563EB]' },
  sent: { label: 'Enviado', dot: '#D9920B', chip: 'bg-[#FFF8EC] text-[#B45309]' },
  accepted: { label: 'Aceptado', dot: '#16A34A', chip: 'bg-[#EFFAF2] text-[#15803D]' },
  paid: { label: 'Pagado', dot: '#0284C7', chip: 'bg-[#EFF6FF] text-[#0369A1]' },
  cancelled: { label: 'Cancelado', dot: '#DC2626', chip: 'bg-[#FEF3F3] text-[#DC2626]' },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', cumpleaños: 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', comunión: 'Comunión', otro: 'Otro',
};

const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
};

const initials = (n: string) => n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

const monthName = (i: number) => {
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return months[i] || '';
};

export default function DashboardOverview() {
  const [events, setEvents] = useState<Evt[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [evRes, ldRes, pmRes] = await Promise.all([
          fetch('/api/events?limit=300'),
          fetch('/api/leads?limit=300'),
          fetch('/api/payments?limit=300'),
        ]);
        if (cancelled) return;
        const ev = await evRes.json();
        const ld = await ldRes.json();
        const pm = await pmRes.json();
        if (evRes.ok && ev.success) setEvents(ev.data || []);
        if (ldRes.ok) setLeads(ld.data || []);
        if (pmRes.ok) setPayments(pm.data || []);
      } catch (e) { console.error(e); }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived metrics ─────────────────────────────────────────
  const active = events.filter((e) => e.status !== 'cancelled');
  const countBy = (s: string) => events.filter((e) => e.status === s).length;
  const totalGuests = active.reduce((s, e) => s + (e.guest_count || 0) + (e.kids_count || 0), 0);
  const confirmed = countBy('accepted') + countBy('paid') + countBy('in_progress') + countBy('completed');
  const conversion = events.length ? Math.round((confirmed / events.length) * 100) : 0;
  const totalRevenue = payments.filter(p => p.paid).reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingRevenue = events
    .filter(e => e.status === 'accepted' || e.status === 'sent')
    .reduce((s, e) => s + Number(e.total_display || e.total_pvp || 0), 0);

  // ── Monthly revenue chart ────────────────────────────────────
  const monthlyRevenue = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({ month: i, revenue: 0, count: 0 }));
    payments.forEach((p) => {
      if (!p.paid) return;
      const d = new Date(p.created_at);
      const m = d.getMonth();
      if (m >= 0 && m < 12) {
        months[m].revenue += Number(p.amount || 0);
        months[m].count++;
      }
    });
    return months;
  }, [payments]);

  const maxRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

  // ── Lead sources ─────────────────────────────────────────────
  const sourceCounts = useMemo(() => {
    const sources: Record<string, { count: number; color: string; label: string }> = {
      configurador: { count: 0, color: '#C9A84C', label: 'Configurador' },
      whatsapp: { count: 0, color: '#25D366', label: 'WhatsApp' },
      manual: { count: 0, color: '#6B7280', label: 'Manual' },
    };
    leads.forEach((l) => { if (sources[l.source]) sources[l.source].count++; });
    return Object.values(sources);
  }, [leads]);
  const totalLeads = sourceCounts.reduce((s, src) => s + src.count, 0);

  // ── Upcoming ─────────────────────────────────────────────────
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = [...active]
    .filter((e) => (e.event_date || '').slice(0, 10) >= todayIso)
    .sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''))
    .slice(0, 6);

  // ── Pipeline ─────────────────────────────────────────────────
  const pipeline: string[] = ['draft', 'sent', 'accepted', 'paid'];
  const pipelineMax = Math.max(1, ...pipeline.map(countBy));

  // ── Event type distribution ──────────────────────────────────
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    events.forEach((e) => { const t = e.event_type || 'otro'; counts[t] = (counts[t] || 0) + 1; });
    return counts;
  }, [events]);
  const typeMax = Math.max(1, ...Object.values(typeCounts));

  // ── Quick stats ──────────────────────────────────────────────
  const KPIS = [
    { label: 'Ingresos totales', value: `${totalRevenue.toLocaleString('es-ES')}€`, accent: '#16A34A', subtitle: `${payments.length} cobros`, href: '/admin/cobros', icon: 'revenue' },
    { label: 'Pendiente de cobro', value: `${pendingRevenue.toLocaleString('es-ES')}€`, accent: '#D9920B', subtitle: 'presupuestos activos', href: '/admin/kanban', icon: 'pending' },
    { label: 'Comensales previstos', value: `${totalGuests.toLocaleString('es-ES')}`, accent: '#6B2737', subtitle: `${active.length} eventos`, href: '/admin/operations', icon: 'guests' },
    { label: 'Conversión', value: `${conversion}%`, accent: '#3B82F6', subtitle: `${confirmed} de ${events.length}`, href: '/admin/kanban', icon: 'conversion' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              <Icon name="dashboard" className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Bienvenido
              </h2>
              <p className="text-[13px] text-[#6B7280] leading-tight">Panel de control · {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/leads" className="text-sm font-medium px-4 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F5F5F8] transition-colors">
            Leads ({totalLeads})
          </Link>
          <Link href="/admin/kanban" className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm hover:shadow transition-all"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            Pipeline
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-sm text-[#9CA3AF]">
          <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Cargando datos...
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-lg font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Aún no hay presupuestos
          </p>
          <p className="text-sm text-[#6B7280] mt-1 mb-4">
            Cuando crees o recibas presupuestos, aparecerán aquí los KPIs y métricas.
          </p>
          <Link href="/admin/kanban" className="inline-flex text-sm font-medium text-white px-5 py-2.5 rounded-xl shadow-sm"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            Crear primer presupuesto
          </Link>
        </div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {KPIS.map((k, i) => (
              <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={k.href} className="block bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-[0_4px_14px_rgba(16,24,40,0.08)] hover:border-[#E0D3A8] transition-all">
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ background: k.accent }} />
                      <span className="text-[12px] text-[#6B7280]">{k.label}</span>
                    </span>
                    <span className="text-[#9CA3AF]"><Icon name={k.icon} className="w-4 h-4" /></span>
                  </div>
                  <div className="text-3xl font-semibold text-[#1A1A1A] tabular-nums">{k.value}</div>
                  <div className="text-[11px] text-[#9CA3AF] mt-1">{k.subtitle}</div>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left column: Upcoming events + Revenue chart */}
            <div className="lg:col-span-2 space-y-5">
              {/* Revenue chart */}
              <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm text-[#1A1A1A]">Ingresos mensuales</h3>
                  <span className="text-[11px] text-[#9CA3AF]">{totalRevenue.toLocaleString('es-ES')}€ total</span>
                </div>
                <div className="flex items-end gap-1.5 h-32">
                  {monthlyRevenue.map((m) => (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-md relative group cursor-pointer"
                        style={{ height: `${Math.max(4, (m.revenue / maxRevenue) * 100)}%`, background: m.revenue > 0 ? 'linear-gradient(180deg, #C9A84C, #A88A3A)' : '#F0F0F4' }}>
                        {m.revenue > 0 && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-[#6B7280] opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                            {m.revenue.toLocaleString('es-ES')}€
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] ${m.revenue > 0 ? 'text-[#6B7280]' : 'text-[#D1D5DB]'}`}>{monthName(m.month)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming events */}
              <div className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
                <div className="px-5 py-4 border-b border-[#F0F0F4] flex items-center justify-between">
                  <h3 className="font-semibold text-sm text-[#1A1A1A]">Próximos eventos</h3>
                  <Link href="/admin/kanban" className="text-xs text-[#A88A3A] hover:underline">Ver todos</Link>
                </div>
                <div className="divide-y divide-[#F2F2F5]">
                  {upcoming.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-[#9CA3AF]">No hay eventos próximos programados.</div>
                  ) : (
                    upcoming.map((e) => {
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
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right column: Pipeline + Charts */}
            <div className="space-y-5">
              {/* Pipeline */}
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

              {/* Event type distribution */}
              <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Tipos de evento</h3>
                <div className="space-y-2">
                  {Object.entries(typeCounts)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type}>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <span className="text-[#6B7280]">{EVENT_TYPE_LABELS[type] || type}</span>
                          <span className="font-semibold text-[#1A1A1A]">{count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-[#F0F0F4] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(count / typeMax) * 100}%`, background: '#C9A84C' }} />
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Lead sources */}
              {totalLeads > 0 && (
                <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Origen de leads</h3>
                  <div className="space-y-2">
                    {sourceCounts.map((src) => (
                      <div key={src.label}>
                        <div className="flex items-center justify-between text-[11px] mb-0.5">
                          <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
                            <span className="w-2 h-2 rounded-full" style={{ background: src.color }} />
                            {src.label}
                          </span>
                          <span className="font-semibold text-[#1A1A1A]">{src.count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-[#F0F0F4] overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(src.count / Math.max(1, totalLeads)) * 100}%`, background: src.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick links */}
              <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Accesos rápidos</h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Agenda', href: '/admin/agenda', icon: 'agenda' },
                    { label: 'Leads', href: '/admin/leads', icon: 'leads' },
                    { label: 'Clientes', href: '/admin/clientes', icon: 'clientes' },
                    { label: 'Cobros', href: '/admin/cobros', icon: 'cobros' },
                    { label: 'Invitados', href: '/admin/invitados', icon: 'invitados' },
                    { label: 'Catálogo', href: '/admin/catalog', icon: 'catalog' },
                    { label: 'Operaciones', href: '/admin/operations', icon: 'operations' },
                    { label: 'Mapa de mesas', href: '/admin/mapa-mesas', icon: 'mapa' },
                  ].map((q) => (
                    <Link key={q.href} href={q.href}
                      className="flex items-center gap-2.5 text-[12px] font-medium text-[#374151] bg-[#FAFAFC] border border-[#ECECF1] rounded-xl px-3 py-2.5 hover:border-[#E0D3A8] hover:bg-[#FBF6E9] transition-all">
                      <span className="text-[#9CA3AF]"><Icon name={q.icon} className="w-3.5 h-3.5" /></span>
                      {q.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}