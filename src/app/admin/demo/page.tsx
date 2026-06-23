'use client';

/**
 * EventFlow — Demo completa del flujo
 *
 * Muestra cada fase del proceso con estado e iconos.
 * Permite navegar desde aqui a cada seccion y genera los datos de ejemplo.
 *
 * J.Benitez — Alboroto Catering
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminLayout from '@/components/b2b/AdminLayout';

interface Phase {
  id: string;
  num: number;
  name: string;
  description: string;
  status: 'ok' | 'pending' | 'info';
  href: string;
  icon: string;
}

const PHASES: Phase[] = [
  { id: 'configurador',     num: 1,  name: 'Configurador Menú',                description: 'Cliente configura su menú',                      status: 'ok',      href: '/configurador',                              icon: 'menu' },
  { id: 'presupuesto',      num: 2,  name: 'Presupuesto Borrador',             description: 'Se genera presupuesto desde el menú',              status: 'ok',      href: '/admin/kanban',                              icon: 'fileText' },
  { id: 'calculo',          num: 3,  name: 'Cálculo Precio',                   description: 'PVP por plato y total del evento',                 status: 'ok',      href: '/admin/kanban',                              icon: 'calculator' },
  { id: 'reunion',          num: 4,  name: '1ª Reunión — Modificaciones',      description: 'El cliente concreta cambios y da señal',            status: 'ok',      href: '/admin/evento?id=e0000000-0000-0000-0000-000000000001', icon: 'users' },
  { id: 'senal',            num: 5,  name: 'Señal + Cierre Presupuesto',       description: 'Pago 40% → presupuesto aceptado → evento creado',   status: 'info',    href: '/admin/evento?id=e0000000-0000-0000-0000-000000000001#pagos', icon: 'creditCard' },
  { id: 'mesas',            num: 6,  name: 'Cálculo de Mesas y Camareros',     description: 'Mesas (10 pax), camareros (1.5x mesas)',             status: 'info',    href: '/admin/evento?id=e0000000-0000-0000-0000-000000000001#calculos', icon: 'grid3x3' },
  { id: 'invitados',        num: 7,  name: 'Enlace Cliente para Invitados',    description: 'Formulario público para lista de invitados',         status: 'ok',      href: '/invitados/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.cliente-ejemplo-seed', icon: 'users' },
  { id: 'escandallo',       num: 8,  name: 'Cálculo de Escandallos',           description: 'Ingredientes escalados por comensales',             status: 'info',    href: '/admin/evento?id=e0000000-0000-0000-0000-000000000001#escandallo', icon: 'scale' },
  { id: 'confirmacion',     num: 9,  name: 'T-7 Confirmación Invitados',       description: 'Confirmar mesas ocupadas vs capacidad',             status: 'info',    href: '/admin/confirmacion',                        icon: 'checkCircle' },
  { id: 'hojas',            num: 10, name: 'Hojas de Operación y Logística',   description: 'Imprimible con todo lo necesario para el evento',    status: 'info',    href: '/api/hoja-operacion/e0000000-0000-0000-0000-000000000001', icon: 'fileSpreadsheet' },
  { id: 'briefing',         num: 11, name: 'Noche Antes: Briefing Camareros',  description: 'Enviar briefing con zonas, mesas, menú y alérgenos', status: 'info',    href: '/admin/evento?id=e0000000-0000-0000-0000-000000000001#briefing', icon: 'fileText' },
  { id: 'checklist',        num: 12, name: 'Checklist por Áreas',              description: 'Cocina, servicio, montaje, limpieza',               status: 'info',    href: '/admin/evento?id=e0000000-0000-0000-0000-000000000001#checklist', icon: 'clipboardCheck' },
  { id: 'fwd4',             num: 13, name: 'FWD-4: Cierre del Evento',         description: 'Freeze escandallo + deducir stock + facturar',       status: 'info',    href: '/admin/evento?id=e0000000-0000-0000-0000-000000000001#estado', icon: 'lock' },
  { id: 'stock',            num: 14, name: 'Actualización de Stock',           description: 'Deducir consumos reales del inventario',            status: 'info',    href: '/admin/stock',                               icon: 'package' },
  { id: 'cobros',           num: 15, name: 'Cobros Pendientes',                description: 'Gestionar pago restante (60%)',                      status: 'info',    href: '/admin/cobros',                              icon: 'wallet' },
  { id: 'facturacion',      num: 16, name: 'Facturación',                      description: 'Factura final del evento',                          status: 'info',    href: '/admin/cobros',                              icon: 'receipt' },
];

export default function DemoPage() {
  const [seeded, setSeeded] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [eventExists, setEventExists] = useState(false);

  useEffect(() => {
    // Check if our demo event already exists in the DB
    fetch('/api/events/e0000000-0000-0000-0000-000000000001')
      .then(r => r.json())
      .then(d => {
        if (d?.data?.id) setEventExists(true);
      })
      .catch(() => {});
  }, []);

  const runSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const res = await fetch('/api/admin/seed-ejemplo', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSeeded(true);
        setEventExists(true);
        setSeedResult('ok');
      } else {
        setSeedResult(data.error || 'Error');
      }
    } catch {
      setSeedResult('error');
    }
    setSeeding(false);
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-serif text-stone-900">Demo Completa del Flujo</h1>
          <p className="text-sm text-stone-500 mt-1">
            Recorre las 16 fases del proceso de catering con un ejemplo real.
          </p>
        </div>

        {/* Seed button */}
        {!eventExists && (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800">Datos de ejemplo no creados</h3>
                <p className="text-sm text-amber-700 mt-1">
                  Crea los datos de ejemplo para poder navegar por todas las fases:
                </p>
                <p className="text-xs text-amber-600 mt-1 font-mono">
                  Boda de Maria Sánchez · 120 invitados · 23/08/2026
                </p>
              </div>
              <button
                onClick={runSeed}
                disabled={seeding}
                className="px-5 py-2.5 text-sm font-semibold text-white rounded-lg shadow-sm flex items-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
              >
                {seeding ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Creando datos...
                  </>
                ) : (
                  'Crear ejemplo'
                )}
              </button>
            </div>
            {seedResult === 'ok' && (
              <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                ✓ Datos de ejemplo creados correctamente
              </p>
            )}
            {seedResult && seedResult !== 'ok' && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                ✗ Error: {seedResult}
              </p>
            )}
          </div>
        )}

        {eventExists && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <p className="text-sm text-emerald-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Datos de ejemplo creados. Puedes navegar por cada fase.
            </p>
          </div>
        )}

        {/* Timeline */}
        <div className="space-y-2">
          {PHASES.map((phase) => (
            <Link
              key={phase.id}
              href={phase.href}
              className={`block p-4 bg-white border rounded-xl hover:shadow-md transition-all ${
                eventExists ? 'hover:border-[#C9A86A]' : 'opacity-60 pointer-events-none'
              } ${phase.status === 'ok' ? 'border-emerald-200' : 'border-stone-200'}`}
            >
              <div className="flex items-center gap-4">
                {/* Phase number */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  phase.status === 'ok' 
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-stone-100 text-stone-500'
                }`}>
                  {phase.num}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-stone-800">{phase.name}</h3>
                    {phase.status === 'ok' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">✓ Implementado</span>
                    )}
                    {phase.status === 'info' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">Nuevo</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">{phase.description}</p>
                </div>

                {/* Arrow */}
                <svg className="w-4 h-4 text-stone-300 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        {/* Flow diagram */}
        <div className="p-6 bg-stone-50 border border-stone-200 rounded-xl text-sm">
          <h3 className="font-medium text-stone-700 mb-3">Diagrama del flujo completo</h3>
          <div className="flex flex-wrap gap-2">
            {PHASES.map((phase, i) => (
              <div key={phase.id} className="flex items-center gap-1">
                <span className={`px-2 py-1 rounded text-[10px] font-medium ${
                  phase.status === 'ok' 
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {phase.num}
                </span>
                {i < PHASES.length - 1 && <span className="text-stone-300 text-xs">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
