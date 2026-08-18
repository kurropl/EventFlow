'use client';

import { useState, useEffect } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';

/* ─────────────── Types ─────────────── */
interface Event { id: string; client_name: string; event_date: string; guest_count: number; }
interface ControlRecepcion { proveedor: string; producto: string; temp: number | null; embalajeOk: boolean; caducidadOk: boolean; ok: boolean; }
interface ControlAlmacenamiento { camara: string; tempManana: number | null; tempTarde: number | null; ok: boolean; }
interface ControlElaboracion { plato: string; tempCoccion: number | null; horaCoccion: string; responsable: string; ok: boolean; }
interface ControlServicio { zona: string; temp: number | null; hora: string; ok: boolean; }
interface TareaLimpieza { zona: string; tarea: string; realizada: boolean; responsable: string; }
interface Incidencia { descripcion: string; tipo: string; accion: string; responsable: string; resuelta: boolean; hora: string; }

const CAMARAS = ['Cámara 1 (Refrigerada)', 'Cámara 2 (Congelación)', 'Botellero', 'Expositor frío'];
const ZONAS_LIMPIEZA = [
  { zona: 'Cocina', tareas: ['Encimeras y superficies', 'Suelos', 'Fregaderos', 'Campana extractora'] },
  { zona: 'Cámara refrigerada', tareas: ['Estantes y paredes', 'Suelo', 'Puerta y junta'] },
  { zona: 'Zona de servicio', tareas: ['Buffet / vitrina', 'Barra', 'Utensilios'] },
  { zona: 'Baños y vestuarios', tareas: ['Lavabos e inodoros', 'Suelos', 'Papeleras'] },
];
const TABS = [
  { id: 'recepcion', label: 'Recepción', icon: 'truck' },
  { id: 'almacenamiento', label: 'Almacén', icon: 'package' },
  { id: 'elaboracion', label: 'Elaboración', icon: 'cookingPot' },
  { id: 'servicio', label: 'Servicio', icon: 'wine' },
  { id: 'limpieza', label: 'Limpieza', icon: 'list' },
  { id: 'incidencias', label: 'Incidencias', icon: 'warning' },
  { id: 'aceite', label: 'Aceite', icon: 'cookingPot' },
];

export default function AppccPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [centro, setCentro] = useState('J.Benitez — Cocina Central');
  const [activeTab, setActiveTab] = useState('recepcion');
  const [recepciones, setRecepciones] = useState<ControlRecepcion[]>([{ proveedor: '', producto: '', temp: null, embalajeOk: false, caducidadOk: false, ok: false }]);
  const [almacenamiento, setAlmacenamiento] = useState<ControlAlmacenamiento[]>(CAMARAS.map(c => ({ camara: c, tempManana: null, tempTarde: null, ok: false })));
  const [elaboraciones, setElaboraciones] = useState<ControlElaboracion[]>([]);
  const [servicios, setServicios] = useState<ControlServicio[]>([{ zona: 'Buffet caliente', temp: null, hora: '', ok: false }, { zona: 'Buffet frío', temp: null, hora: '', ok: false }, { zona: 'Barra', temp: null, hora: '', ok: false }]);
  const [limpiezas, setLimpiezas] = useState<TareaLimpieza[]>(ZONAS_LIMPIEZA.flatMap(z => z.tareas.map(t => ({ zona: z.zona, tarea: t, realizada: false, responsable: '' }))));
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [nuevaIncidencia, setNuevaIncidencia] = useState({ descripcion: '', tipo: 'averia', accion: '', responsable: '' });
  const [aceite, setAceite] = useState({ compuestosPolares: 0, cambiado: false });

  useEffect(() => { fetch('/api/events?limit=50', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setEvents(d.data || []); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!selectedEvent) return;
    fetch(`/api/escandallo/event/${selectedEvent}`).then(r => r.json()).then(d => {
      if (d.success) setElaboraciones((d.data.theoretical || []).map((i: any) => ({ plato: i.ingredient_name, tempCoccion: null, horaCoccion: '', responsable: '', ok: false })));
    }).catch(() => {});
  }, [selectedEvent]);

  const addRecepcion = () => setRecepciones(p => [...p, { proveedor: '', producto: '', temp: null, embalajeOk: false, caducidadOk: false, ok: false }]);
  const updateRec = (i: number, f: string, v: any) => setRecepciones(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));
  const updateAlm = (i: number, f: string, v: any) => setAlmacenamiento(p => p.map((a, idx) => idx === i ? { ...a, [f]: v } : a));
  const updateElab = (i: number, f: string, v: any) => setElaboraciones(p => p.map((e, idx) => idx === i ? { ...e, [f]: v } : e));
  const updateServ = (i: number, f: string, v: any) => setServicios(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const updateLimp = (i: number, f: string, v: any) => setLimpiezas(p => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l));

  const addIncidencia = () => { if (!nuevaIncidencia.descripcion) return; setIncidencias(p => [...p, { ...nuevaIncidencia, resuelta: false, hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }]); setNuevaIncidencia({ descripcion: '', tipo: 'averia', accion: '', responsable: '' }); };

  const completados = (arr: any[]) => arr.filter((x: any) => x.ok || x.realizada || x.resuelta).length;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-ink-soft font-medium block mb-0.5">Centro</label>
          <select value={centro} onChange={e => setCentro(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-gold/5 border-gold/20 font-medium">
            <option value="Cocina Central">Cocina Central</option>
            <option value="Sala Principal">Sala Principal</option>
            <option value="Truck Externo">Truck Externo</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-ink-soft font-medium block mb-0.5">Fecha</label>
          <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-2 py-1.5 rounded-lg border border-divider text-[11px]" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all', activeTab === tab.id ? 'bg-ink text-white shadow-sm' : 'bg-white text-ink-soft hover:bg-cream border border-divider/50')}>
            <Icon name={tab.icon} className="w-3 h-3" />{tab.label}
          </button>
        ))}
      </div>

      {/* RECEPCIÓN */}
      {activeTab === 'recepcion' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-2">
            <p className="text-[10px] text-ink flex items-center gap-1"><Icon name="info" className="w-3 h-3 text-gold" /> Recepción: proveedor, temp (ref ≤4°C / cong ≤-18°C), embalaje y caducidad</p>
          </div>
          {recepciones.map((r, i) => (
            <div key={i} className={cn('bg-white rounded-lg border border-divider/50 p-3', r.ok && 'opacity-60')}>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                <input value={r.proveedor} onChange={e => updateRec(i, 'proveedor', e.target.value)} placeholder="Proveedor" className="sm:col-span-2 px-2 py-1.5 rounded border border-divider text-[11px]" />
                <input value={r.producto} onChange={e => updateRec(i, 'producto', e.target.value)} placeholder="Producto" className="px-2 py-1.5 rounded border border-divider text-[11px]" />
                <input type="number" step="0.1" value={r.temp ?? ''} onChange={e => updateRec(i, 'temp', e.target.value ? Number(e.target.value) : null)} placeholder="Temp °C" className="px-2 py-1.5 rounded border border-divider text-[11px]" />
                <div className="flex items-center gap-1"><label onClick={() => updateRec(i, 'embalajeOk', !r.embalajeOk)} className={cn('text-[9px] px-1.5 py-1 rounded cursor-pointer', r.embalajeOk ? 'bg-success/10 text-success' : 'border border-divider')}>Embalaje</label><label onClick={() => updateRec(i, 'caducidadOk', !r.caducidadOk)} className={cn('text-[9px] px-1.5 py-1 rounded cursor-pointer', r.caducidadOk ? 'bg-success/10 text-success' : 'border border-divider')}>Caducidad</label></div>
                <button onClick={() => updateRec(i, 'ok', !r.ok)} className={cn('px-2 py-1 rounded text-[10px] font-medium', r.ok ? 'bg-success text-white' : 'bg-ink text-white')}>{r.ok ? '✓ OK' : 'Validar'}</button>
              </div>
            </div>
          ))}
          <button onClick={addRecepcion} className="px-3 py-1.5 rounded-lg border border-divider text-[10px] text-ink-soft hover:bg-cream flex items-center gap-1"><Icon name="plus" className="w-3 h-3" /> Añadir</button>
        </div>
      )}

      {/* ALMACÉN */}
      {activeTab === 'almacenamiento' && (
        <div className="space-y-2">
          {almacenamiento.map((a, i) => (
            <div key={i} className={cn('bg-white rounded-lg border border-divider/50 p-3', a.ok && 'opacity-60')}>
              <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-medium text-ink">{a.camara}</span><button onClick={() => updateAlm(i, 'ok', !a.ok)} className={cn('px-2 py-0.5 rounded text-[9px] font-medium', a.ok ? 'bg-success text-white' : 'bg-ink text-white')}>{a.ok ? '✓' : 'Validar'}</button></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="text-[9px] text-ink-soft block">Mañana °C</label><input type="number" step="0.1" value={a.tempManana ?? ''} onChange={e => updateAlm(i, 'tempManana', e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1 rounded border border-divider text-[11px]" /></div><div><label className="text-[9px] text-ink-soft block">Tarde °C</label><input type="number" step="0.1" value={a.tempTarde ?? ''} onChange={e => updateAlm(i, 'tempTarde', e.target.value ? Number(e.target.value) : null)} className="w-full px-2 py-1 rounded border border-divider text-[11px]" /></div></div>
            </div>
          ))}
        </div>
      )}

      {/* ELABORACIÓN */}
      {activeTab === 'elaboracion' && (
        <div className="space-y-2">
          <p className="text-[10px] text-ink flex items-center gap-1"><Icon name="info" className="w-3 h-3 text-gold" /> Temp. cocción objetivo ≥65°C</p>
          {elaboraciones.length === 0 ? <p className="text-[10px] text-ink-soft">Sin platos</p> : elaboraciones.map((e, i) => (
            <div key={i} className={cn('bg-white rounded-lg border border-divider/50 p-3', e.ok && 'opacity-60')}>
              <div className="flex items-center justify-between mb-1"><span className="text-[11px] font-medium text-ink">{e.plato}</span><button onClick={() => updateElab(i, 'ok', !e.ok)} className={cn('px-2 py-0.5 rounded text-[9px] font-medium', e.ok ? 'bg-success text-white' : 'bg-ink text-white')}>{e.ok ? '✓' : 'Validar'}</button></div>
              <div className="grid grid-cols-3 gap-2">
                <div><label className="text-[9px] text-ink-soft block">Temp °C ≥65</label><input type="number" step="0.1" value={e.tempCoccion ?? ''} onChange={val => updateElab(i, 'tempCoccion', val.target.value ? Number(val.target.value) : null)} className="w-full px-2 py-1 rounded border border-divider text-[11px]" /></div>
                <div><label className="text-[9px] text-ink-soft block">Hora</label><input type="time" value={e.horaCoccion} onChange={val => updateElab(i, 'horaCoccion', val.target.value)} className="w-full px-2 py-1 rounded border border-divider text-[11px]" /></div>
                <div><label className="text-[9px] text-ink-soft block">Responsable</label><input value={e.responsable} onChange={val => updateElab(i, 'responsable', val.target.value)} className="w-full px-2 py-1 rounded border border-divider text-[11px]" /></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SERVICIO */}
      {activeTab === 'servicio' && (
        <div className="space-y-2">
          {servicios.map((s, i) => (
            <div key={i} className={cn('bg-white rounded-lg border border-divider/50 p-3', s.ok && 'opacity-60')}>
              <div className="grid grid-cols-4 gap-2">
                <span className="text-[11px] font-medium text-ink self-center">{s.zona}</span>
                <input type="number" step="0.1" value={s.temp ?? ''} onChange={e => updateServ(i, 'temp', e.target.value ? Number(e.target.value) : null)} placeholder="°C" className="px-2 py-1 rounded border border-divider text-[11px]" />
                <input type="time" value={s.hora} onChange={e => updateServ(i, 'hora', e.target.value)} className="px-2 py-1 rounded border border-divider text-[11px]" />
                <button onClick={() => updateServ(i, 'ok', !s.ok)} className={cn('px-2 py-1 rounded text-[10px] font-medium', s.ok ? 'bg-success text-white' : 'bg-ink text-white')}>{s.ok ? '✓' : 'Validar'}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIMPIEZA */}
      {activeTab === 'limpieza' && (
        <div className="space-y-2">
          {ZONAS_LIMPIEZA.map(z => (
            <div key={z.zona} className="bg-white rounded-lg border border-divider/50 overflow-hidden">
              <div className="px-3 py-1.5 bg-cream/50 text-[11px] font-medium text-ink">{z.zona}</div>
              {limpiezas.filter(l => l.zona === z.zona).map((l, idx) => {
                const ri = limpiezas.findIndex(x => x.zona === l.zona && x.tarea === l.tarea);
                return (
                  <div key={idx} className={cn('flex items-center gap-2 px-3 py-1 border-t border-divider/30', l.realizada && 'opacity-50')}>
                    <button onClick={() => updateLimp(ri, 'realizada', !l.realizada)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', l.realizada ? 'bg-success border-success text-white' : 'border-divider')}>{l.realizada && '✓'}</button>
                    <span className={cn('text-[11px] flex-1', l.realizada && 'line-through')}>{l.tarea}</span>
                    <input value={l.responsable} onChange={e => updateLimp(ri, 'responsable', e.target.value)} placeholder="Resp." className="w-20 px-1 py-0.5 rounded border border-divider text-[9px]" />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* INCIDENCIAS */}
      {activeTab === 'incidencias' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-3 space-y-2">
            <input value={nuevaIncidencia.descripcion} onChange={e => setNuevaIncidencia(p => ({ ...p, descripcion: e.target.value }))} placeholder="Incidencia..." className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
            <div className="flex gap-2">
              <select value={nuevaIncidencia.tipo} onChange={e => setNuevaIncidencia(p => ({ ...p, tipo: e.target.value }))} className="px-2 py-1 rounded border border-divider text-[10px]"><option value="averia">Avería</option><option value="temperatura">Temperatura</option><option value="higiene">Higiene</option></select>
              <input value={nuevaIncidencia.accion} onChange={e => setNuevaIncidencia(p => ({ ...p, accion: e.target.value }))} placeholder="Medida correctora..." className="flex-1 px-2 py-1 rounded border border-divider text-[11px]" />
              <button onClick={addIncidencia} className="px-2 py-1 rounded bg-ink text-white text-[10px] font-medium">+</button>
            </div>
          </div>
          {incidencias.map((inc, i) => (
            <div key={i} className={cn('bg-white rounded-lg border border-divider/50 p-3', inc.resuelta && 'opacity-60')}>
              <div className="flex items-center justify-between"><span className="text-[11px] text-ink">{inc.descripcion}</span><button onClick={() => setIncidencias(p => p.map((x, j) => j === i ? { ...x, resuelta: !x.resuelta } : x))} className={cn('text-[9px] px-1.5 py-0.5 rounded', inc.resuelta ? 'bg-success/10 text-success' : 'border border-divider')}>{inc.resuelta ? 'Resuelta' : 'Pendiente'}</button></div>
            </div>
          ))}
        </div>
      )}

      {/* ACEITE */}
      {activeTab === 'aceite' && (
        <div className="bg-white rounded-lg border border-divider/50 p-3 space-y-2">
          <p className="text-[10px] text-ink flex items-center gap-1"><Icon name="info" className="w-3 h-3 text-gold" /> Límite legal: 25% compuestos polares</p>
          <div className="grid grid-cols-3 gap-2">
            <input type="number" step="0.1" value={aceite.compuestosPolares || ''} onChange={e => setAceite(p => ({ ...p, compuestosPolares: Number(e.target.value) }))} placeholder="Polares %" className="px-2 py-1.5 rounded border border-divider text-[11px]" />
            <button onClick={() => setAceite(p => ({ ...p, cambiado: !p.cambiado }))} className={cn('px-2 py-1 rounded text-[10px] font-medium', aceite.cambiado ? 'bg-success text-white' : 'bg-ink text-white')}>{aceite.cambiado ? 'Cambiado ✓' : 'Marcar cambio'}</button>
          </div>
          {aceite.compuestosPolares > 25 && <p className="text-[10px] text-danger">⚠ Supera 25%</p>}
        </div>
      )}

      {/* Footer */}
      {centro && (
        <div className="bg-ink text-white rounded-lg p-3 grid grid-cols-4 gap-3 text-center">
          <div><Icon name="truck" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(recepciones)}/{recepciones.length}</p><p className="text-[8px] text-white/50">Recepción</p></div>
          <div><Icon name="package" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(almacenamiento)}/{almacenamiento.length}</p><p className="text-[8px] text-white/50">Almacén</p></div>
          <div><Icon name="cookingPot" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(elaboraciones)}/{elaboraciones.length}</p><p className="text-[8px] text-white/50">Cocción</p></div>
          <div><Icon name="list" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(limpiezas)}/{limpiezas.length}</p><p className="text-[8px] text-white/50">Limpieza</p></div>
        </div>
      )}
    </div>
  );
}