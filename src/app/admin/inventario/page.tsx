'use client';

import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
  quantity: number | null;
  min_stock: number | null;
  stock_unit: string | null;
  supplier: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  packaging_size: number | null;
  active: boolean;
  recipe_count: number | number;
  price_history: { date: string; cost: number }[];
}

interface Provider { id: string; name: string; category: string; }

const CATEGORIES = [
  { id: 'proteinas', label: '🥩 Proteínas', color: 'red' },
  { id: 'verduras', label: '🥬 Verduras', color: 'green' },
  { id: 'lacteos', label: '🧀 Lácteos', color: 'yellow' },
  { id: 'carbohidratos', label: '🍝 Carbohidratos', color: 'amber' },
  { id: 'bebidas', label: '🍷 Bebidas', color: 'purple' },
  { id: 'especias', label: '🧂 Especias', color: 'orange' },
  { id: 'pescados', label: '🐟 Pescados', color: 'blue' },
  { id: 'frutas', label: '🍎 Frutas', color: 'pink' },
  { id: 'otros', label: '📦 Otros', color: 'gray' },
];

const UNIDADES = ['kg', 'g', 'l', 'ml', 'ud', 'docena', 'paquete', 'caja', 'bulto'];

export default function InventarioPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Ingredient | null>(null);
  const [form, setForm] = useState({
    name: '', unit: 'kg', cost_per_unit: 0, quantity: 0,
    min_stock: 0, supplier: '', supplier_id: null as string | null,
    stock_unit: 'kg', packaging_size: null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [expiryTab, setExpiryTab] = useState(false);
  const [expiryAlerts, setExpiryAlerts] = useState<any[]>([]);
  const [expiryLoading, setExpiryLoading] = useState(false);
  const [discardLoading, setDiscardLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/providers', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setProviders(d.data || []); })
      .catch(() => {});
  }, []);

  const loadIngredients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterCat) params.set('category', filterCat);
      if (search) params.set('q', search);
      if (showLowStock) params.set('lowStock', 'true');
      const res = await fetch(`/api/inventario/ingredients?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) setIngredients(data.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [filterCat, search, showLowStock]);

  useEffect(() => { loadIngredients(); }, [loadIngredients]);

  const openNew = () => {
    setEditItem(null);
    setForm({ name: '', unit: 'kg', cost_per_unit: 0, quantity: 0, min_stock: 0, supplier: '', supplier_id: null, stock_unit: 'kg', packaging_size: null });
    setShowForm(true);
  };

  const openEdit = (item: Ingredient) => {
    setEditItem(item);
    setForm({
      name: item.name,
      unit: item.unit,
      cost_per_unit: item.cost_per_unit,
      quantity: item.quantity ?? 0,
      min_stock: item.min_stock ?? 0,
      supplier: item.supplier ?? '',
      supplier_id: item.supplier_id,
      stock_unit: item.stock_unit || item.unit,
      packaging_size: item.packaging_size,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const method = editItem ? 'PUT' : 'POST';
      const body = editItem ? { ...form, id: editItem.id } : form;
      const res = await fetch('/api/inventario/ingredients', {
        method, headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) { setShowForm(false); loadIngredients(); }
      else alert(data.error || 'Error al guardar');
    } catch (e) { alert('Error de red'); }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este ingrediente?')) return;
    try {
      const res = await fetch('/api/inventario/ingredients', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.success) loadIngredients();
      else alert(data.error || 'Error al eliminar');
    } catch (e) { alert('Error al eliminar'); }
  };

  const adjustStock = async (item: Ingredient, delta: number) => {
    const newQty = Math.max(0, (item.quantity ?? 0) + delta);
    try {
      const res = await fetch('/api/inventario/ingredients', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id: item.id, quantity: newQty }),
      });
      const data = await res.json();
      if (data.success) loadIngredients();
    } catch (e) { console.error(e); }
  };

  const filtered = ingredients.filter(i => {
    if (filterCat && i.stock_unit !== filterCat) return false;
    return true;
  });

  const loadExpiryAlerts = async () => {
    setExpiryLoading(true);
    try {
      const res = await fetch('/api/stock/expiry-alerts?days=30', { credentials: 'include' });
      const d = await res.json();
      if (d.success) setExpiryAlerts(d.data || []);
    } catch (e) { console.error(e); }
    setExpiryLoading(false);
  };

  // KPIs
  const totalItems = filtered.length;
  const lowStockCount = filtered.filter(i => i.min_stock && (i.quantity ?? 0) <= i.min_stock).length;
  const totalValue = filtered.reduce((s, i) => s + ((i.quantity ?? 0) * i.cost_per_unit), 0);
  const linkedToRecipes = filtered.filter(i => (i.recipe_count ?? 0) > 0).length;

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
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
            <div><p className="text-[10px] text-ink-soft">Valor inventario</p><p className="text-sm font-bold text-ink">{totalValue.toFixed(0)}€</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center"><Icon name="bookOpen" className="w-3.5 h-3.5 text-blue-500" /></div>
            <div><p className="text-[10px] text-ink-soft">En recetas</p><p className="text-sm font-bold text-ink">{linkedToRecipes}</p></div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center justify-center">
          <button onClick={openNew} className="w-full py-2 rounded-lg bg-ink text-white text-[11px] font-medium flex items-center justify-center gap-1.5 hover:bg-ink-light transition-colors">
            <Icon name="plus" className="w-3.5 h-3.5" /> Nuevo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-divider/50 p-2 flex flex-wrap gap-2 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar ingrediente..." className="px-2 py-1.5 rounded border border-divider text-[11px] w-40" />
        <div className="flex flex-wrap gap-1">
          <button onClick={() => setFilterCat(null)} className={cn('px-2 py-1 rounded text-[9px] font-medium', !filterCat ? 'bg-ink text-white' : 'bg-cream text-ink-soft')}>Todos</button>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setFilterCat(c.id)} className={cn('px-2 py-1 rounded text-[9px] font-medium', filterCat === c.id ? 'bg-ink text-white' : 'bg-cream text-ink-soft')}>
              {c.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
          <input type="checkbox" checked={showLowStock} onChange={e => setShowLowStock(e.target.checked)} className="w-3.5 h-3.5 rounded border-divider" />
          <span className="text-[10px] text-ink-soft">Solo stock bajo</span>
        </label>
      </div>

      {/* M1: Caducidad próxima */}
      <div className="bg-white rounded-lg border border-divider/50 overflow-hidden">
        <div className="px-3 py-2 border-b border-divider/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="snowflake" className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-ink">Próximos a caducar</span>
            <span className="text-[9px] text-ink-soft bg-cream px-1.5 py-0.5 rounded">FEFO</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setExpiryTab(!expiryTab); if (!expiryTab) loadExpiryAlerts(); }} className={cn('px-2 py-1 rounded text-[9px] font-medium', expiryTab ? 'bg-amber-500 text-white' : 'bg-cream text-ink-soft')}>
              {expiryTab ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </div>
        {expiryTab && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-cream/30 border-b border-divider/30">
                    <th className="text-left px-3 py-1.5 font-medium text-ink-soft">Lote</th>
                    <th className="text-left px-3 py-1.5 font-medium text-ink-soft">Ingrediente</th>
                    <th className="text-left px-3 py-1.5 font-medium text-ink-soft">Caducidad</th>
                    <th className="text-right px-3 py-1.5 font-medium text-ink-soft">Cant. restante</th>
                    <th className="text-center px-3 py-1.5 font-medium text-ink-soft">Estado</th>
                    <th className="text-center px-3 py-1.5 font-medium text-ink-soft">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {expiryAlerts.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-4 text-ink-soft text-[10px]">No hay lotes próximos a caducar</td></tr>
                  ) : (
                    expiryAlerts.map(lot => {
                      const isCaducado = lot.status === 'caducado';
                      const isProximo = lot.status === 'próximo';
                      return (
                        <tr key={lot.lot_id} className={cn('border-b border-divider/20', isCaducado && 'bg-danger/5', isProximo && 'bg-amber-50/30')}>
                          <td className="px-3 py-1.5 font-mono text-[10px] text-ink-soft">{lot.lot_code}</td>
                          <td className="px-3 py-1.5 font-medium text-ink">{lot.ingredient_name}</td>
                          <td className="px-3 py-1.5 text-ink-soft">{lot.expiry_date ? new Date(lot.expiry_date).toLocaleDateString('es-ES') : '-'}</td>
                          <td className="px-3 py-1.5 text-right font-medium">{Number(lot.qty_base_remaining).toFixed(2)} {lot.base_unit || ''}</td>
                          <td className="px-3 py-1.5 text-center">
                            {isCaducado && <span className="text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger">Caducado</span>}
                            {isProximo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">Próximo</span>}
                            {!isCaducado && !isProximo && <span className="text-[9px] px-1.5 py-0.5 rounded bg-success/10 text-success">OK</span>}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {isCaducado && !isCaducado && (
                              <button onClick={async () => {
                                if (!confirm(`¿Dar de baja el lote ${lot.lot_code}?`)) return;
                                setDiscardLoading(lot.lot_id);
                                try {
                                  const res = await fetch(`/api/stock/lots/${lot.lot_id}/discard`, {
                                    method: 'POST', credentials: 'include',
                                    headers: { 'Content-Type': 'application/json' },
                                  });
                                  const d = await res.json();
                                  if (d.success) { loadExpiryAlerts(); }
                                  else alert(d.error);
                                } catch (e) { alert('Error de red'); }
                                setDiscardLoading(null);
                              }} disabled={discardLoading === lot.lot_id} className="px-2 py-0.5 rounded text-[9px] bg-danger/10 text-danger hover:bg-danger/20 disabled:opacity-50">
                                {discardLoading === lot.lot_id ? '...' : 'Baja'}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-divider/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-cream/50 border-b border-divider/50">
                <th className="text-left px-3 py-2 font-medium text-ink-soft">Ingrediente</th>
                <th className="text-left px-3 py-2 font-medium text-ink-soft">Unidad</th>
                <th className="text-right px-3 py-2 font-medium text-ink-soft">Stock</th>
                <th className="text-right px-3 py-2 font-medium text-ink-soft">Mín.</th>
                <th className="text-right px-3 py-2 font-medium text-ink-soft">Coste/ud</th>
                <th className="text-left px-3 py-2 font-medium text-ink-soft">Proveedor</th>
                <th className="text-center px-3 py-2 font-medium text-ink-soft">Recetas</th>
                <th className="text-center px-3 py-2 font-medium text-ink-soft">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const isLow = item.min_stock && (item.quantity ?? 0) <= item.min_stock;
                return (
                  <tr key={item.id} className={cn('border-b border-divider/30 hover:bg-cream/30', isLow && 'bg-danger/5')}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {isLow && <Icon name="warning" className="w-3 h-3 text-danger" />}
                        <span className="font-medium text-ink">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-ink-soft">{item.unit}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => adjustStock(item, -1)} className="w-5 h-5 rounded bg-cream hover:bg-divider flex items-center justify-center"><Icon name="minus" className="w-2.5 h-2.5" /></button>
                        <span className={cn('w-10 text-center font-medium', isLow && 'text-danger')}>{item.quantity ?? 0}</span>
                        <button onClick={() => adjustStock(item, 1)} className="w-5 h-5 rounded bg-cream hover:bg-divider flex items-center justify-center"><Icon name="plus" className="w-2.5 h-2.5" /></button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-soft">{item.min_stock ?? '-'}</td>
                    <td className="px-3 py-2 text-right font-medium">{item.cost_per_unit.toFixed(2)}€</td>
                    <td className="px-3 py-2 text-ink-soft">{item.supplier_name || item.supplier || '-'}</td>
                    <td className="px-3 py-2 text-center">
                      {(item.recipe_count ?? 0) > 0 && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-gold/10 text-gold">{item.recipe_count} recetas</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(item)} className="p-1 rounded hover:bg-cream"><Icon name="pencil" className="w-3 h-3 text-ink-soft" /></button>
                        <button onClick={() => remove(item.id)} className="p-1 rounded hover:bg-danger/10"><Icon name="trash" className="w-3 h-3 text-danger" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center">
            <Icon name="package" className="w-8 h-8 text-divider mx-auto mb-2" />
            <p className="text-[11px] text-ink-soft">No hay ingredientes</p>
            <button onClick={openNew} className="mt-2 text-[10px] text-gold font-medium hover:underline">Añadir primer ingrediente</button>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl border border-divider shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-divider flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">{editItem ? 'Editar ingrediente' : 'Nuevo ingrediente'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-cream"><Icon name="x" className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Nombre *</label>
                  <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" placeholder="Ej: Tomate..." />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Unidad</label>
                  <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value, stock_unit: e.target.value }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]">
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Stock actual</label>
                  <input type="number" step="0.1" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: parseFloat(e.target.value) || 0 }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Stock mínimo</label>
                  <input type="number" step="0.1" min="0" value={form.min_stock} onChange={e => setForm(p => ({ ...p, min_stock: parseFloat(e.target.value) || 0 }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Coste/unidad (€)</label>
                  <input type="number" step="0.01" min="0" value={form.cost_per_unit} onChange={e => setForm(p => ({ ...p, cost_per_unit: parseFloat(e.target.value) || 0 }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Proveedor</label>
                  <select value={form.supplier_id || ''} onChange={e => {
                    const pid = e.target.value || null;
                    const prov = providers.find(p => p.id === pid);
                    setForm(p => ({ ...p, supplier_id: pid, supplier: prov?.name || '' }));
                  }} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]">
                    <option value="">Sin proveedor</option>
                    {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-ink-soft font-medium block mb-1">Tamaño paquete</label>
                  <input type="number" step="0.1" min="0" value={form.packaging_size ?? ''} onChange={e => setForm(p => ({ ...p, packaging_size: e.target.value ? parseFloat(e.target.value) : null }))} className="w-full px-2.5 py-2 rounded-lg border border-divider text-[11px]" />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-divider flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-3 py-1.5 rounded-lg border border-divider text-[11px] text-ink-soft hover:bg-cream">Cancelar</button>
              <button onClick={save} disabled={saving || !form.name.trim()} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[11px] font-medium hover:bg-ink-light disabled:opacity-50">
                {saving ? 'Guardando...' : editItem ? 'Actualizar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}