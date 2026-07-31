'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';

interface StockItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock_quantity: number;
  min_stock: number | null;
  notes: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  serial_number: string | null;
  location: string | null;
}

const CATEGORIAS = [
  { id: 'mobiliario', label: 'Mobiliario', icon: 'table' },
  { id: 'maquinaria', label: 'Maquinaria', icon: 'gear' },
  { id: 'cristaleria', label: 'Cristalería', icon: 'wine' },
  { id: 'equipos', label: 'Equipos', icon: 'package' },
  { id: 'utensilios', label: 'Utensilios', icon: 'forkKnife' },
  { id: 'cristaleria', label: 'Cristalería', icon: 'wine' },
  { id: 'vajilla', label: 'Vajilla', icon: 'bowlFood' },
  { id: 'textil', label: 'Textil', icon: 'tShirt' },
  { id: 'otros', label: 'Otros', icon: 'package' },
];

const EMPTY_ITEM = {
  name: '',
  category: 'mobiliario',
  unit: 'ud',
  stock_quantity: 1,
  min_stock: 0,
  notes: '',
  purchase_date: '',
  purchase_price: null as number | null,
  serial_number: '',
  location: 'Almacén',
};

export default function StockPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat) params.set('categoria', filterCat);
      if (search) params.set('q', search);
      const res = await fetch(`/api/cocina/stock?${params}`);
      const data = await res.json();
      if (data.success) setItems(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterCat, search]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const openNew = () => { setEditItem(null); setForm(EMPTY_ITEM); setShowForm(true); };
  const openEdit = (item: StockItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      stock_quantity: item.stock_quantity,
      min_stock: item.min_stock ?? 0,
      notes: item.notes ?? '',
      purchase_date: item.purchase_date ?? '',
      purchase_price: item.purchase_price,
      serial_number: item.serial_number ?? '',
      location: item.location ?? 'Almacén',
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const body = editItem ? { ...form, id: editItem.id } : form;
      const res = await fetch('/api/cocina/stock', {
        method, headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { setShowForm(false); loadItems(); }
      else alert(data.error || 'Error al guardar');
    } catch (e) { alert('Error de red'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este material?')) return;
    try {
      const res = await fetch('/api/cocina/stock', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) loadItems();
    } catch (e) { alert('Error al eliminar'); }
  };

  const adjustStock = async (item: StockItem, delta: number) => {
    const newQty = Math.max(0, item.stock_quantity + delta);
    try {
      const res = await fetch('/api/cocina/stock', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: item.id, stock_quantity: newQty }),
      });
      const data = await res.json();
      if (data.success) loadItems();
    } catch (e) { console.error(e); }
  };

  const filtered = items.filter(i => {
    if (filterCat && i.category !== filterCat) return false;
    if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalItems = filtered.length;
  const lowStockCount = filtered.filter(i => i.min_stock && i.stock_quantity <= i.min_stock).length;
  const totalValue = filtered.reduce((s, i) => s + (i.stock_quantity * (i.purchase_price || 0)), 0);

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center"><Icon name="package" className="w-3.5 h-3.5 text-gold" /></div>
            <div><p className="text-[10px] text-ink-soft">Total</p><p className="text-sm font-bold text-ink">{totalItems}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-danger/10 flex items-center justify-center"><Icon name="warning" className="w-3.5 h-3.5 text-danger" /></div>
            <div><p className="text-[10px] text-ink-soft">Stock bajo</p><p className="text-sm font-bold text-danger">{lowStockCount}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center"><Icon name="bank" className="w-3.5 h-3.5 text-success" /></div>
            <div><p className="text-[10px] text-ink-soft">Valor total</p><p className="text-sm font-bold text-ink">{totalValue.toFixed(0)}€</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center justify-center">
          <button onClick={openNew} className="w-full py-2 rounded-lg bg-ink text-white text-[11px] font-medium flex items-center justify-center gap-1.5 hover:bg-ink-light transition-colors">
            <Icon name="plus" className="w-3.5 h-3.5" /> Nuevo material
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="px-2 py-1.5 rounded border border-divider text-[11px] w-32" />
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setFilterCat(null)} className={cn('px-2 py-1 rounded text-[9px] font-medium transition-all', !filterCat ? 'bg-ink text-white' : 'bg-cream text-ink-soft hover:bg-gold/10')}>Todos</button>
          {CATEGORIAS.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i).map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)} className={cn('px-2 py-1 rounded text-[9px] font-medium transition-all', filterCat === c.id ? 'bg-ink text-white' : 'bg-cream text-ink-soft hover:bg-gold/10')}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {filtered.map(item => (
          <div key={item.id} className={cn('bg-white rounded-lg border border-divider/50 p-3', item.min_stock && item.stock_quantity <= item.min_stock && 'border-danger/30 bg-danger/5')}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-ink truncate">{item.name}</p>
                <p className="text-[9px] text-ink-soft">{CATEGORIAS.find(c => c.id === item.category)?.label || item.category}</p>
              </div>
              <div className="flex gap-0.5">
                <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-cream transition-colors"><Icon name="pencil" className="w-3 h-3 text-ink-soft" /></button>
                <button onClick={() => remove(item.id)} className="p-1 rounded hover:bg-danger/10 transition-colors"><Icon name="trash" className="w-3 h-3 text-danger" /></button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <button onClick={() => adjustStock(item, -1)} className="w-6 h-6 rounded bg-cream hover:bg-divider flex items-center justify-center transition-colors"><Icon name="minus" className="w-3 h-3" /></button>
                <span className="text-sm font-bold text-ink w-8 text-center">{item.stock_quantity}</span>
                <button onClick={() => adjustStock(item, 1)} className="w-6 h-6 rounded bg-cream hover:bg-divider flex items-center justify-center transition-colors"><Icon name="plus" className="w-3 h-3" /></button>
                <span className="text-[9px] text-ink-soft">{item.unit}</span>
              </div>
              {item.min_stock > 0 && (
                <span className={cn('text-[8px] px-1.5 py-0.5 rounded', item.stock_quantity <= item.min_stock ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success')}>
                  min: {item.min_stock}
                </span>
              )}
            </div>

            {item.purchase_price && <p className="text-[9px] text-ink-soft">Coste: {item.purchase_price}€/{item.unit}</p>}
            {item.serial_number && <p className="text-[8px] text-ink-soft/60">S/N: {item.serial_number}</p>}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="bg-white rounded-lg border border-divider/50 p-8 text-center">
          <Icon name="package" className="w-8 h-8 text-divider mx-auto mb-2" />
          <p className="text-[11px] text-ink-soft">No hay materiales registrados</p>
          <button onClick={openNew} className="mt-2 text-[10px] text-gold font-medium hover:underline">Añadir primer material</button>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl border border-divider shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-divider flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editItem ? 'Editar material' : 'Nuevo material'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-cream"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Nombre *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" placeholder="Ej: Freidora industrial..." />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Categoría</label>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]">
                    {CATEGORIAS.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i).map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Unidad</label>
                  <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]">
                    <option value="ud">Unidad (ud)</option><option value="kg">Kg</option><option value="l">Litro</option><option value="par">Par</option><option value="docena">Docena</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Cantidad</label>
                  <input type="number" min="0" value={form.stock_quantity} onChange={e => setForm(p => ({ ...p, stock_quantity: parseInt(e.target.value) || 0 }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Stock mínimo</label>
                  <input type="number" min="0" value={form.min_stock} onChange={e => setForm(p => ({ ...p, min_stock: parseInt(e.target.value) || 0 }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Ubicación</label>
                  <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" placeholder="Almacén..." />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Nº Serie</label>
                  <input value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" placeholder="S/N..." />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Fecha compra</label>
                  <input type="date" value={form.purchase_date} onChange={e => setForm(p => ({ ...p, purchase_date: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Precio compra (€)</label>
                  <input type="number" step="0.01" min="0" value={form.purchase_price ?? ''} onChange={e => setForm(p => ({ ...p, purchase_price: e.target.value ? parseFloat(e.target.value) : null }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Notas</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px] resize-none" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-divider flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg border border-divider text-[11px] text-ink-soft hover:bg-cream">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium hover:bg-ink-light disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}