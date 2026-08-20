'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

interface Event { id: string; client_name: string; event_date: string; guest_count: number; }
interface HojaCarga { id: string; event_id: string; evento_nombre: string; fecha: string; estado: string; notas: string | null; items: ItemCarga[]; }
interface ItemCarga { id: string; tipo: string; nombre: string; cantidad: number; unit: string; cargado: boolean; retornado: boolean | null; notas: string | null; orden: number; }

const TIPOS_CARGA = ['cristaleria', 'cuberteria', 'vajilla', 'textil', 'cocina_fria', 'cocina_caliente', 'bebidas', 'equipos', 'otros'];
const TIPO_LABELS: Record<string, string> = {
  cristaleria: '🥂 Cristalería', cuberteria: '🍴 Cubertería', vajilla: '🍽 Vajilla',
  textil: '👔 Textil', cocina_fria: '🥗 Cocina fría', cocina_caliente: '🍲 Cocina caliente',
  bebidas: '🍷 Bebidas', equipos: '⚙ Equipos', otros: '📦 Otros',
};

const PASES = [
  { id: 1, label: '1er Pase', icon: 'truck', desc: 'Cristalería + Cocina fría' },
  { id: 2, label: '2do Pase', icon: 'cookingPot', desc: 'Cocina caliente + Bebidas' },
  { id: 3, label: '3er Pase', icon: 'package', desc: 'Montaje + Equipos' },
];

export default function CargaPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [hojas, setHojas] = useState<HojaCarga[]>([]);
  const [loading, setLoading] = useState(false);
  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ nombre: '', tipo: 'otros', cantidad: 1, unit: 'ud' });

  useEffect(() => { fetch('/api/events?limit=50', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setEvents(d.data || []); }).catch(() => {}); }, []);

  const loadHojas = useCallback(async () => {
    if (!selectedEvent) { setHojas([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/cocina/carga?event_id=${selectedEvent}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setHojas(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedEvent]);

  useEffect(() => { loadHojas(); }, [loadHojas]);

  const createHoja = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch('/api/cocina/carga', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ evento_id: selectedEvent }),
      });
      const data = await res.json();
      if (data.success) loadHojas();
    } catch (e) { alert('Error al crear'); }
  };

  const generateHoja = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch('/api/cocina/carga', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ evento_id: selectedEvent, generate: true }),
      });
      const data = await res.json();
      if (data.success) {
        loadHojas();
      } else {
        alert(data.error || 'Error al generar');
      }
    } catch (e) { alert('Error al generar'); }
  };

  const addItem = async (hojaId: string) => {
    if (!newItem.nombre.trim()) return;
    try {
      const res = await fetch('/api/cocina/carga/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ hoja_carga_id: hojaId, ...newItem }),
      });
      const data = await res.json();
      if (data.success) { setShowItemForm(null); setNewItem({ nombre: '', tipo: 'otros', cantidad: 1, unit: 'ud' }); loadHojas(); }
    } catch (e) { alert('Error al añadir item'); }
  };

  const toggleCargado = async (item: ItemCarga) => {
    try {
      await fetch('/api/cocina/carga/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: item.id, cargado: !item.cargado }),
      });
      loadHojas();
    } catch (e) { console.error(e); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar item?')) return;
    try {
      await fetch('/api/cocina/carga/items', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id }),
      });
      loadHojas();
    } catch (e) { console.error(e); }
  };

  const getCompletion = (items: ItemCarga[]) => {
    if (!items.length) return 0;
    return Math.round((items.filter(i => i.cargado).length / items.length) * 100);
  };

  const totalItems = hojas.reduce((s, h) => s + h.items.length, 0);
  const cargados = hojas.reduce((s, h) => s + h.items.filter(i => i.cargado).length, 0);
  const pctGeneral = totalItems ? Math.round((cargados / totalItems) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <p className="text-[10px] text-ink-soft mb-0.5">Hojas</p>
          <p className="text-sm font-bold text-ink">{hojas.length}</p>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <p className="text-[10px] text-ink-soft mb-0.5">Items totales</p>
          <p className="text-sm font-bold text-ink">{totalItems}</p>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <p className="text-[10px] text-ink-soft mb-0.5">Cargados</p>
          <p className="text-sm font-bold text-success">{cargados}/{totalItems}</p>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-ink-soft">Carga</p>
            <span className={cn('text-[10px] font-bold', pctGeneral >= 80 ? 'text-success' : pctGeneral >= 50 ? 'text-gold' : 'text-danger')}>{pctGeneral}%</span>
          </div>
          <div className="w-full bg-cream rounded-full h-1.5"><div className={cn('h-1.5 rounded-full transition-all', pctGeneral >= 80 ? 'bg-success' : pctGeneral >= 50 ? 'bg-gold' : 'bg-danger')} style={{ width: `${pctGeneral}%` }} /></div>
        </div>
      </div>

      {/* Selector */}
      <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap items-center gap-2">
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-gold/5 border-gold/20 font-medium">
          <option value="">Seleccionar evento...</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.client_name} — {formatDate(e.event_date)}</option>)}
        </select>
        <button onClick={createHoja} disabled={!selectedEvent} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[10px] font-medium hover:bg-ink-light disabled:opacity-50 flex items-center gap-1">
          <Icon name="plus" className="w-3 h-3" /> Nueva hoja
        </button>
        <button onClick={generateHoja} disabled={!selectedEvent} className="px-3 py-1.5 rounded-lg bg-gold text-white text-[10px] font-medium hover:bg-gold/80 disabled:opacity-50 flex items-center gap-1">
          <Icon name="magic" className="w-3 h-3" /> Generar
        </button>
      </div>

      {!selectedEvent && (
        <div className="bg-white rounded-lg border border-divider/50 p-8 text-center">
          <Icon name="truck" className="w-8 h-8 text-divider mx-auto mb-2" />
          <p className="text-[11px] text-ink-soft">Selecciona un evento para ver su hoja de carga</p>
        </div>
      )}

      {hojas.map(hoja => {
        const pct = getCompletion(hoja.items);
        return (
          <div key={hoja.id} className="bg-white rounded-lg border border-divider/50 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-divider/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-ink">{hoja.evento_nombre}</span>
                <span className={cn('text-[8px] px-1.5 py-0.5 rounded', hoja.estado === 'completada' ? 'bg-success/10 text-success' : 'bg-gold/10 text-gold')}>{hoja.estado}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <span className={cn('text-[10px] font-bold', pct >= 80 ? 'text-success' : pct >= 50 ? 'text-gold' : 'text-danger')}>{pct}%</span>
                  <div className="w-16 bg-cream rounded-full h-1 mt-0.5"><div className={cn('h-1 rounded-full transition-all', pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-gold' : 'bg-danger')} style={{ width: `${pct}%` }} /></div>
                </div>
                <button onClick={() => setShowItemForm(hoja.id)} className="px-2 py-1 rounded-lg bg-cream hover:bg-gold/10 text-[9px] font-medium flex items-center gap-0.5 transition-colors">
                  <Icon name="plus" className="w-2.5 h-2.5" /> Añadir
                </button>
              </div>
            </div>

            {/* Pases */}
            {PASES.map(pase => {
              const paseTipos = pase.id === 1 ? ['cristaleria', 'cubertea', 'cocina_fria'] : pase.id === 2 ? ['cocina_caliente', 'bebidas'] : ['equipos', 'textil', 'vajilla', 'otros'];
              const paseItems = hoja.items.filter(i => paseTipos.some(t => i.tipo.includes(t.replace('cubertea', 'cuberteria'))));
              if (!paseItems.length) return null;
              const pasePct = paseItems.length ? Math.round((paseItems.filter(i => i.cargado).length / paseItems.length) * 100) : 0;

              return (
                <div key={pase.id} className="p-2 border-b border-divider/30">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Icon name={pase.icon} className="w-3 h-3 text-gold" />
                      <span className="text-[10px] font-medium text-ink">{pase.label}</span>
                      <span className="text-[8px] text-ink-soft">({paseItems.length} items)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-[9px] font-bold', pasePct >= 80 ? 'text-success' : pasePct >= 50 ? 'text-gold' : 'text-danger')}>{pasePct}%</span>
                      <div className="w-10 bg-cream rounded-full h-1"><div className={cn('h-1 rounded-full', pasePct >= 80 ? 'bg-success' : pasePct >= 50 ? 'bg-gold' : 'bg-danger')} style={{ width: `${pasePct}%` }} /></div>
                    </div>
                  </div>
                  {paseItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-0.5 px-1 rounded hover:bg-cream/50 group">
                      <button onClick={() => toggleCargado(item)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', item.cargado ? 'bg-success border-success text-white' : 'border-divider hover:border-gold')}>{item.cargado && '✓'}</button>
                      <span className={cn('text-[10px] flex-1 truncate', item.cargado && 'line-through text-ink-soft')}>{item.nombre}</span>
                      <span className="text-[8px] text-ink-soft">{item.cantidad} {item.unit}</span>
                      <span className="text-[8px] px-1 py-0.5 rounded bg-cream text-ink-soft">{TIPO_LABELS[item.tipo] || item.tipo}</span>
                      <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-danger/10 rounded transition-opacity"><Icon name="trash" className="w-2.5 h-2.5 text-danger" /></button>
                    </div>
                  ))}
                </div>
              );
            })}

            {hoja.items.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-[9px] text-ink-soft/50 italic">Sin items — usa "Añadir" para comenzar</p>
              </div>
            )}

            {/* Add item form */}
            {showItemForm === hoja.id && (
              <div className="p-3 bg-cream/50 border-t border-divider/50">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-end">
                  <input value={newItem.nombre} onChange={e => setNewItem(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre..." className="col-span-2 px-2 py-1.5 rounded border border-divider text-[10px]" />
                  <select value={newItem.tipo} onChange={e => setNewItem(p => ({ ...p, tipo: e.target.value }))} className="px-2 py-1.5 rounded border border-divider text-[10px]">
                    {TIPOS_CARGA.map(t => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
                  </select>
                  <input type="number" min="1" value={newItem.cantidad} onChange={e => setNewItem(p => ({ ...p, cantidad: parseInt(e.target.value) || 1 }))} className="px-2 py-1.5 rounded border border-divider text-[10px]" />
                  <div className="flex gap-1">
                    <button onClick={() => addItem(hoja.id)} className="px-2 py-1.5 rounded bg-ink text-white text-[10px] font-medium">+</button>
                    <button onClick={() => setShowItemForm(null)} className="px-2 py-1.5 rounded border border-divider text-[10px]">✕</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}