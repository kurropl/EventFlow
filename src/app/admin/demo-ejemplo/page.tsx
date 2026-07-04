'use client';

/**
 * EventFlow — Demo completa del flujo
 *
 * Muestra cada fase del proceso con estado e iconos.
 * Permite navegar desde aquí a cada módulo del admin.
 */
import { useState, useEffect } from 'react';
import Icon from '@/components/shared/Icon';

// ── Fases del flujo ───────────────────────────
interface Fase {
  id: string;
  numero: number;
  label: string;
  descripcion: string;
  modulo: string;
  href: string;
  dependsOn?: string[];
}

const FASES: Fase[] = [
  { id: 'lead',        numero: 1,  label: 'Lead',                    descripcion: 'Captación del cliente · Referidos, web, teléfono',               modulo: 'Leads',        href: '/admin/leads' },
  { id: 'presupuesto', numero: 2,  label: 'Presupuesto',             descripcion: 'Configurador menú · Selección de platos y precios',               modulo: 'Pipeline',     href: '/admin/kanban' },
  { id: 'senal',       numero: 3,  label: 'Señal (40%)',            descripcion: 'Pago de la señal para reserva de fecha',                           modulo: 'Cobros',       href: '/admin/cobros' },
  { id: 'invitados',   numero: 4,  label: 'Formulario Invitados',   descripcion: 'El cliente rellena invitados y alergias por email',                 modulo: 'Invitados',    href: '/admin/invitados' },
  { id: 'deco',        numero: 5,  label: 'Decoración',             descripcion: 'Mantelería, centro de mesa, estilo de la celebración',             modulo: 'Ficha Evento', href: '/admin/evento' },
  { id: 'confirmacion',numero: 6,  label: 'Confirmación',           descripcion: 'Confirmación de invitados vs mesas — T-7',                         modulo: 'Confirmación', href: '/admin/confirmacion' },
  { id: 'aceptacion',  numero: 7,  label: 'Aceptación (FWD-3)',     descripcion: 'Aceptar presupuesto → auto-genera escandallo, mesas e invitados', modulo: 'Operaciones',  href: '/admin/operations' },
  { id: 'mesas',       numero: 8,  label: 'Mapa de Mesas',          descripcion: 'Distribución drag&drop de mesas en el salón',                      modulo: 'Mapa Mesas',   href: '/admin/mapa-mesas' },
  { id: 'escandallo',  numero: 9,  label: 'Escandallo',             descripcion: 'Recálculo de costes reales del menú',                               modulo: 'Operaciones',  href: '/admin/operations' },
  { id: 'personal',    numero: 10, label: 'Personal (Staffing)',    descripcion: 'Asignación de camareros, cocineros y coordinadores',               modulo: 'Personal',     href: '/admin/staffing' },
  { id: 'briefing',    numero: 11, label: 'Briefing Camareros',     descripcion: 'Documento resumen para el equipo de sala',                         modulo: 'Operaciones',  href: '/admin/cocina' },
  { id: 'appcc',       numero: 12, label: 'APPCC',                  descripcion: 'Trazabilidad sanitaria y controles HACCP',                          modulo: 'Cocina',       href: '/admin/cocina' },
  { id: 'ejecucion',   numero: 13, label: 'Ejecución (FWD-4)',      descripcion: 'Cierre del evento: freeze escandallo + deducir stock + facturar',  modulo: 'Operaciones',  href: '/admin/operations' },
  { id: 'stock',       numero: 14, label: 'Stock',                  descripcion: 'Inventario post-evento, reposiciones',                              modulo: 'Inventario',   href: '/admin/stock' },
  { id: 'factura',     numero: 15, label: 'Facturación',            descripcion: 'Factura final con 40% restante',                                   modulo: 'Cobros',       href: '/admin/cobros' },
  { id: 'rentabilidad',numero: 16, label: 'Rentabilidad',           descripcion: 'Margen real del evento vs presupuestado',                           modulo: 'Rentabilidad', href: '/admin/rentabilidad' },
];

const STATUS_MAP: Record<string, { text: string; class: string }> = {};

export default function DemoEjemploPage() {
  const [seedStatus, setSeedStatus] = useState<'idle'|'loading'|'done'|'error'>('idle');
  const [seedMsg, setSeedMsg] = useState('');
  const [eventId, setEventId] = useState<string|null>(null);
  const [activeFases, setActiveFases] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loadingStatus, setLoadingStatus] = useState(false);

  const ejecutarSeed = async () => {
    setSeedStatus('loading');
    setSeedMsg('Creando datos de ejemplo...');
    try {
      const r = await fetch('/api/admin/seed-ejemplo', { method: 'POST' });
      const j = await r.json();
      if (j.success) {
        setSeedStatus('done');
        setSeedMsg(`Datos creados: ${j.data.created} nuevos, ${j.data.skipped} ya existían${j.data.errors > 0 ? `, ${j.data.errors} errores` : ''}`);
        setEventId('e0000000-0000-0000-0000-000000000001');
        // Marcar fases como completadas según el seed
        setStatuses({
          lead: 'ok',
          presupuesto: 'ok',
          senal: 'ok',
          invitados: 'ok',
          deco: 'ok',
          confirmacion: 'ok',
          aceptacion: 'ok',
          mesas: 'ok',
          escandallo: 'ok',
          personal: 'ok',
          briefing: 'ok',
          appcc: 'ok',
          ejecucion: 'pending',
          stock: 'pending',
          factura: 'pending',
          rentabilidad: 'pending',
        });
        setActiveFases(FASES.map(f => f.id));
      } else {
        setSeedStatus('error');
        setSeedMsg(j.error || 'Error desconocido');
      }
    } catch (e: any) {
      setSeedStatus('error');
      setSeedMsg(e.message || 'Error de conexión');
    }
  };

  // ── Render ──────────────────────────────
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-2xl text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Demo del Flujo Completo
        </h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Recorre las 16 fases del proceso Alboroto, desde la captación del lead hasta la rentabilidad final.
        </p>
      </div>

      {/* Seed Button */}
      <div className="bg-white rounded-xl border border-[#ECECF1] p-6">
        <h2 className="font-semibold text-sm text-[#1A1A1A] mb-2">1. Crear datos de ejemplo</h2>
        <p className="text-xs text-[#6B7280] mb-4">
          Inserta un lead, evento, presupuesto, menú, ingredientes, receta, escandallo, pago, personal y briefing.
          Usa <code className="bg-[#F5F5F8] px-1.5 py-0.5 rounded text-xs">ON CONFLICT DO NOTHING</code>:
          si ya existen los datos solo avanza, no duplica.
        </p>
        <button
          onClick={ejecutarSeed}
          disabled={seedStatus === 'loading'}
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
          style={{ background: seedStatus === 'done' ? '#ECFDF5' : '#1A1A1A', color: seedStatus === 'done' ? '#065F46' : '#fff' }}
        >
          {seedStatus === 'idle' && '🚀 Ejecutar Seed'}
          {seedStatus === 'loading' && '⏳ Creando datos...'}
          {seedStatus === 'done' && '✅ Datos creados'}
          {seedStatus === 'error' && '❌ Reintentar'}
        </button>
        {seedMsg && (
          <p className="mt-2 text-xs" style={{ color: seedStatus === 'done' ? '#065F46' : seedStatus === 'error' ? '#DC2626' : '#6B7280' }}>
            {seedMsg}
          </p>
        )}
      </div>

      {/* Result y Navegación */}
      {seedStatus === 'done' && (
        <>
          {/* Timeline visual */}
          <div className="bg-white rounded-xl border border-[#ECECF1] p-6">
            <h2 className="font-semibold text-sm text-[#1A1A1A] mb-4">2. Timeline del flujo</h2>
            <div className="relative">
              {/* Línea horizontal (escritorio) */}
              <div className="hidden md:block absolute top-[26px] left-[24px] right-[24px] h-[2px] bg-[#E5E7EB] z-0" />
              <div className="grid grid-cols-4 gap-3 relative z-10">
                {FASES.map(f => {
                  const st = statuses[f.id] || 'pending';
                  return (
                    <a
                      key={f.id}
                      href={f.href}
                      className="group p-3 rounded-xl border transition-all hover:shadow-sm"
                      style={{
                        borderColor: st === 'ok' ? '#C9A84C' : '#ECECF1',
                        background: st === 'ok' ? '#FBF6E9' : '#fff',
                        opacity: eventId && activeFases.includes(f.id) ? 1 : 0.4,
                        pointerEvents: eventId && activeFases.includes(f.id) ? 'auto' : 'none',
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                          style={{ background: st === 'ok' ? '#C9A84C' : '#E5E7EB', color: st === 'ok' ? '#fff' : '#9CA3AF' }}>
                          {st === 'ok' ? '✓' : f.numero}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-[#9CA3AF]">{f.modulo}</span>
                      </div>
                      <p className="font-medium text-xs text-[#1A1A1A] group-hover:text-[#C9A84C] transition-colors">{f.label}</p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5 leading-tight">{f.descripcion}</p>
                    </a>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tabla detallada */}
          <div className="bg-white rounded-xl border border-[#ECECF1] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#ECECF1]">
              <h2 className="font-semibold text-sm text-[#1A1A1A]">3. Detalle por fase</h2>
            </div>
            <div className="divide-y divide-[#ECECF1]">
              {FASES.map((f, i) => {
                const st = statuses[f.id] || 'pending';
                const isEven = i % 2 === 0;
                return (
                  <div key={f.id} className={`px-6 py-4 flex items-center gap-4 ${isEven ? 'bg-[#FAFAFC]' : 'bg-white'}`}>
                    {/* Número */}
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: st === 'ok' ? '#C9A84C' : '#E5E7EB', color: st === 'ok' ? '#fff' : '#9CA3AF' }}>
                      {f.numero}
                    </span>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <a href={f.href} className="font-medium text-sm text-[#1A1A1A] hover:text-[#C9A84C] transition-colors">
                          {f.label}
                        </a>
                        <span className="text-[10px] uppercase tracking-wider text-[#9CA3AF] bg-[#F5F5F8] px-2 py-0.5 rounded-full">
                          {f.modulo}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5">{f.descripcion}</p>
                    </div>
                    {/* Estado */}
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{
                        background: st === 'ok' ? '#ECFDF5' : '#FEF3C7',
                        color: st === 'ok' ? '#065F46' : '#92400E',
                      }}>
                      {st === 'ok' ? '✓ Completado' : st === 'pending' ? '○ Pendiente' : st}
                    </span>
                    {/* Enlace */}
                    <a
                      href={f.href}
                      className="text-xs px-3 py-1.5 rounded-lg border border-[#D1D5DB] text-[#6B7280] hover:bg-[#F5F5F8] hover:text-[#1A1A1A] transition-all flex-shrink-0"
                    >
                      Ir →
                    </a>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Atajos principales */}
          <div className="bg-white rounded-xl border border-[#ECECF1] p-6">
            <h2 className="font-semibold text-sm text-[#1A1A1A] mb-3">4. Atajos rápidos</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: 'Ver Lead', href: '/admin/leads', icon: 'lead' },
                { label: 'Pipeline Presupuestos', href: '/admin/kanban', icon: 'kanban' },
                { label: 'Ficha Evento', href: `/admin/evento?id=${eventId}`, icon: 'fichaEvento' },
                { label: 'Mapa de Mesas', href: '/admin/mapa-mesas', icon: 'mapa-mesas' },
                { label: 'Cocina & APPCC', href: '/admin/cocina', icon: 'cocina' },
                { label: 'Confirmación', href: '/admin/confirmacion', icon: 'confirmacion' },
              ].map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#ECECF1] text-sm text-[#1A1A1A] hover:bg-[#FBF6E9] hover:border-[#C9A84C] transition-all"
                >
                  <span className="text-[#C9A84C]"><Icon name={link.icon} /></span>
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
