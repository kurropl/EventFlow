'use client';

/**
 * TrazaPanel — Panel de trazabilidad del modelo de datos
 * Muestra desde un presupuesto (quote) toda la descendencia transaccional
 * y desde cualquier maestra los eventos donde ha participado
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface TraceResult {
  quote: any;
  event?: any;
  eventOrders?: any[];
  shoppingItems?: any[];
  payments?: any[];
  invoices?: any[];
  staffingLines?: any[];
  ingredients?: any[];
  providers?: any[];
  tables?: any[];
  guests?: any[];
}

interface WorkerTrace {
  worker: any;
  assignments: any[];
  events: any[];
  quotes: any[];
  summary: { total_events: number; total_assignments: number; total_pay: number; total_hours: number };
}

export default function TrazaPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<'quote' | 'worker' | 'event'>('quote');
  const [quoteId, setQuoteId] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [eventId, setEventId] = useState('');
  const [trace, setTrace] = useState<TraceResult | null>(null);
  const [workerTrace, setWorkerTrace] = useState<WorkerTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [events, setEvents] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);

  // Cargar lista de eventos, trabajadores y presupuestos
  useEffect(() => {
    fetch('/api/events?limit=50')
      .then((r) => r.json())
      .then((d) => d.success && setEvents(d.data || []))
      .catch(() => {});
    fetch('/api/staffing?limit=50')
      .then((r) => r.json())
      .then((d) => d.success && setWorkers(d.data || []))
      .catch(() => {});
    fetch('/api/quotes?limit=50')
      .then((r) => r.json())
      .then((d) => d.success && setQuotes(d.data || []))
      .catch(() => {});
  }, []);

  const loadTrace = async () => {
    if (!quoteId) { setError('Selecciona un presupuesto'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/quotes/${quoteId}/trace`);
      const d = await res.json();
      if (d.success) {
        setTrace(d.data);
        setWorkerTrace(null);
      } else {
        setError(d.error || 'Error al cargar trazabilidad');
      }
    } catch (e: any) {
      setError(e.message || 'Error de red');
    }
    setLoading(false);
  };

  const loadWorkerTrace = async () => {
    if (!workerId) { setError('Selecciona un trabajador'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/staffing/trace/${workerId}`);
      const d = await res.json();
      if (d.success) {
        setWorkerTrace(d.data);
        setTrace(null);
      } else {
        setError(d.error || 'Error al cargar');
      }
    } catch (e: any) {
      setError(e.message || 'Error de red');
    }
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-stone-800 mb-6">Panel de Trazabilidad</h1>

      {/* Selector de modo */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode('quote')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === 'quote' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
          }`}
        >
          Presupuesto → Evento
        </button>
        <button
          onClick={() => setMode('worker')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === 'worker' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
          }`}
        >
          Trabajador → Eventos
        </button>
        <button
          onClick={() => setMode('event')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            mode === 'event' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-600'
          }`}
        >
          Ver Evento
        </button>
      </div>

      {mode === 'quote' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select
              value={quoteId}
              onChange={(e) => setQuoteId(e.target.value)}
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
            >
              <option value="">Selecciona un presupuesto...</option>
              {quotes.map((q: any) => (
                <option key={q.id} value={q.id}>
                  {q.status} — {(Number(q.total_pvp) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </option>
              ))}
            </select>
            <button
              onClick={loadTrace}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Trazar'}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {trace && (
            <div className="space-y-6">
              {/* Resumen del presupuesto */}
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <h2 className="font-semibold text-stone-700 mb-2">Presupuesto</h2>
                <p className="text-sm text-stone-500">
                  {trace.quote.status} — {(Number(trace.quote.total_pvp) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                </p>
              </div>

              {/* Evento */}
              {trace.event && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <h2 className="font-semibold text-amber-800 mb-2">Evento</h2>
                  <p className="text-sm">{trace.event.client_name} — {trace.event.event_date}</p>
                </div>
              )}

              {/* Órdenes de evento */}
              {trace.eventOrders && trace.eventOrders.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    🛒 Órdenes ({trace.eventOrders.length})
                  </h3>
                  <div className="text-sm space-y-1">
                    {trace.eventOrders.map((o: any, i: number) => (
                      <p key={i} className="text-stone-500">
                        #{o.id.slice(0, 8)} — {o.planned_hours}h
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Shopping items */}
              {trace.shoppingItems && trace.shoppingItems.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    📋 Escandallo ({trace.shoppingItems.length} items)
                  </h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-stone-400">
                        <th className="pb-1">Ingrediente</th>
                        <th className="pb-1">Coste</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trace.shoppingItems.map((si: any) => (
                        <tr key={si.id} className="text-stone-500">
                          <td className="py-0.5">{si.ingredient_name || si.id.slice(0, 8)}</td>
                          <td className="py-0.5">
                            {(Number(si.unit_cost) || 0).toLocaleString('es-ES', {
                              style: 'currency',
                              currency: 'EUR',
                              minimumFractionDigits: 4,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Payments */}
              {trace.payments && trace.payments.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    💰 Pagos ({trace.payments.length})
                  </h3>
                  <div className="text-sm space-y-1">
                    {trace.payments.map((p: any, i: number) => (
                      <p key={i} className="text-stone-500">
                        {(Number(p.amount) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        {p.paid ? ' ✅' : ' ⏳'}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Staffing */}
              {trace.staffingLines && trace.staffingLines.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    👥 Personal ({trace.staffingLines.length})
                  </h3>
                  <div className="text-sm space-y-1">
                    {trace.staffingLines.map((sl: any, i: number) => (
                      <p key={i} className="text-stone-500">
                        {sl.role} ({sl.slots_needed || 0} slots)
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Ingredientes y proveedores */}
              {trace.ingredients && trace.ingredients.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    🌾 Ingredientes maestros ({trace.ingredients.length})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                    {trace.ingredients.map((i: any) => (
                      <div key={i.id} className="p-1.5 bg-stone-50 rounded">
                        <span className="font-medium">{i.name}</span>
                        <span className="text-stone-400 ml-1">
                          {(Number(i.unit_cost) || 0).toLocaleString('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {trace.providers && trace.providers.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    📦 Proveedores ({trace.providers.length})
                  </h3>
                  <div className="text-sm space-y-1">
                    {trace.providers.map((p: any) => (
                      <p key={p.id} className="text-stone-500">{p.name}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Mesas e invitados */}
              {trace.tables && trace.tables.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    🪑 Mesas ({trace.tables.length})
                  </h3>
                  <div className="text-sm space-y-1">
                    {trace.tables.map((t: any, i: number) => (
                      <p key={i} className="text-stone-500">
                        Mesa {t.table_number} — {t.guests || 0} invitados
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {trace.guests && trace.guests.length > 0 && (
                <div className="bg-white rounded-xl p-4 border border-stone-200">
                  <h3 className="font-semibold text-stone-700 mb-2">
                    👤 Invitados ({trace.guests.length})
                  </h3>
                  <div className="text-sm space-y-1">
                    {trace.guests.map((g: any) => (
                      <p key={g.id} className="text-stone-500">{g.name}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Resumen: todo conectado */}
              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="font-semibold text-green-700 mb-2">✅ Trazabilidad completa</h3>
                <p className="text-sm text-green-600">
                  {trace.eventOrders?.length || 0} órdenes · {trace.shoppingItems?.length || 0} items de compra · 
                  {trace.payments?.length || 0} pagos · {trace.invoices?.length || 0} facturas · 
                  {trace.staffingLines?.length || 0} líneas de personal · {trace.ingredients?.length || 0} ingredientes · 
                  {trace.providers?.length || 0} proveedores · {trace.tables?.length || 0} mesas · 
                  {trace.guests?.length || 0} invitados
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'worker' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
            >
              <option value="">Selecciona un trabajador...</option>
              {workers.map((w: any) => (
                <option key={w.id} value={w.id}>
                  {w.name} — {w.role || w.position || 'general'}
                </option>
              ))}
            </select>
            <button
              onClick={loadWorkerTrace}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg disabled:opacity-50"
            >
              {loading ? 'Cargando...' : 'Trazar'}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {workerTrace && (
            <div className="space-y-4">
              <div className="bg-stone-50 rounded-xl p-4 border border-stone-200">
                <h2 className="font-semibold">{workerTrace.worker.name}</h2>
                <p className="text-sm text-stone-500">
                  {workerTrace.summary.total_events} eventos · 
                  {(workerTrace.summary.total_pay || 0).toLocaleString('es-ES', {
                    style: 'currency',
                    currency: 'EUR',
                  })} total cobrado
                </p>
              </div>

              {workerTrace.events.length > 0 && (
                <div className="space-y-2">
                  {workerTrace.events.map((ev: any) => (
                    <div key={ev.event_id} className="bg-white rounded-xl p-3 border border-stone-200 text-sm">
                      <p>
                        <span className="font-medium">{ev.client_name}</span> — {ev.event_date}
                      </p>
                      {ev.quote_id && (
                        <p className="text-stone-400 text-xs">
                          Presupuesto: {ev.quote_id.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {workerTrace.quotes.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <h3 className="font-semibold text-amber-700 mb-2">📋 Presupuestos asociados</h3>
                  {workerTrace.quotes.map((q: any) => (
                    <p key={q.id} className="text-sm text-amber-600">
                      {q.status} — {(Number(q.total_pvp) || 0).toLocaleString('es-ES', {
                        style: 'currency',
                        currency: 'EUR',
                      })}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'event' && (
        <div className="p-4 bg-stone-50 rounded-xl">
          <p className="text-sm text-stone-500">Selecciona un evento de la lista de presupuestos para ver su detalle completo.</p>
        </div>
      )}
    </div>
  );
}