'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';

interface Event { id: string; client_name: string; event_date: string; guest_count: number; }
interface ItemLogistica { id: string; tipo: string; nombre: string; cantidad: number; unit: string; equipment_id: string | null; stock_name: string | null; stock_total: number | null; preparado: boolean; cargado: boolean; notas: string | null; orden: number; }
interface StockItem { id: string; name: string; category: string; stock_quantity: number; unit: string; }

const CATEGORIAS = [
  { id: 'mobiliario', label: 'Mobiliario', icon: 'table' },
  { id: 'maquinaria', label: 'Maquinaria', icon: 'settings' },
  { id: 'cristaleria', label: 'Cristalería', icon: 'wine' },
  { id: 'equipos', label: 'Equipos', icon: 'package' },
  { id: 'cubertea', label: 'Cubertería', icon: 'utensils' },
  { id: 'vajilla', label: 'Vajilla', icon: 'utensilsCrossed' },
  { id: 'textil', label: 'Textil', icon: 'shirt' },
  { id: 'otros', label: 'Otros', icon: 'list' },
];

export default function LogisticaPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [items, setItems] = useState<ItemLogistica[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [useStock, setUseStock] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState('');
  const [form, setForm] = useState({ nombre: '', tipo: 'mobiliario', cantidad: 1, unit: 'ud', notas: '' });

  useEffect(() => { fetch('/api/events?limit=50', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setEvents(d.data || []); }).catch(() => {}); }, []);
  useEffect(() => { fetch('/api/cocina/stock', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setStock(d.data || []); }).catch(() => {}); }, []);

  const loadItems = useCallback(async () => {
    if (!selectedEvent) { setItems([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/cocina/logistica/items?event_id=${selectedEvent}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setItems(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [selectedEvent]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const addItem = async () => {
    if (useStock && selectedStockId) {
      const s = stock.find(x => x.id === selectedStockId);
      if (s) {
        setForm({ nombre: s.name, tipo: s.category, cantidad: 1, unit: s.unit, notas: '' });
      }
    }
    if (!form.nombre.trim()) return;
    try {
      const res = await fetch('/api/cocina/logistica/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ event_id: selectedEvent, ...form, equipment_id: useStock ? selectedStockId : null }),
      });
      const data = await res.json();
      if (data.success) { setShowForm(false); setUseStock(false); setSelectedStockId(''); setForm({ nombre: '', tipo: 'mobiliario', cantidad: 1, unit: 'ud', notas: '' }); loadItems(); }
    } catch (e) { alert('Error al añadir'); }
  };

  const generateLogistica = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch('/api/cocina/logistica/items', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ event_id: selectedEvent, generate: true }),
      });
      const data = await res.json();
      if (data.success) {
        loadItems();
      } else {
        alert(data.error || 'Error al generar');
      }
    } catch (e) { alert('Error al generar'); }
  };

  const togglePreparado = async (item: ItemLogistica) => {
    try {
      await fetch('/api/cocina/logistica/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: item.id, preparado: !item.preparado }),
      });
      loadItems();
    } catch (e) { console.error(e); }
  };

  const toggleCargado = async (item: ItemLogistica) => {
    try {
      await fetch('/api/cocina/logistica/items', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id: item.id, cargado: !item.cargado }),
      });
      loadItems();
    } catch (e) { console.error(e); }
  };

  const deleteItem = async (id: string) => {
    if (!confirm('¿Eliminar item?')) return;
    try {
      await fetch('/api/cocina/logistica/items', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ id }),
      });
      loadItems();
    } catch (e) { console.error(e); }
  };

  const getCompletion = (arr: ItemLogistica[], field: 'preparado' | 'cargado') => {
    if (!arr.length) return 0;
    return Math.round((arr.filter(i => i[field]).length / arr.length) * 100);
  };

  const totalItems = items.length;
  const preparados = items.filter(i => i.preparado).length;
  const cargados = items.filter(i => i.cargado).length;
  const pctPreparado = getCompletion(items, 'preparado');
  const pctCargado = getCompletion(items, 'cargado');

  const stockById = (id: string | null) => stock.find(s => s.id === id);

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <p className="text-[10px] text-ink-soft mb-0.5">Items totales</p>
          <p className="text-sm font-bold text-ink">{totalItems}</p>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-ink-soft">Preparados</p>
            <span className={cn('text-[10px] font-bold', pctPreparado >= 80 ? 'text-success' : 'text-gold')}>{pctPreparado}%</span>
          </div>
          <p className="text-[11px] font-bold text-ink">{preparados}/{totalItems}</p>
          <div className="w-full bg-cream rounded-full h-1 mt-1"><div className={cn('h-1 rounded-full', pctPreparado >= 80 ? 'bg-success' : 'bg-gold')} style={{ width: `${pctPreparado}%` }} /></div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-ink-soft">Cargados</p>
            <span className={cn('text-[10px] font-bold', pctCargado >= 80 ? 'text-success' : 'text-gold')}>{pctCargado}%</span>
          </div>
          <p className="text-[11px] font-bold text-ink">{cargados}/{totalItems}</p>
          <div className="w-full bg-cream rounded-full h-1 mt-1"><div className={cn('h-1 rounded-full', pctCargado >= 80 ? 'bg-success' : 'bg-gold')} style={{ width: `${pctCargado}%` }} /></div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center justify-center">
          <button onClick={() => setShowForm(true)} disabled={!selectedEvent} className="w-full py-2 rounded-lg bg-ink text-white text-[11px] font-medium flex items-center justify-center gap-1.5 hover:bg-ink-light disabled:opacity-50 transition-colors">
            <Icon name="plus" className="w-3.5 h-3.5" /> Añadir material
          </button>
        </div>
      </div>

      {/* Selector */}
      <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap items-center gap-2">
        <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className="flex-1 min-w-[200px] px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-gold/5 border-gold/20 font-medium">
          <option value="">Seleccionar evento...</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.client_name} — {new Date(e.event_date).toLocaleDateString('es-ES')}</option>)}
        </select>
        <button onClick={generateLogistica} disabled={!selectedEvent} className="px-3 py-1.5 rounded-lg bg-gold text-white text-[10px] font-medium hover:bg-gold/80 disabled:opacity-50 flex items-center gap-1">
          <Icon name="magic" className="w-3 h-3" /> Generar
        </button>
      </div>

      {!selectedEvent && (
        <div className="bg-white rounded-lg border border-divider/50 p-8 text-center">
          <Icon name="truck" className="w-8 h-8 text-divider mx-auto mb-2" />
          <p className="text-[11px] text-ink-soft">Selecciona un evento para gestionar su logística</p>
        </div>
      )}

      {/* Items by category */}
      {selectedEvent && CATEGORIAS.map(cat => {
        const catItems = items.filter(i => i.tipo === cat.id);
        if (!catItems.length) return null;
        const catPrepPct = getCompletion(catItems, 'preparado');
        const catCargPct = getCompletion(catItems, 'cargado');

        return (
          <div key={cat.id} className="bg-white rounded-lg border border-divider/50 rounded-xl overflow-hidden">
            <div className="p-2 border-b border-divider/50 bg-cream/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon name={cat.icon} className="w-3.5 h-3.5 text-gold" />
                  <span className="text-[10px] font-medium text-ink">{cat.label}</span>
                  <span className="text-[8px] text-ink-soft">({catItems.length})</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[8px] text-ink-soft">Prep </span>
                    <span className={cn('text-[9px] font-bold', catPrepPct >= 80 ? 'text-success' : 'text-gold')}>{catPrepPct}%</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[8px] text-ink-soft">Carga </span>
                    <span className={cn('text-[9px] font-bold', catCargPct >= 80 ? 'text-success' : 'text-gold')}>{catCargPct}%</span>
                  </div>
                </div>
              </div>
            </div>
            {catItems.map(item => {
              const stockInfo = stockById(item.equipment_id);
              return (
                <div key={item.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-divider/20 last:border-0 hover:bg-cream/30 group">
                  <button onClick={() => togglePreparado(item)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 text-[8px]', item.preparado ? 'bg-gold border-gold text-white' : 'border-divider hover:border-gold')}>{item.preparado && '✓'}</button>
                  <button onClick={() => toggleCargado(item)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 text-[8px]', item.cargado ? 'bg-success border-success text-white' : 'border-divider hover:border-gold')}>{item.cargado && '✓'}</button>
                  <span className={cn('text-[10px] flex-1', item.cargado && 'line-through text-ink-soft')}>{item.nombre}</span>
                  <span className="text-[9px] text-ink-soft">{item.cantidad} {item.unit}</span>
                  {stockInfo && <span className="text-[8px] px-1 py-0.5 rounded bg-gold/10 text-gold">Stock: {stockInfo.stock_quantity}</span>}
                  <button onClick={() => deleteItem(item.id)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-danger/10 rounded transition-opacity"><Icon name="trash" className="w-2.5 h-2.5 text-danger" /></button>
                </div>
              );
            })}
          </div>
        );
      })}

      {selectedEvent && items.length === 0 && !loading && (
        <div className="bg-white rounded-lg border border-divider/50 p-6 text-center">
          <p className="text-[10px] text-ink-soft mb-2">Sin material asignado</p>
          <button onClick={() => setShowForm(true)} className="text-[10px] text-gold font-medium hover:underline">Añadir primer item</button>
        </div>
      )}

      {/* Add item modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl border border-divider shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-divider flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Añadir material</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-cream"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              {/* Stock selector */}
              <div className="bg-gold/5 rounded-lg border border-gold/20 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={useStock} onChange={e => setUseStock(e.target.checked)} className="w-4 h-4 rounded border-divider" />
                  <span className="text-[11px] font-medium text-ink">Vincular a stock existente</span>
                </label>
                {useStock && (
                  <select value={selectedStockId} onChange={e => {
                    const sid = e.target.value;
                    setSelectedStockId(sid);
                    const s = stock.find(x => x.id === sid);
                    if (s) setForm({ nombre: s.name, tipo: s.category, cantidad: 1, unit: s.unit, notas: '' });
                  }} className="w-full mt-2 px-2 py-1.5 rounded border border-divider text-[10px]">
                    <option value="">Seleccionar material del stock...</option>
                    {stock.map(s => <option key={s.id} value={s.id}>{s.name} ({s.stock_quantity} {s.unit} disponibles)</option>)}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Nombre *</label>
                  <input value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" placeholder="Nombre del material..." />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Categoría</label>
                  <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]">
                    {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Cantidad</label>
                  <input type="number" min="1" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: parseInt(e.target.value) || 1 }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Unidad</label>
                  <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]">
                    <option value="ud">Unidad</option><option value="par">Par</option><option value="docena">Docena</option><option value="kg">Kg</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Notas</label>
                  <input value={form.notas} onChange={e => setForm(p => ({ ...p, notas: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" placeholder="Notas opcionales..." />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-divider flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg border border-divider text-[11px]">Cancelar</button>
              <button onClick={addItem} disabled={!form.nombre.trim()} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium disabled:opacity-50">Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}