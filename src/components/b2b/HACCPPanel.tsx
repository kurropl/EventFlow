'use client';

/**
 * HACCPPanel — Panel de APPCC para cocina
 *
 * Unifica en un solo espacio:
 * - Dashboard de estado (contadores)
 * - Monitorización de temperaturas (neveras y cocción)
 * - Registro de limpieza
 * - Trazabilidad de lotes
 * - Proveedores homologados
 * - Calibración de equipos
 *
 * J.Benitez — EventFlow ERP
 */

import { useState, useEffect, useCallback } from 'react';
import { Thermometer, Droplets, ClipboardCheck, Package, Truck, Wrench, RefreshCw, AlertTriangle, Check, X } from 'lucide-react';

/* ── Types ── */
interface DashboardData {
  plansActive: number;
  fridgeCritical: number;
  cleaningToday: number;
  suppliersActive: number;
  traceToday: number;
  monitoringAlerts: number;
}

interface FridgeLog {
  id: string;
  fridge_name: string;
  fridge_type: string;
  recorded_at: string;
  temperature: number;
  target_min: number;
  target_max: number;
  status: string;
  recorded_by: string;
  notes: string | null;
}

interface CleaningEntry {
  id: string;
  area: string;
  schedule: string;
  performed_at: string;
  performed_by: string;
  verified_by: string | null;
  verified_at: string | null;
  products_used: string[] | null;
  notes: string | null;
  event_name?: string;
}

interface TraceEntry {
  id: string;
  lot_number: string;
  ingredient_name: string | null;
  recipe_name: string | null;
  event_name: string | null;
  quantity_used: number;
  unit: string;
  used_at: string;
  used_by: string | null;
  is_critical: boolean;
}

/* ── Main Component ── */
export default function HACCPPanel({ eventId }: { eventId?: string }) {
  const [tab, setTab] = useState<'dashboard' | 'fridge' | 'cleaning' | 'traceability' | 'monitoring'>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [fridgeLogs, setFridgeLogs] = useState<FridgeLog[]>([]);
  const [cleaningLogs, setCleaningLogs] = useState<CleaningEntry[]>([]);
  const [traceLogs, setTraceLogs] = useState<TraceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const apiUrl = (resource: string) =>
    `/api/appcc/${resource}${eventId ? `?event_id=${eventId}` : ''}`;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, fridgeRes, cleanRes, traceRes] = await Promise.all([
        fetch(apiUrl('dashboard')),
        fetch(`${apiUrl('fridge')}&order=ft.recorded_at DESC&limit=20`),
        fetch(`${apiUrl('cleaning')}&order=cl.performed_at DESC&limit=15`),
        fetch(`${apiUrl('traceability')}&order=tl.used_at DESC&limit=20`),
      ]);

      const dash = await dashRes.json();
      const fridge = await fridgeRes.json();
      const clean = await cleanRes.json();
      const trace = await traceRes.json();

      if (dash.success) setDashboard(dash.data);
      if (fridge.success) setFridgeLogs(fridge.data || []);
      if (clean.success) setCleaningLogs(clean.data || []);
      if (trace.success) setTraceLogs(trace.data || []);
    } catch {
      setError('Error al cargar datos APPCC');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── New Fridge Temp ── */
  const [newTemp, setNewTemp] = useState({ fridge_name: '', temperature: '', recorded_by: '' });
  const [savingTemp, setSavingTemp] = useState(false);
  const [tempMsg, setTempMsg] = useState('');

  const recordTemp = async () => {
    if (!newTemp.fridge_name || !newTemp.temperature || !newTemp.recorded_by) return;
    setSavingTemp(true);
    setTempMsg('');
    try {
      const res = await fetch('/api/appcc/fridge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(eventId ? { event_id: eventId } : {}),
          fridge_name: newTemp.fridge_name,
          temperature: parseFloat(newTemp.temperature),
          recorded_by: newTemp.recorded_by,
          fridge_type: 'fridge',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTempMsg('✅ Registrada');
        setNewTemp({ fridge_name: '', temperature: '', recorded_by: '' });
        loadData();
      }
    } catch {
      setTempMsg('❌ Error');
    }
    setSavingTemp(false);
  };

  /* ── New Cleaning ── */
  const [newClean, setNewClean] = useState({ area: '', performed_by: '', products_used: '' });
  const [savingClean, setSavingClean] = useState(false);
  const [cleanMsg, setCleanMsg] = useState('');

  const recordCleaning = async () => {
    if (!newClean.area || !newClean.performed_by) return;
    setSavingClean(true);
    setCleanMsg('');
    try {
      const res = await fetch('/api/appcc/cleaning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(eventId ? { event_id: eventId } : {}),
          area: newClean.area,
          performed_by: newClean.performed_by,
          schedule: 'diario',
          products_used: newClean.products_used ? newClean.products_used.split(',').map(s => s.trim()) : [],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCleanMsg('✅ Registrado');
        setNewClean({ area: '', performed_by: '', products_used: '' });
        loadData();
      }
    } catch {
      setCleanMsg('❌ Error');
    }
    setSavingClean(false);
  };

  const tempColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-100 border-red-300 text-red-800';
      case 'warning': return 'bg-amber-100 border-amber-300 text-amber-800';
      default: return 'bg-green-100 border-green-300 text-green-800';
    }
  };

  const TABS = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: ClipboardCheck },
    { id: 'fridge' as const, label: 'Neveras', icon: Thermometer },
    { id: 'cleaning' as const, label: 'Limpieza', icon: Droplets },
    { id: 'traceability' as const, label: 'Trazabilidad', icon: Package },
    { id: 'monitoring' as const, label: 'Alertas', icon: AlertTriangle },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-stone-800 text-sm flex items-center gap-2">
          <ClipboardCheck className="w-4 h-4 text-emerald-600" />
          APPCC — Control Sanitario
        </h3>
        <button onClick={loadData} className="p-1.5 rounded hover:bg-stone-100 text-stone-400 hover:text-stone-600 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{error}</div>
      )}

      {/* Dashboard mini-counters */}
      {dashboard && tab === 'dashboard' && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Alertas monitoriz.', value: dashboard.monitoringAlerts, color: dashboard.monitoringAlerts > 0 ? 'text-red-600 bg-red-50' : 'text-stone-500 bg-stone-50' },
            { label: 'Neveras críticas', value: dashboard.fridgeCritical, color: dashboard.fridgeCritical > 0 ? 'text-red-600 bg-red-50' : 'text-stone-500 bg-stone-50' },
            { label: 'Limpiezas hoy', value: dashboard.cleaningToday, color: 'text-emerald-600 bg-emerald-50' },
            { label: 'Planes activos', value: dashboard.plansActive, color: 'text-blue-600 bg-blue-50' },
            { label: 'Proveedores ok', value: dashboard.suppliersActive, color: 'text-stone-500 bg-stone-50' },
            { label: 'Trazabilidad hoy', value: dashboard.traceToday, color: 'text-stone-500 bg-stone-50' },
          ].map((item, i) => (
            <div key={i} className={`rounded-lg p-3 border ${item.color}`}>
              <p className="text-lg font-bold font-mono">{item.value}</p>
              <p className="text-[9px] uppercase tracking-wider mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium whitespace-nowrap transition-all
              ${tab === t.id ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-6 text-stone-400 text-xs">Cargando APPCC...</div>}

      {/* ═══ FRIDGE ═══ */}
      {tab === 'fridge' && !loading && (
        <div className="space-y-3">
          {/* New Temp Form */}
          <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-stone-700">Registrar temperatura</p>
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Nevera (ej: Frigorífico 1)"
                value={newTemp.fridge_name}
                onChange={e => setNewTemp(p => ({ ...p, fridge_name: e.target.value }))}
                className="text-xs border border-stone-200 rounded-lg px-3 py-2 w-full"
              />
              <input
                type="number" step="0.1"
                placeholder="Temperatura °C"
                value={newTemp.temperature}
                onChange={e => setNewTemp(p => ({ ...p, temperature: e.target.value }))}
                className="text-xs border border-stone-200 rounded-lg px-3 py-2 w-full"
              />
              <input
                placeholder="Quién registra"
                value={newTemp.recorded_by}
                onChange={e => setNewTemp(p => ({ ...p, recorded_by: e.target.value }))}
                className="text-xs border border-stone-200 rounded-lg px-3 py-2 w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={recordTemp} disabled={savingTemp}
                className="px-3 py-1.5 rounded bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
                {savingTemp ? 'Guardando...' : 'Registrar'}
              </button>
              {tempMsg && <span className="text-xs text-stone-500">{tempMsg}</span>}
            </div>
          </div>

          {/* History */}
          <div className="space-y-2">
            {fridgeLogs.length === 0 ? (
              <div className="text-center py-4 text-stone-400 text-xs">Sin registros de temperatura</div>
            ) : (
              fridgeLogs.map(log => (
                <div key={log.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${tempColor(log.status)}`}>
                  <div>
                    <p className="text-xs font-medium">{log.fridge_name}</p>
                    <p className="text-[10px] opacity-70">{new Date(log.recorded_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} — {log.recorded_by}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-mono">{log.temperature}°C</p>
                    {log.target_min && log.target_max && (
                      <p className="text-[9px] opacity-60">rango: {log.target_min}~{log.target_max}°C</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══ CLEANING ═══ */}
      {tab === 'cleaning' && !loading && (
        <div className="space-y-3">
          {/* New Cleaning Form */}
          <div className="bg-white border border-stone-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-stone-700">Registrar limpieza</p>
            <div className="grid grid-cols-3 gap-2">
              <input
                placeholder="Zona (ej: Cocina fría)"
                value={newClean.area}
                onChange={e => setNewClean(p => ({ ...p, area: e.target.value }))}
                className="text-xs border border-stone-200 rounded-lg px-3 py-2 w-full"
              />
              <input
                placeholder="Quién realiza"
                value={newClean.performed_by}
                onChange={e => setNewClean(p => ({ ...p, performed_by: e.target.value }))}
                className="text-xs border border-stone-200 rounded-lg px-3 py-2 w-full"
              />
              <input
                placeholder="Productos (coma separado)"
                value={newClean.products_used}
                onChange={e => setNewClean(p => ({ ...p, products_used: e.target.value }))}
                className="text-xs border border-stone-200 rounded-lg px-3 py-2 w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={recordCleaning} disabled={savingClean}
                className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                {savingClean ? 'Guardando...' : 'Registrar'}
              </button>
              {cleanMsg && <span className="text-xs text-stone-500">{cleanMsg}</span>}
            </div>
          </div>

          {/* History */}
          <div className="space-y-2">
            {cleaningLogs.length === 0 ? (
              <div className="text-center py-4 text-stone-400 text-xs">Sin registros de limpieza</div>
            ) : (
              cleaningLogs.map(cl => (
                <div key={cl.id} className="flex items-start gap-3 p-3 rounded-lg border border-stone-200 bg-white">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Droplets className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-stone-700">{cl.area}</p>
                    <p className="text-[10px] text-stone-400">{cl.performed_by} — {new Date(cl.performed_at).toLocaleString('es-ES')}</p>
                    {cl.products_used && cl.products_used.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {cl.products_used.map((p, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{p}</span>
                        ))}
                      </div>
                    )}
                    {cl.verified_by && (
                      <p className="text-[10px] text-green-600 mt-1">✅ Verificado por {cl.verified_by}</p>
                    )}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 uppercase">{cl.schedule}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══ TRACEABILITY ═══ */}
      {tab === 'traceability' && !loading && (
        <div className="space-y-2">
          {traceLogs.length === 0 ? (
            <div className="text-center py-4 text-stone-400 text-xs">Sin registros de trazabilidad</div>
          ) : (
            traceLogs.map(tr => (
              <div key={tr.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${tr.is_critical ? 'bg-red-50 border-red-200' : 'bg-white border-stone-200'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Package className={`w-4 h-4 shrink-0 ${tr.is_critical ? 'text-red-500' : 'text-stone-400'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{tr.ingredient_name || 'Desconocido'}</p>
                    <p className="text-[10px] text-stone-400">
                      Lote: {tr.lot_number}
                      {tr.recipe_name && <> — {tr.recipe_name}</>}
                      {tr.event_name && <> — {tr.event_name}</>}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-xs font-mono font-bold">{Number(tr.quantity_used).toFixed(2)} {tr.unit}</p>
                  <p className="text-[9px] text-stone-400">{new Date(tr.used_at).toLocaleDateString('es-ES')}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ MONITORING ═══ */}
      {tab === 'monitoring' && !loading && (
        <div className="space-y-2">
          <div className="text-center py-4 text-stone-400 text-xs">
            <AlertTriangle className="w-6 h-6 mx-auto mb-2 opacity-40" />
            Vista de alertas de monitorización próximamente
          </div>
        </div>
      )}
    </div>
  );
}