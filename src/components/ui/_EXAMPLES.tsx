'use client';

/**
 * _EXAMPLES.tsx — Muestra visual de cada componente del design system.
 * NO está enlazado en ninguna ruta. Se borrará en Sprint 6.
 * Abre directamente: /ui-examples (agregar临时 route) o revisa el código.
 */

import React from 'react';
import { DataCard } from './DataCard';
import { DataList } from './DataList';
import { PageHeader } from './PageHeader';
import { StatStrip } from './StatStrip';
import { EmptyState } from './EmptyState';
import { Inbox, Plus, Users, Calendar, TrendingUp } from 'lucide-react';

export default function UIExamples() {
  return (
    <div className="max-w-3xl mx-auto p-8 space-y-10">
      <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
        Design System — Ejemplos
      </h1>

      {/* ── DataCard ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">DataCard</h2>
        <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden">
          <DataCard
            avatar={{ initials: 'MG' }}
            title="María García"
            subtitle="maria@ejemplo.com"
            badges={[
              { label: 'Confirmado', variant: 'success' },
              { label: 'VIP', variant: 'info' },
            ]}
            meta={[
              { label: 'Tel', value: '612 345 678' },
              { label: 'Evento', value: 'Boda · 120 pax' },
              { label: 'Fecha', value: '15 jul 2026' },
            ]}
            actions={<button className="text-[12px] text-[#C9A84C] font-medium hover:underline">Ver</button>}
          />
          <DataCard
            avatar={{ initials: 'JR', color: 'linear-gradient(135deg, #2563EB, #1D4ED8)' }}
            title="Juan Rodríguez"
            subtitle="juan@empresa.com"
            badges={[{ label: 'Pendiente', variant: 'warning' }]}
            meta={[
              { label: 'Tel', value: '912 345 678' },
              { label: 'Tipo', value: 'Corporativo' },
              { label: 'Pax', value: '45' },
            ]}
          />
          <DataCard
            avatar={{ initials: 'AL' }}
            title="Ana López"
            subtitle="ana@ejemplo.com"
            badges={[{ label: 'Cancelado', variant: 'danger' }]}
            meta={[{ label: 'Fecha', value: '3 jun 2026' }]}
          />
        </div>
      </section>

      {/* ── StatStrip ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">StatStrip</h2>
        <StatStrip items={[
          { label: 'Ingresos', value: '42.580 €', accent: true },
          { label: 'Pendiente', value: '8.200 €' },
          { label: 'Eventos', value: 12 },
          { label: 'Comensales', value: 890 },
        ]} />
      </section>

      {/* ── DataList ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">DataList (con contenido)</h2>
        <DataList
          count={2}
          filters={
            <input
              type="text"
              placeholder="Buscar..."
              className="px-3 py-1.5 text-[13px] rounded-lg border border-[#ECECF1] bg-white max-w-xs focus:border-[#C9A84C] focus:outline-none"
            />
          }
        >
          <DataCard
            avatar={{ initials: 'CP' }}
            title="Celeste Pérez"
            subtitle="celeste@ejemplo.com"
            badges={[{ label: 'Nuevo', variant: 'info' }]}
            meta={[{ label: 'Tipo', value: 'Bautizo · 35 pax' }]}
          />
          <DataCard
            avatar={{ initials: 'FM' }}
            title="Fernando Moreno"
            subtitle="fernando@ejemplo.com"
            badges={[{ label: 'Convertido', variant: 'success' }]}
            meta={[{ label: 'Tipo', value: 'Boda · 200 pax' }]}
          />
        </DataList>
      </section>

      {/* ── DataList (loading) ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">DataList (loading)</h2>
        <DataList loading count={3} />
      </section>

      {/* ── DataList (empty) ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">DataList (vacío)</h2>
        <DataList
          count={0}
          emptyIcon={<Inbox className="w-6 h-6" />}
          emptyTitle="Sin leads aún"
          emptyDescription="Los prospectos del configurador aparecerán aquí cuando contacten."
          emptyAction={
            <button className="text-[12px] text-[#C9A84C] font-medium hover:underline">
              Crear lead manual
            </button>
          }
        />
      </section>

      {/* ── EmptyState standalone ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">EmptyState</h2>
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="Sin eventos programados"
          description="Agenda tu primer evento para empezar a gestionar."
          action={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              <Plus className="w-3.5 h-3.5" /> Nuevo evento
            </button>
          }
        />
      </section>

      {/* ── PageHeader ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[#9CA3AF] mb-3">PageHeader</h2>
        <PageHeader
          title="Leads"
          subtitle="Prospectos del configurador y contactos manuales"
          stats={
            <StatStrip items={[
              { label: 'Total', value: 24 },
              { label: 'Nuevos', value: 8, accent: true },
              { label: 'Convertidos', value: 6 },
            ]} />
          }
          actions={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              <Plus className="w-3.5 h-3.5" /> Nuevo lead
            </button>
          }
        />
      </section>
    </div>
  );
}
