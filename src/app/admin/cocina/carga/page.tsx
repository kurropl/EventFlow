'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';

interface Event { id: string; client_name: string; event_date: string; guest_count: number; venue_type?: string; }
interface HojaCarga { id: string; event_id: string; evento_nombre: string; fecha: string; estado: string; notas: string | null; items: ItemCarga[]; }
interface ItemCarga { id: string; tipo: string; nombre: string; cantidad: number; unit: string; cargado: boolean; retornado: boolean | null; notas: string | null; orden: number; pass_number?: number; load_order?: number; }

const TIPOS_CARGA = ['perecedero', 'no_perecedero', 'vajilla', 'pack', 'cristaleria', 'cuberteria', 'textil', 'cocina_fria', 'cocina_caliente', 'bebidas', 'equipos', 'otros'];
const TIPO_LABELS: Record<string, string> = {
  perecedero: '🥩 Perecedero', no_perecedero: '📦 No perecedero', vajilla: '🍽 Vajilla',
  pack: '🎁 Pack', cristaleria: '🥂 Cristalería', cuberteria: '🍴 Cubertería',
  textil: '👔 Textil', cocina_fria: '🥗 Cocina fría', cocina_caliente: '🍲 Cocina caliente',
  bebidas: '🍷 Bebidas', equipos: '⚙ Equipos', otros: '📦 Otros',
};

// ── Carga del camión: backload strategy ──
// Lo que se usa al ÚLTIMO pase va PRIMERO en el camión (fondo)
// Lo que se usa en el PRIMER pase va al FINAL (acceso rápido)
// Criterio: equipment/vajilla primero → no perecedero → perecedero al final

const CARGA_GROUPS = [
  { id: 'equipos', label: 'Equipos', icon: 'truck', color: 'bg-gray-500', desc: 'Mesas, sillas, equipos → primero en el camión' },
  { id: 'vajilla', label: 'Vajilla & Cristalería', icon: 'package', color: 'bg-blue-500', desc: 'Vajilla y cristalería → cargados con equipo' },
  { id: 'pack', label: 'Packs Camareros', icon: 'packageCheck', color: 'bg-purple-500', desc: 'Packs de servicio → junto a equipo' },
  { id: 'no_perecedero', label: 'No perecederos', icon: 'package', color: 'bg-amber-500', desc: 'Conservas, secos → antes de perecederos' },
  { id: 'perecedero', label: 'Perecederos', icon: 'snowflake', color: 'bg-red-500', desc: 'Refrigerados → cargar al final para meter al frío primero' },
  { id: 'otros', label: 'Otros', icon: 'package', color: 'bg-gray-400', desc: 'Material extra' },
] as const;

interface GroupedItem { item: ItemCarga; grupo: string; }

export default function CargaPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [hojas, setHojas] = useState<HojaCarga[]>([]);
  const [loading, setLoading] = useState(false);
  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ nombre: '', tipo: 'otros', cantidad: 1, unit: 'ud', pass_number: null as number | null, load_order: null as number | null });
  const [reorderMode, setReorderMode] = useState(false);

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
      if (data.success) { loadHojas(); } else { alert(data.error || 'Error al generar'); }
    } catch (e) { alert('Error al generar'); }
  };

  const saveReorder = async (hojaId: string, items: ItemCarga[]) => {
    try {
      const res = await fetch('/api/cocina/carga', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'reorder', hoja_carga_id: hojaId, items: items.map(i => ({ id: i.id, load_order: i.load_order, pass_number: i.pass_number })) }),
      });
      const data = await res.json();
      if (data.success) { setReorderMode(false); loadHojas(); }
      else alert(data.error);
    } catch (e) { alert('Error al guardar orden'); }
  };

  const addItem = async (hojaId: string) => {
    if (!newItem.nombre.trim()) return;
    try {
      const res = await fetch('/api/cocina/carga/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ hoja_carga_id: hojaId, ...newItem, pass_number: newItem.pass_number, load_order: newItem.load_order }),
      });
      const data = await res.json();
      if (data.success) { setShowItemForm(null); setNewItem({ nombre: '', tipo: 'otros', cantidad: 1, unit: 'ud', pass_number: null, load_order: null }); loadHojas(); }
      else alert(data.error);
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
    } catch (e) { alert('Error al eliminar'); }
  };

  const moveItem = (hoja: HojaCarga, itemIdx: number, dir: -1 | 1) => {
    setHojas(prev => prev.map(h => {
      if (h.id !== hoja.id) return h;
      const items = [...h.items];
      const idx = itemIdx + dir;
      if (idx < 0 || idx >= items.length) return h;
      [items[itemIdx], items[idx]] = [items[idx], items[itemIdx]];
      // Update orden
      return { ...h, items: items.map((it, i) => ({ ...it, load_order: i + 1 })) };
    }));
  };

  const getCompletion = (items: ItemCarga[]) => {
    if (!items.length) return 0;
    return Math.round((items.filter(i => i.cargado).length / items.length) * 100);
  };

  const totalItems = hojas.reduce((s, h) => s + h.items.length, 0);
  const cargados = hojas.reduce((s, h) => s + h.items.filter(i => i.cargado).length, 0);
  const pctGeneral = totalItems ? Math.round((cargados / totalItems) * 100) : 0;

  // Group items by carga group for display
  const groupItems = (items: ItemCarga[]) => {
    const groups: Record<string, GroupedItem[]> = {};
    for (const g of CARGA_GROUPS) groups[g.id] = [];
    for (const item of items) {
      const group = CARGA_GROUPS.find(g => item.tipo.includes(g.id)) || CARGA_GROUPS[CARGA_GROUPS.length - 1];
      if (!groups[group.id]) groups[group.id] = [];
      groups[group.id].push({ item, grupo: group.id });
    }
    return groups;
  };

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
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
            <p className="text-[10px] text-ink-soft">Progreso</p>
            <span className={cn('text-[10px] font-bold', pctGeneral >= 80 ? 'text-success' : pctGeneral >= 50 ? 'text-gold' : 'text-danger')}>{pctGeneral}%</span>
          </div>
          <div className="w-full bg-cream rounded-full h-1.5"><div className={cn('h-1.5 rounded-full transition-all', pctGeneral >= 80 ? 'bg-success' : pctGeneral >= 50 ? 'bg-gold' : 'bg-danger')} style={{ width: `${pctGeneral}%` }} /></div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center justify-center">
          <button onClick={() => setReorderMode(!reorderMode)} className={cn('w-full py-2 rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors', reorderMode ? 'bg-ink text-white' : 'bg-cream text-ink hover:bg-divider')}>
            <Icon name="arrowUpDown" className="w-3.5 h-3.5" /> {reorderMode ? 'Ordenar' : 'Orden de carga'}
          </button>
        </div>
      </div>

      {/* Selector */}
      <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap items-center gap-2">
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-gold/5 border-gold/20 font-medium">
          <option value="">Seleccionar evento...</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.client_name} — {formatDate(e.event_date)}{e.venue_type === 'externo' ? ' 🚛' : ''}</option>)}
        </select>
        <button onClick={createHoja} disabled={!selectedEvent} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[10px] font-medium hover:bg-ink-light disabled:opacity-50 flex items-center gap-1">
          <Icon name="plus" className="w-3 h-3" /> Nueva
        </button>
        <button onClick={generateHoja} disabled={!selectedEvent} className="px-3 py-1.5 rounded-lg bg-gold text-white text-[10px] font-medium hover:bg-gold/80 disabled:opacity-50 flex items-center gap-1">
          <Icon name="truck" className="w-3 h-3" /> Generar carga
        </button>
      </div>

      {/* Info de orden de carga */}
      {selectedEvent && (
        <div className="bg-gradient-to-r from-amber-50 to-white rounded-lg border border-divider/50 p-2">
          <div className="flex items-center gap-2">
            <Icon name="truck" className="w-4 h-4 text-gold" />
            <span className="text-[10px] font-semibold text-ink">Orden de carga del camión (backload)</span>
          </div>
          <p className="text-[9px] text-ink-soft mt-1">
            Se carga de atrás hacia adelante: primero lo que se usa al final del evento (equipos, vajilla), último lo que se necesita al iniciar (perecederos → se meten al frío al llegar).
          </p>
        </div>
      )}

      {!selectedEvent && (
        <div className="bg-white rounded-lg border border-divider/50 p-8 text-center">
          <Icon name="truck" className="w-8 h-8 text-divider mx-auto mb-2" />
          <p className="text-[11px] text-ink-soft">Selecciona un evento para gestionar la carga del camión</p>
        </div>
      )}

      {hojas.map(hoja => {
        const pct = getCompletion(hoja.items);
        const groups = groupItems(hoja.items);

        return (
          <div key={hoja.id} className="bg-white rounded-lg border border-divider/50 overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-divider/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="truck" className="w-4 h-4 text-gold" />
                <span className="text-[11px] font-bold text-ink">{hoja.evento_nombre}</span>
                <span className={cn('text-[8px] px-1.5 py-0.5 rounded', hoja.estado === 'completada' ? 'bg-success/10 text-success' : 'bg-gold/10 text-gold')}>{hoja.estado}</span>
                <span className="text-[8px] text-ink-soft">{hoja.items.length} items · {pct}%</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowItemForm(hoja.id)} className="px-2 py-1 rounded-lg bg-cream hover:bg-gold/10 text-[9px] font-medium flex items-center gap-0.5">
                  <Icon name="plus" className="w-2.5 h-2.5" /> Añadir
                </button>
                {reorderMode && (
                  <button onClick={() => saveReorder(hoja.id, hoja.items)} className="px-2 py-1 rounded-lg bg-success text-white text-[9px] font-medium flex items-center gap-0.5">
                    <Icon name="check" className="w-2.5 h-2.5" /> Guardar orden
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="px-3 py-1.5 bg-cream/50">
              <div className="w-full bg-divider rounded-full h-1"><div className={cn('h-1 rounded-full transition-all', pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-gold' : 'bg-danger')} style={{ width: `${pct}%` }} /></div>
            </div>

            {/* Carga sections by group */}
            {CARGA_GROUPS.map((group, gi) => {
              const groupItemsList = groups[group.id] || [];
              if (groupItemsList.length === 0) return null;
              const groupPct = groupItemsList.length ? Math.round(groupItemsList.filter(g => g.item.cargado).length / groupItemsList.length * 100) : 0;

              return (
                <div key={group.id} className="border-b border-divider/30 last:border-0">
                  {/* Group header */}
                  <div className="px-3 py-1.5 bg-cream/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2.5 h-2.5 rounded-full', group.color)} />
                      <span className="text-[10px] font-semibold text-ink">{group.label}</span>
                      <span className="text-[8px] text-ink-soft">({groupItemsList.length})</span>
                      <span className="text-[8px] italic text-ink-soft/60">{group.desc}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {reorderMode && (
                        <span className="text-[8px] text-gold font-medium">⬍ Reordenar ↓</span>
                      )}
                      <span className={cn('text-[9px] font-bold', groupPct >= 80 ? 'text-success' : groupPct >= 50 ? 'text-gold' : 'text-danger')}>{groupPct}%</span>
                      <div className="w-8 bg-cream rounded-full h-1"><div className={cn('h-1 rounded-full', groupPct >= 80 ? 'bg-success' : groupPct >= 50 ? 'bg-gold' : 'bg-danger')} style={{ width: `${groupPct}%` }} /></div>
                    </div>
                  </div>

                  {/* Items in group */}
                  {groupItemsList
                    .sort((a, b) => (a.item.load_order ?? 999) - (b.item.load_order ?? 999))
                    .map(({ item }, idx) => (
                    <div key={item.id} className={cn('flex items-center gap-1.5 py-1 px-3 border-b border-divider/20 last:border-0 hover:bg-cream/30 group', item.cargado && 'opacity-50')}>
                      {/* Load order number (backload) */}
                      <span className={cn('text-[8px] font-bold w-4 h-4 rounded flex items-center justify-center shrink-0', item.cargado ? 'bg-success/20 text-success' : reorderMode ? 'bg-gold/20 text-gold' : 'bg-cream text-ink-soft')}>
                        {item.load_order ?? idx + 1}
                      </span>
                      {/* Cargado checkbox */}
                      <button onClick={() => toggleCargado(item)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors', item.cargado ? 'bg-success border-success text-white' : 'border-divider hover:border-gold')} title="Marcar cargado">
                        {item.cargado && <Icon name="check" className="w-2.5 h-2.5" />}
                      </button>
                      {/* Item info */}
                      <span className={cn('text-[10px] flex-1 truncate', item.cargado && 'line-through text-ink-soft')}>{item.nombre}</span>
                      <span className="text-[9px] text-ink-soft font-mono">{item.cantidad} {item.unit}</span>
                      {/* Pass number */}
                      {item.pass_number && (
                        <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/10 text-blue-600 font-medium">P{item.pass_number}</span>
                      )}
                      {/* Type badge */}
                      <span className="text-[8px] px-1 py-0.5 rounded bg-cream text-ink-soft font-medium">{TIPO_LABELS[item.tipo]?.split(' ')[0] || item.tipo}</span>
                      {/* Reorder buttons */}
                      {reorderMode && (
                        <div className="flex gap-0.5 shrink-0">
                          <button onClick={() => moveItem(hoja, idx, -1)} className="p-0.5 rounded hover:bg-divider/50 text-[8px]" title="Subir en orden de carga"><Icon name="chevronUp" className="w-2.5 h-2.5 text-ink-soft" /></button>
                          <button onClick={() => moveItem(hoja, idx, 1)} className="p-0.5 rounded hover:bg-divider/50 text-[8px]" title="Bajar en orden de carga"><Icon name="chevronDown" className="w-2.5 h-2.5 text-ink-soft" /></button>
                        </div>
                      )}
                      {/* Delete */}
                      <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-danger/10 rounded transition-opacity shrink-0">
                        <Icon name="trash" className="w-2.5 h-2.5 text-danger" />
                      </button>
                    </div>
                  ))}
                </div>
              );
            })}

            {hoja.items.length === 0 && (
              <div className="p-4 text-center">
                <p className="text-[9px] text-ink-soft/50 italic">Sin items — pulsa "Generar carga" para auto-generar desde el escandallo, o "Añadir" manualmente</p>
              </div>
            )}

            {/* Add item form */}
            {showItemForm === hoja.id && (
              <div className="p-3 bg-cream/50 border-t border-divider/50">
                <p className="text-[9px] font-semibold text-ink-soft mb-1">Añadir item a la hoja de carga</p>
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-1.5 items-end">
                  <input value={newItem.nombre} onChange={e => setNewItem(p => ({ ...p, nombre: e.target.value }))} placeholder="Nombre..." className="col-span-2 px-2 py-1.5 rounded border border-divider text-[10px]" />
                  <select value={newItem.tipo} onChange={e => setNewItem(p => ({ ...p, tipo: e.target.value }))} className="px-2 py-1.5 rounded border border-divider text-[10px]">
                    {TIPOS_CARGA.map(t => <option key={t} value={t}>{TIPO_LABELS[t] || t}</option>)}
                  </select>
                  <input type="number" min="1" value={newItem.cantidad} onChange={e => setNewItem(p => ({ ...p, cantidad: parseInt(e.target.value) || 1 }))} className="px-2 py-1.5 rounded border border-divider text-[10px]" placeholder="Cant." />
                  <select value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))} className="px-2 py-1.5 rounded border border-divider text-[10px]">
                    {['ud', 'kg', 'g', 'l', 'ml', 'doc', 'caja'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <input type="number" min="1" value={newItem.pass_number || ''} onChange={e => setNewItem(p => ({ ...p, pass_number: e.target.value ? parseInt(e.target.value) : null }))} className="px-2 py-1.5 rounded border border-divider text-[9px] placeholder:text-[9px]" placeholder="Pase #" />
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