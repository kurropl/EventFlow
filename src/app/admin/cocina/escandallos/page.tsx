'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';

interface Event { id: string; client_name: string; event_date: string; guest_count: number; }
interface EscandalloLinea { receta_id: string | null; receta_nombre: string; cantidad_original: number; cantidad_total: number; coste_unitario: number; coste_total: number; unidad: string; }
interface EscandalloData { evento_id: string; evento_nombre: string; evento_fecha: string; pax: number; total_cost: number; coste_por_pax: number; total_ingredientes: number; total_simples: number; ingredientes: { nombre: string; cantidad_total: number; unidad: string; coste_total: number; platos: string[] }[]; }
interface DrinkConfig {
  pct_bebedores: number; bebidas_por_persona: number;
  pct_cerveza: number; pct_vino: number; pct_refresco: number; pct_agua: number;
  cafe_por_persona: boolean; hielo_por_persona: number;
  pct_imprevistos: number; pct_margen: number;
  coste_personal: number; coste_equipamiento: number; coste_otros: number;
}
interface DrinkResult { tipo: string; nombre: string; cantidad_total: number; unidad: string; paquetes_necesarios: number; coste_total: number; }
interface Resumen {
  coste_alimentos: number; coste_bebidas: number; coste_personal: number;
  coste_equipamiento: number; coste_otros: number; subtotal: number;
  imprevistos: number; coste_total: number; margen: number; pvp_total: number; pvp_pax: number;
}

const DEFAULT_CONFIG: DrinkConfig = {
  pct_bebedores: 60, bebidas_por_persona: 2.5,
  pct_cerveza: 30, pct_vino: 50, pct_refresco: 15, pct_agua: 5,
  cafe_por_persona: true, hielo_por_persona: 0.5,
  pct_imprevistos: 5, pct_margen: 25,
  coste_personal: 0, coste_equipamiento: 0, coste_otros: 0,
};

export default function EscandallosPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [escandallo, setEscandallo] = useState<EscandalloData | null>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<DrinkConfig>(DEFAULT_CONFIG);
  const [bebidas, setBebidas] = useState<DrinkResult[]>([]);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [saving, setSaving] = useState(false);
  const [showBebidas, setShowBebidas] = useState(false);
  const [showMargen, setShowMargen] = useState(true);

  useEffect(() => { fetch('/api/events?limit=50', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setEvents(d.data || []); }).catch(() => {}); }, []);

  const loadEscandallo = useCallback(async () => {
    if (!selectedEvent) { setEscandallo(null); return; }
    setLoading(true);
    try {
      // Consume el listado de escandallos (formato con recetas/líneas) y
      // filtra por evento seleccionado. Las cantidades ya vienen escaladas
      // por pax y con unidades humanizadas (g→kg, ml→l).
      const res = await fetch('/api/cocina/escandallos', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const rows = (data.data || []);
        const row = rows.find((r: any) => r.event_id === selectedEvent);
        if (row) {
          const lineas = row.recetas || [];
          // Agrupar por ingrediente/plato: cada línea de escandallo es un
          // ingrediente de un plato (el.cantidad ya es total × pax).
          const ingredientes: EscandalloData['ingredientes'] = lineas.map((l: EscandalloLinea) => ({
            nombre: l.receta_nombre || 'Plato',
            cantidad_total: Number(l.cantidad_total || 0),
            unidad: l.unidad || 'ud',
            coste_total: Number(l.coste_total || 0),
            platos: l.receta_nombre ? [l.receta_nombre] : [],
          }));
          setEscandallo({
            evento_id: row.event_id,
            evento_nombre: row.evento_nombre,
            evento_fecha: row.evento_fecha,
            pax: Number(row.pax || 0),
            total_cost: Number(row.total_cost || 0),
            coste_por_pax: Number(row.cost_per_pax || 0),
            total_ingredientes: ingredientes.length,
            total_simples: ingredientes.length,
            ingredientes,
          });
        } else {
          setEscandallo(null);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedEvent]);

  const loadBebidas = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(`/api/escandallo/${selectedEvent}/bebidas`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data.config);
        setBebidas(data.data.bebidas);
        setResumen(data.data.resumen);
      }
    } catch (e) { console.error(e); }
  }, [selectedEvent]);

  useEffect(() => { loadEscandallo(); }, [loadEscandallo]);
  useEffect(() => { loadBebidas(); }, [loadBebidas]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch(`/api/escandallo/${selectedEvent}/bebidas`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify(config),
      });
      loadBebidas();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const updateConfig = (field: keyof DrinkConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  const sorted = escandallo ? [...escandallo.ingredientes].sort((a, b) => b.coste_total - a.coste_total) : [];
  const totalBebidas = bebidas.reduce((s, b) => s + b.coste_total, 0);

  return (
    <div className="space-y-3">
      {/* Event selector */}
      <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap items-center gap-2">
        <Icon name="calculator" className="w-4 h-4 text-gold ml-1" />
        <span className="text-[10px] font-medium text-ink">Escandallo</span>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-gold/5 border-gold/20 font-medium">
          <option value="">Seleccionar evento...</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.client_name} — {new Date(e.event_date).toLocaleDateString('es-ES')} ({e.guest_count} pax)</option>)}
        </select>
      </div>

      {loading && (
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-white border border-divider animate-pulse" />)}
        </div>
      )}

      {!selectedEvent && !loading && (
        <div className="bg-white rounded-lg border border-divider/50 p-8 text-center">
          <Icon name="calculator" className="w-8 h-8 text-divider mx-auto mb-2" />
          <p className="text-[11px] text-ink-soft">Selecciona un evento para ver el escandallo completo</p>
        </div>
      )}

      {escandallo && !loading && (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-white rounded-lg border border-divider/50 p-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center"><Icon name="users" className="w-3.5 h-3.5 text-gold" /></div>
                <div><p className="text-[10px] text-ink-soft">Comensales</p><p className="text-sm font-bold text-ink">{escandallo.pax}</p></div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-divider/50 p-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center"><Icon name="receipt" className="w-3.5 h-3.5 text-success" /></div>
                <div><p className="text-[10px] text-ink-soft">Coste alimentos</p><p className="text-sm font-bold text-ink">{Number(escandallo.total_cost).toFixed(2)}€</p></div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-divider/50 p-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Icon name="wine" className="w-3.5 h-3.5 text-blue-500" /></div>
                <div><p className="text-[10px] text-ink-soft">Coste bebidas</p><p className="text-sm font-bold text-ink">{totalBebidas.toFixed(2)}€</p></div>
              </div>
            </div>
            <div className={cn('rounded-lg border p-3', resumen && resumen.pvp_pax > 0 ? 'bg-gold/5 border-gold/30' : 'bg-white border-divider/50')}>
              <div className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', resumen && resumen.pvp_pax > 0 ? 'bg-gold/20' : 'bg-cream')}><Icon name="bank" className={cn('w-3.5 h-3.5', resumen && resumen.pvp_pax > 0 ? 'text-gold' : 'text-ink-soft')} /></div>
                <div><p className="text-[10px] text-ink-soft">PVP/pax</p><p className="text-sm font-bold text-ink">{resumen ? resumen.pvp_pax.toFixed(2) + '€' : '-'}</p></div>
              </div>
            </div>
          </div>

          {/* Content grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Main content - Ingredients */}
            <div className="lg:col-span-2 space-y-3">
              {/* Ingredientes table */}
              <div className="bg-white rounded-lg border border-divider/50 overflow-hidden">
                <div className="px-3 py-2 border-b border-divider/50 bg-cream/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="list" className="w-3.5 h-3.5 text-gold" />
                    <span className="text-[11px] font-medium text-ink">Ingredientes × pax</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-cream text-ink-soft">{sorted.length} items</span>
                  </div>
                  <span className="text-[11px] font-bold text-ink">{Number(escandallo.total_cost).toFixed(2)}€</span>
                </div>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-ink-soft border-b border-divider/50">
                        <th className="px-2 py-1.5 text-left font-medium">Ingrediente</th>
                        <th className="px-2 py-1.5 text-right font-medium">Cant.</th>
                        <th className="px-2 py-1.5 text-right font-medium">Coste</th>
                        <th className="px-2 py-1.5 text-left font-medium">Platos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider/30">
                      {sorted.map((ing, i) => (
                        <tr key={i} className="hover:bg-cream/30">
                          <td className="px-2 py-1.5 font-medium text-ink">{ing.nombre}</td>
                          <td className="px-2 py-1.5 text-right">{Number(ing.cantidad_total).toLocaleString('es-ES', { maximumFractionDigits: 2 })} <span className="text-ink-soft">{ing.unidad}</span></td>
                          <td className="px-2 py-1.5 text-right font-medium">{Number(ing.coste_total).toFixed(2)}€</td>
                          <td className="px-2 py-1.5"><div className="flex flex-wrap gap-0.5">{ing.platos.map((p, j) => <span key={j} className="px-1 py-0.5 rounded bg-cream text-[8px] text-ink-soft">{p}</span>)}</div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Motor de Bebidas */}
              <div className="bg-white rounded-lg border border-divider/50 overflow-hidden">
                <button onClick={() => setShowBebidas(!showBebidas)} className="w-full px-3 py-2 flex items-center justify-between hover:bg-cream/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon name="wine" className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-[11px] font-medium text-ink">Motor de Bebidas</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">{totalBebidas.toFixed(2)}€</span>
                  </div>
                  <Icon name={showBebidas ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-ink-soft" />
                </button>
                {showBebidas && (
                  <div className="p-3 border-t border-divider/50 space-y-3">
                    {/* Config sliders */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="text-[9px] text-ink-soft block mb-1">% Bebedores</label>
                        <div className="flex items-center gap-1">
                          <input type="range" min="0" max="100" value={config.pct_bebedores} onChange={e => updateConfig('pct_bebedores', Number(e.target.value))} className="flex-1 h-1" />
                          <span className="text-[10px] font-medium w-8 text-right">{config.pct_bebedores}%</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-ink-soft block mb-1">Bebidas/pax</label>
                        <div className="flex items-center gap-1">
                          <input type="range" min="0" max="5" step="0.5" value={config.bebidas_por_persona} onChange={e => updateConfig('bebidas_por_persona', Number(e.target.value))} className="flex-1 h-1" />
                          <span className="text-[10px] font-medium w-8 text-right">{config.bebidas_por_persona}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-ink-soft block mb-1">% Vino</label>
                        <div className="flex items-center gap-1">
                          <input type="range" min="0" max="100" value={config.pct_vino} onChange={e => updateConfig('pct_vino', Number(e.target.value))} className="flex-1 h-1" />
                          <span className="text-[10px] font-medium w-8 text-right">{config.pct_vino}%</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[9px] text-ink-soft block mb-1">% Cerveza</label>
                        <div className="flex items-center gap-1">
                          <input type="range" min="0" max="100" value={config.pct_cerveza} onChange={e => updateConfig('pct_cerveza', Number(e.target.value))} className="flex-1 h-1" />
                          <span className="text-[10px] font-medium w-8 text-right">{config.pct_cerveza}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Results table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px]">
                        <thead>
                          <tr className="bg-cream/50 text-ink-soft">
                            <th className="px-2 py-1 text-left">Producto</th>
                            <th className="px-2 py-1 text-right">Cantidad</th>
                            <th className="px-2 py-1 text-right">Paquetes</th>
                            <th className="px-2 py-1 text-right">Coste</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-divider/30">
                          {bebidas.map((b, i) => (
                            <tr key={i}>
                              <td className="px-2 py-1 font-medium text-ink">{b.nombre}</td>
                              <td className="px-2 py-1 text-right">{b.cantidad_total} {b.unidad}</td>
                              <td className="px-2 py-1 text-right">{b.paquetes_necesarios}</td>
                              <td className="px-2 py-1 text-right font-medium">{b.coste_total.toFixed(2)}€</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-cream/50 font-medium">
                            <td colSpan={3} className="px-2 py-1 text-right text-ink-soft">TOTAL BEBIDAS</td>
                            <td className="px-2 py-1 text-right">{totalBebidas.toFixed(2)}€</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <button onClick={saveConfig} disabled={saving} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[10px] font-medium hover:bg-ink-light disabled:opacity-50">
                      {saving ? 'Guardando...' : 'Guardar configuración'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar - Panel Margen/PVP */}
            <div className="space-y-3">
              <div className="bg-white rounded-lg border border-divider/50 overflow-hidden">
                <button onClick={() => setShowMargen(!showMargen)} className="w-full px-3 py-2 flex items-center justify-between hover:bg-cream/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <Icon name="bank" className="w-3.5 h-3.5 text-gold" />
                    <span className="text-[11px] font-medium text-ink">Margen y PVP</span>
                  </div>
                  <Icon name={showMargen ? 'chevronUp' : 'chevronDown'} className="w-4 h-4 text-ink-soft" />
                </button>
                {showMargen && resumen && (
                  <div className="p-3 border-t border-divider/50 space-y-2">
                    {/* Cost breakdown */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-ink-soft">Gastronomía</span>
                        <span className="font-medium">{resumen.coste_alimentos.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-ink-soft">Bebidas</span>
                        <span className="font-medium">{resumen.coste_bebidas.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-ink-soft">Personal</span>
                        <input type="number" value={config.coste_personal} onChange={e => updateConfig('coste_personal', Number(e.target.value))} className="w-20 px-1 py-0.5 rounded border border-divider text-[10px] text-right" />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-ink-soft">Equipamiento</span>
                        <input type="number" value={config.coste_equipamiento} onChange={e => updateConfig('coste_equipamiento', Number(e.target.value))} className="w-20 px-1 py-0.5 rounded border border-divider text-[10px] text-right" />
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span className="text-ink-soft">Otros</span>
                        <input type="number" value={config.coste_otros} onChange={e => updateConfig('coste_otros', Number(e.target.value))} className="w-20 px-1 py-0.5 rounded border border-divider text-[10px] text-right" />
                      </div>
                    </div>

                    <div className="border-t border-divider/50 pt-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-ink-soft">Subtotal</span>
                        <span className="font-medium">{resumen.subtotal.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mt-1">
                        <span className="text-ink-soft">+ Imprevistos</span>
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="20" value={config.pct_imprevistos} onChange={e => updateConfig('pct_imprevistos', Number(e.target.value))} className="w-12 px-1 py-0.5 rounded border border-divider text-[10px] text-right" />
                          <span className="text-ink-soft">%</span>
                          <span className="font-medium w-14 text-right">{resumen.imprevistos.toFixed(2)}€</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10px] mt-1">
                        <span className="text-ink-soft">+ Margen</span>
                        <div className="flex items-center gap-1">
                          <input type="number" min="0" max="50" value={config.pct_margen} onChange={e => updateConfig('pct_margen', Number(e.target.value))} className="w-12 px-1 py-0.5 rounded border border-divider text-[10px] text-right" />
                          <span className="text-ink-soft">%</span>
                          <span className="font-medium w-14 text-right">{resumen.margen.toFixed(2)}€</span>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-divider/50 pt-2">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-ink">Coste total</span>
                        <span className="text-ink">{resumen.coste_total.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold mt-1">
                        <span className="text-gold">PVP Total</span>
                        <span className="text-gold">{resumen.pvp_total.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-gold">PVP/pax</span>
                        <span className="text-gold text-lg">{resumen.pvp_pax.toFixed(2)}€</span>
                      </div>
                    </div>

                    <button onClick={saveConfig} disabled={saving} className="w-full py-2 rounded-lg bg-gold text-white text-[11px] font-medium hover:bg-gold-light disabled:opacity-50 transition-colors">
                      {saving ? 'Guardando...' : 'Guardar todo'}
                    </button>
                  </div>
                )}
              </div>

              {/* Info card */}
              <div className="bg-cream/50 rounded-lg border border-divider/50 p-3">
                <div className="flex items-start gap-2">
                  <Icon name="info" className="w-3.5 h-3.5 text-gold mt-0.5" />
                  <div className="text-[9px] text-ink-soft space-y-1">
                    <p><strong>Motor de Bebidas:</strong> Ajusta el % de bebedores y la distribución de bebidas. El sistema calcula automáticamente las cantidades necesarias.</p>
                    <p><strong>Panel de Margen:</strong> Configura imprevistos, margen y costes adicionales para obtener el PVP de venta.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}