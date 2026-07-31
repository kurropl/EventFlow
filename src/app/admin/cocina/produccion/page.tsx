'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';

interface Event { id: string; client_name: string; event_date: string; guest_count: number; }
interface TimelineEntry { id?: string; phase: string; concepto: string; planned_time: string; actual_time?: string; duration_minutes?: number; notes?: string; orden: number; }
interface StaffingLine { id: string; role: string; kitchen_zone?: string; previsto: number; real: number; asignado: string; }
interface TareaProduccion { id?: string; nombre: string; asignado_a: string; completado: boolean; zona?: string; hora?: string; }

const PHASES = [
  { id: 'llegada', label: 'Llegada', icon: 'clock', color: 'blue' },
  { id: 'preparacion', label: 'Preparación', icon: 'cookingPot', color: 'gold' },
  { id: 'servicio', label: 'Servicio', icon: 'restaurant', color: 'green' },
  { id: 'limpieza', label: 'Limpieza', icon: 'broom', color: 'purple' },
  { id: 'salida', label: 'Salida', icon: 'exit', color: 'red' },
];

const ZONES = [
  { id: 'aperitivos', label: 'Aperitivos', icon: '🥗', color: 'bg-green-100' },
  { id: 'frio', label: 'Frío', icon: '❄️', color: 'bg-blue-100' },
  { id: 'caliente', label: 'Caliente', icon: '🔥', color: 'bg-orange-100' },
  { id: 'frito', label: 'Frito', icon: '🍟', color: 'bg-yellow-100' },
  { id: 'entrante', label: 'Entrante', icon: '🍽', color: 'bg-purple-100' },
  { id: 'primero', label: 'Primero', icon: '🥘', color: 'bg-red-100' },
  { id: 'segundo', label: 'Segundo', icon: '🥩', color: 'bg-pink-100' },
  { id: 'postre', label: 'Postre', icon: '🍰', color: 'bg-amber-100' },
  { id: 'recena', label: 'Recena', icon: '🌙', color: 'bg-indigo-100' },
];

export default function ProduccionPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [staffing, setStaffing] = useState<StaffingLine[]>([]);
  const [tareas, setTareas] = useState<TareaProduccion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'distribucion' | 'tareas'>('timeline');
  const [showTareaForm, setShowTareaForm] = useState(false);
  const [newTarea, setNewTarea] = useState({ nombre: '', asignado_a: '', zona: 'caliente', hora: '' });

  useEffect(() => { fetch('/api/events?limit=50', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setEvents(d.data || []); }).catch(() => {}); }, []);

  const loadData = useCallback(async () => {
    if (!selectedEvent) { setTimeline([]); setStaffing([]); setTareas([]); return; }
    setLoading(true);
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/cocina/timeline?event_id=${selectedEvent}`, { credentials: 'include' }),
        fetch(`/api/staffing/lines?event_id=${selectedEvent}`, { credentials: 'include' }),
      ]);
      const [tData, sData] = await Promise.all([tRes.json(), sRes.json()]);
      if (tData.success) setTimeline(tData.data || []);
      if (sData.success) setStaffing(sData.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedEvent]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveTimeline = async (entries: TimelineEntry[]) => {
    try {
      await fetch('/api/cocina/timeline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ event_id: selectedEvent, entries }),
      });
      loadData();
    } catch (e) { console.error(e); }
  };

  const addTimelineEntry = (phase: string) => {
    const newEntry: TimelineEntry = {
      phase,
      concepto: '',
      planned_time: '09:00',
      orden: timeline.filter(t => t.phase === phase).length + 1,
    };
    saveTimeline([...timeline, newEntry]);
  };

  const updateTimelineEntry = (index: number, field: string, value: any) => {
    const updated = [...timeline];
    updated[index] = { ...updated[index], [field]: value };
    setTimeline(updated);
  };

  const saveTareas = async () => {
    // Save tasks logic here
    setShowTareaForm(false);
  };

  const addTarea = () => {
    if (!newTarea.nombre) return;
    setTareas(prev => [...prev, { ...newTarea, completado: false }]);
    setNewTarea({ nombre: '', asignado_a: '', zona: 'caliente', hora: '' });
    setShowTareaForm(false);
  };

  const toggleTarea = (index: number) => {
    setTareas(prev => prev.map((t, i) => i === index ? { ...t, completado: !t.completado } : t));
  };

  const deleteTarea = (index: number) => {
    setTareas(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate progress
  const completedTasks = tareas.filter(t => t.completado).length;
  const totalTasks = tareas.length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Group timeline by phase
  const timelineByPhase = PHASES.map(p => ({
    ...p,
    entries: timeline.filter(t => t.phase === p.id).sort((a, b) => a.orden - b.orden),
  }));

  // Group staffing by zone
  const staffingByZone = ZONES.map(z => ({
    ...z,
    workers: staffing.filter(s => s.kitchen_zone === z.id),
  }));

  return (
    <div className="space-y-3">
      {/* Event selector */}
      <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap items-center gap-2">
        <Icon name="cookingPot" className="w-4 h-4 text-gold ml-1" />
        <span className="text-[10px] font-medium text-ink">Producción</span>
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-gold/5 border-gold/20 font-medium">
          <option value="">Seleccionar evento...</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.client_name} — {new Date(e.event_date).toLocaleDateString('es-ES')} ({e.guest_count} pax)</option>)}
        </select>
      </div>

      {!selectedEvent && (
        <div className="bg-white rounded-lg border border-divider/50 p-8 text-center">
          <Icon name="cookingPot" className="w-8 h-8 text-divider mx-auto mb-2" />
          <p className="text-[11px] text-ink-soft">Selecciona un evento para planificar la producción</p>
        </div>
      )}

      {selectedEvent && (
        <>
          {/* Tabs */}
          <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap gap-1">
            <button onClick={() => setActiveTab('timeline')} className={cn('px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all', activeTab === 'timeline' ? 'bg-ink text-white' : 'bg-cream text-ink-soft')}>
              <Icon name="clock" className="w-3 h-3 inline mr-1" />Timing
            </button>
            <button onClick={() => setActiveTab('distribucion')} className={cn('px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all', activeTab === 'distribucion' ? 'bg-ink text-white' : 'bg-cream text-ink-soft')}>
              <Icon name="users" className="w-3 h-3 inline mr-1" />Distribución
            </button>
            <button onClick={() => setActiveTab('tareas')} className={cn('px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all', activeTab === 'tareas' ? 'bg-ink text-white' : 'bg-cream text-ink-soft')}>
              <Icon name="checkSquare" className="w-3 h-3 inline mr-1" />Tareas ({completedTasks}/{totalTasks})
            </button>
          </div>

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-2">
              {timelineByPhase.map(phase => (
                <div key={phase.id} className="bg-white rounded-lg border border-divider/50 overflow-hidden">
                  <div className="px-3 py-2 border-b border-divider/50 bg-cream/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon name={phase.icon} className={cn('w-3.5 h-3.5', `text-${phase.color}`)} />
                      <span className="text-[10px] font-medium text-ink">{phase.label}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-cream text-ink-soft">{phase.entries.length} items</span>
                    </div>
                    <button onClick={() => addTimelineEntry(phase.id)} className="text-[9px] text-gold font-medium hover:underline">+ Añadir</button>
                  </div>
                  {phase.entries.length === 0 ? (
                    <div className="p-3 text-center text-[9px] text-ink-soft/50">Sin entradas</div>
                  ) : (
                    <div className="divide-y divide-divider/30">
                      {phase.entries.map((entry, idx) => {
                        const globalIdx = timeline.indexOf(entry);
                        return (
                          <div key={idx} className="px-3 py-2 flex items-center gap-2">
                            <input type="time" value={entry.planned_time || ''} onChange={e => updateTimelineEntry(globalIdx, 'planned_time', e.target.value)} className="px-2 py-1 rounded border border-divider text-[10px] w-24" />
                            <input value={entry.concepto} onChange={e => updateTimelineEntry(globalIdx, 'concepto', e.target.value)} placeholder="Concepto..." className="flex-1 px-2 py-1 rounded border border-divider text-[10px]" />
                            <input type="number" value={entry.duration_minutes || ''} onChange={e => updateTimelineEntry(globalIdx, 'duration_minutes', parseInt(e.target.value) || null)} placeholder="Min" className="w-16 px-2 py-1 rounded border border-divider text-[10px]" />
                            <button onClick={() => saveTimeline(timeline)} className="text-[9px] text-gold hover:underline">💾</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Distribución Tab */}
          {activeTab === 'distribucion' && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {staffingByZone.map(zone => (
                <div key={zone.id} className="bg-white rounded-lg border border-divider/50 overflow-hidden">
                  <div className={cn('px-3 py-2 border-b border-divider/50', zone.color)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{zone.icon}</span>
                        <span className="text-[10px] font-medium text-ink">{zone.label}</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/80 font-medium">{zone.workers.length} personas</span>
                    </div>
                  </div>
                  <div className="p-2 space-y-1">
                    {zone.workers.length === 0 ? (
                      <p className="text-[9px] text-ink-soft/50 text-center py-2">Sin asignar</p>
                    ) : (
                      zone.workers.map(w => (
                        <div key={w.id} className="flex items-center justify-between py-1 px-2 rounded bg-cream/50">
                          <span className="text-[10px] text-ink">{w.asignado || w.role}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] text-ink-soft">P:{w.previsto}</span>
                            <span className="text-[8px] text-gold">R:{w.real}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tareas Tab */}
          {activeTab === 'tareas' && (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="bg-white rounded-lg border border-divider/50 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-medium text-ink">Progreso</span>
                  <span className={cn('text-[10px] font-bold', progressPct >= 80 ? 'text-success' : progressPct >= 50 ? 'text-gold' : 'text-danger')}>{progressPct}%</span>
                </div>
                <div className="w-full bg-cream rounded-full h-2">
                  <div className={cn('h-2 rounded-full transition-all', progressPct >= 80 ? 'bg-success' : progressPct >= 50 ? 'bg-gold' : 'bg-danger')} style={{ width: `${progressPct}%` }} />
                </div>
                <p className="text-[9px] text-ink-soft mt-1">{completedTasks} de {totalTasks} tareas completadas</p>
              </div>

              {/* Tasks list */}
              <div className="bg-white rounded-lg border border-divider/50 overflow-hidden">
                <div className="px-3 py-2 border-b border-divider/50 flex items-center justify-between">
                  <span className="text-[10px] font-medium text-ink">Lista de Tareas</span>
                  <button onClick={() => setShowTareaForm(true)} className="text-[9px] text-gold font-medium hover:underline">+ Añadir</button>
                </div>
                <div className="divide-y divide-divider/30">
                  {tareas.map((tarea, idx) => (
                    <div key={idx} className={cn('px-3 py-2 flex items-center gap-2 group', tarea.completado && 'opacity-60')}>
                      <button onClick={() => toggleTarea(idx)} className={cn('w-5 h-5 rounded border-2 flex items-center justify-center shrink-0', tarea.completado ? 'bg-success border-success text-white' : 'border-divider hover:border-gold')}>
                        {tarea.completado && '✓'}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[10px] font-medium text-ink truncate', tarea.completado && 'line-through')}>{tarea.nombre}</p>
                        <div className="flex items-center gap-2 text-[8px] text-ink-soft">
                          {tarea.asignado_a && <span>👤 {tarea.asignado_a}</span>}
                          {tarea.hora && <span>🕐 {tarea.hora}</span>}
                          {tarea.zona && <span>{ZONES.find(z => z.id === tarea.zona)?.icon} {tarea.zona}</span>}
                        </div>
                      </div>
                      <button onClick={() => deleteTarea(idx)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-danger/10 rounded transition-opacity">
                        <Icon name="trash" className="w-3 h-3 text-danger" />
                      </button>
                    </div>
                  ))}
                  {tareas.length === 0 && (
                    <div className="p-4 text-center text-[9px] text-ink-soft/50">Sin tareas</div>
                  )}
                </div>
              </div>

              {/* Add task form */}
              {showTareaForm && (
                <div className="bg-cream/50 rounded-lg border border-divider/50 p-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <input value={newTarea.nombre} onChange={e => setNewTarea(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre tarea..." className="col-span-2 px-2 py-1.5 rounded border border-divider text-[10px]" />
                    <select value={newTarea.zona} onChange={e => setNewTarea(p => ({ ...p, zona: e.target.value }))} className="px-2 py-1.5 rounded border border-divider text-[10px]">
                      {ZONES.map(z => <option key={z.id} value={z.id}>{z.icon} {z.label}</option>)}
                    </select>
                    <input type="time" value={newTarea.hora} onChange={e => setNewTarea(p => ({ ...p, hora: e.target.value }))} className="px-2 py-1.5 rounded border border-divider text-[10px]" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addTarea} className="px-3 py-1.5 rounded bg-ink text-white text-[10px] font-medium">Añadir</button>
                    <button onClick={() => setShowTareaForm(false)} className="px-3 py-1.5 rounded border border-divider text-[10px]">Cancelar</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}