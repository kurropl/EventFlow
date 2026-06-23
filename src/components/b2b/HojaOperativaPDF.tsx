'use client';

/**
 * HojaOperativaPDF — Genera hoja imprimible del evento
 *
 * J.Benitez — EventFlow ERP
 *
 * Contenido:
 * - Datos del evento
 * - Recetas del catálogo
 * - Escandallo (teórico vs real)
 * - Personal
 * - Cronograma
 * - Checklist
 * - Costes
 * - APPCC (temperaturas, trazabilidad)
 */

import { useRef, useState, useEffect } from 'react';
import { Printer, Download, FileText, AlertTriangle } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';

interface HojaData {
  event: any;
  order: any;
  escandallo: any[];
  plans: any[];
  checklist: any[];
  staffing: any[];
  costs: any[];
  recipes: any[];
  floorplan: any;
  appcc: any[];
  traceability: any[];
  payments: any;
}

export function useHojaOperativa(eventId: string) {
  const [data, setData] = useState<HojaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    fetch(`/api/hoja-operacion/${eventId}`)
      .then(r => r.json())
      .then(r => {
        if (r.success) setData(r.data);
        else setError(r.error || 'Error');
      })
      .catch(() => setError('Error al cargar'))
      .finally(() => setLoading(false));
  }, [eventId]);

  return { data, loading, error };
}

/* ═══ Componente PDF ═══ */

export function HojaPDF({ eventId, eventName }: { eventId: string; eventName?: string }) {
  const { data, loading, error } = useHojaOperativa(eventId);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Hoja-Operativa-${eventName || eventId}`,
    pageStyle: `@page { size: A4; margin: 15mm; }
              @media print { body { -webkit-print-color-adjust: exact; } }
              .no-print { display: none !important; }`,
  });

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-stone-400 p-4">
        <div className="w-4 h-4 rounded-full border-2 border-stone-300 border-t-stone-500 animate-spin" />
        Cargando hoja operativa...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-500 p-4">
        <AlertTriangle className="w-4 h-4" />
        {error || 'No se pudo cargar la hoja operativa'}
      </div>
    );
  }

  return (
    <div>
      {/* Botón imprimir */}
      <div className="no-print flex items-center gap-2 mb-4">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-800 text-stone-50 text-sm font-medium hover:bg-stone-700 transition-colors"
        >
          <Printer className="w-4 h-4" />
          Imprimir hoja operativa
        </button>
        <span className="text-[10px] text-stone-400">
          {data.payments?.total} pagos · {data.plans.length} planes · {data.checklist.length} tareas checklist · {data.staffing.length} personas · {data.escandallo.length} items
        </span>
      </div>

      {/* Contenido imprimible */}
      <div ref={printRef} className="bg-white p-6 space-y-6 text-stone-800" style={{ fontSize: '11px' }}>
        {/* Header */}
        <div className="border-b-2 border-stone-800 pb-3 mb-4">
          <h1 className="text-xl font-bold tracking-tight">Hoja Operativa</h1>
          <p className="text-xs text-stone-500">{data.event?.client_name || 'Sin cliente'} — {new Date(data.event?.event_date).toLocaleDateString('es-ES')}</p>
          <p className="text-[10px] text-stone-400">Comensales: {data.event?.guest_count || '-'} | Tipo: {data.event?.event_type || '-'}</p>
        </div>

        {/* Resumen de pagos */}
        <div className="grid grid-cols-3 gap-3 text-[10px]">
          <div className="bg-stone-50 p-2 rounded">
            <p className="font-medium">Pagos</p>
            <p>{data.payments?.paid} / {data.payments?.total} pagados</p>
            <p className="text-stone-400">{Number(data.payments?.totalAmount || 0).toLocaleString('es-ES')} €</p>
          </div>
          <div className="bg-stone-50 p-2 rounded">
            <p className="font-medium">Personal</p>
            <p>{data.staffing.length} asignados</p>
          </div>
          <div className="bg-stone-50 p-2 rounded">
            <p className="font-medium">Costes</p>
            {data.costs.map((c: any, i: number) => (
              <p key={i}>{c.line_type}: {Number(c.total || 0).toLocaleString('es-ES')} €</p>
            ))}
          </div>
        </div>

        {/* Recetas del evento */}
        <div>
          <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Recetas ({data.recipes.length})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {data.recipes.map((r: any) => (
              <div key={r.id} className="p-2 border border-stone-200 rounded">
                <p className="font-medium">{r.name}</p>
                <p className="text-[9px] text-stone-400">{r.category} · {r.servings} pax · {r.prep_time}+{r.cook_time} min · {r.difficulty}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Escandallo */}
        <div>
          <h2 className="text-sm font-bold mb-2">Escandallo ({data.escandallo.length} items)</h2>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-stone-300">
                <th className="text-left p-1">Ingrediente</th>
                <th className="text-right p-1">Teórico</th>
                <th className="text-right p-1">Real</th>
                <th className="text-right p-1">Coste est.</th>
                <th className="text-right p-1">Coste real</th>
                <th className="text-right p-1">Desviación</th>
              </tr>
            </thead>
            <tbody>
              {data.escandallo.map((e: any) => (
                <tr key={e.id} className="border-b border-stone-100">
                  <td className="p-1">{e.ingredient_name}</td>
                  <td className="text-right p-1">{Number(e.theoretical_qty || 0).toFixed(2)} {e.theoretical_unit || ''}</td>
                  <td className="text-right p-1">{Number(e.actual_quantity || 0).toFixed(2)}</td>
                  <td className="text-right p-1">{Number(e.estimated_cost || 0).toFixed(2)} €</td>
                  <td className="text-right p-1">{Number(e.actual_cost_total || 0).toFixed(2)} €</td>
                  <td className={`text-right p-1 ${(e.deviation_qty || 0) > 0 ? 'text-red-500' : 'text-green-500'}`}>{Number(e.deviation_qty || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Cronograma */}
        <div>
          <h2 className="text-sm font-bold mb-2">Cronograma ({data.plans.length} planes)</h2>
          <div className="space-y-1">
            {data.plans.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between p-1.5 border border-stone-100">
                <div>
                  <p className="font-medium">{p.title}</p>
                  <p className="text-[9px] text-stone-400">{p.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px]">{p.planned_time || '-'}</p>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${p.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {p.completed ? 'Completado' : 'Pendiente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Personal */}
        <div>
          <h2 className="text-sm font-bold mb-2">Personal ({data.staffing.length})</h2>
          <div className="flex flex-wrap gap-2">
            {data.staffing.map((s: any) => (
              <div key={s.id} className="px-2 py-1 rounded-full border border-stone-200 text-[10px]">
                {s.worker_name} · {s.role}
              </div>
            ))}
          </div>
        </div>

        {/* APPCC */}
        <div>
          <h2 className="text-sm font-bold mb-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            APPCC — Control Sanitario
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {/* Temperaturas */}
            <div className="p-2 border border-stone-200 rounded">
              <p className="font-medium text-[10px]">Temperaturas neveras</p>
              {data.appcc.length === 0 ? (
                <p className="text-[9px] text-stone-400">Sin registros</p>
              ) : (
                <div className="space-y-1">
                  {data.appcc.map((a: any) => (
                    <p key={a.id} className={`text-[9px] ${a.status === 'critical' ? 'text-red-600 font-bold' : a.status === 'warning' ? 'text-amber-600' : 'text-stone-500'}`}>
                      {a.fridge_name}: {a.temperature}°C ({new Date(a.recorded_at).toLocaleTimeString()})
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Trazabilidad */}
            <div className="p-2 border border-stone-200 rounded">
              <p className="font-medium text-[10px]">Trazabilidad</p>
              {data.traceability.length === 0 ? (
                <p className="text-[9px] text-stone-400">Sin registros</p>
              ) : (
                <div className="space-y-1">
                  {data.traceability.slice(0, 8).map((t: any) => (
                    <p key={t.id} className="text-[9px]">
                      Lote {t.lot_number} → {t.ingredient_name} · {Number(t.quantity_used).toFixed(1)} {t.unit} · {t.used_by}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div>
          <h2 className="text-sm font-bold mb-2">Checklist</h2>
          <div className="flex flex-wrap gap-1">
            {data.checklist.map((c: any) => (
              <div key={c.id} className={`px-2 py-1 rounded text-[9px] border ${c.completed ? 'border-emerald-300 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}>
                {c.title} {c.completed ? '✓' : '☐'}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 pt-3 text-[9px] text-stone-400 text-center">
          <p>Hoja operativa generada automáticamente — EventFlow ERP</p>
          <p>{new Date().toLocaleString('es-ES')}</p>
        </div>
      </div>
    </div>
  );
}