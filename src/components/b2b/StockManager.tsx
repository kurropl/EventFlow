'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Icon from '../shared/Icon';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  min_stock: number;
  cost_per_unit: number;
  supplier: string;
  active: boolean;
  low_stock?: boolean;
  last_restocked?: string;
}

interface Provider {
  id: string;
  name: string;
  category: string;
  contact_name: string;
  phone: string;
  email: string;
}

interface EventOption {
  id: string;
  client_name: string;
  event_date: string;
  status: string;
}

interface ShoppingItem {
  id: string;
  ingredient_name: string;
  total_grams: number;
  total_units: number;
  total_ml: number;
  provider_name: string;
  completed: boolean;
}

interface Escandallo {
  event_id: string;
  event_name: string;
  items: ShoppingItem[];
}

type Tab = 'stock' | 'escandallos' | 'pedidos';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function stockStatus(qty: number, min: number): { label: string; icon: string; color: string; bg: string } {
  if (qty === 0) return { label: 'Agotado', icon: 'circleX', color: 'text-[#DC2626]', bg: 'bg-[#FEF3F3]' };
  if (qty <= min) return { label: 'Bajo', icon: 'alertTriangle', color: 'text-[#D97706]', bg: 'bg-[#FFF8EC]' };
  return { label: 'OK', icon: 'check', color: 'text-[#16A34A]', bg: 'bg-[#EFFAF2]' };
}

function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${unit}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StockManager() {
  const [activeTab, setActiveTab] = useState<Tab>('stock');

  // Stock state
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterProvider, setFilterProvider] = useState('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ quantity: '', min_stock: '', cost_per_unit: '' });
  const [saving, setSaving] = useState(false);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');

  // Escandallos state
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [escandallo, setEscandallo] = useState<Escandallo | null>(null);
  const [loadingEscandallo, setLoadingEscandallo] = useState(false);
  const [editingEscandalloId, setEditingEscandalloId] = useState<string | null>(null);
  const [escandalloEditData, setEscandalloEditData] = useState<{ total_grams: string; total_units: string; total_ml: string }>({ total_grams: '', total_units: '', total_ml: '' });
  const [savingEscandallo, setSavingEscandallo] = useState(false);

  // Supplier orders state
  const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrder, setNewOrder] = useState({ supplier: '', notes: '', expected_date: '', items: [] as any[] });

  // Stock check state
  const [stockCheckLoading, setStockCheckLoading] = useState(false);
  const [stockShortages, setStockShortages] = useState<Array<{ ingredient_name: string; needed: number; available: number; unit: string; metric: string }>>([]);

  // Proveedores state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const providersRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to providers if URL has #proveedores
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#proveedores') {
      setActiveTab('stock');
      setTimeout(() => providersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Data loading                                                     */
  /* ---------------------------------------------------------------- */

  const loadStock = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/stock');
      const data = await res.json();
      if (data.success) setIngredients(data.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/events?limit=200');
      const data = await res.json();
      if (data.success) setEvents(data.data || []);
    } catch { /* ignore */ }
  }, []);

  const loadProviders = useCallback(async () => {
    try {
      setLoadingProviders(true);
      const res = await fetch('/api/providers');
      const data = await res.json();
      if (data.success) setProviders(data.data || []);
    } catch { /* ignore */ }
    finally { setLoadingProviders(false); }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const res = await fetch('/api/stock/supplier-orders');
      const data = await res.json();
      if (data.success) setSupplierOrders(data.data || []);
    } catch { /* ignore */ }
    setLoadingOrders(false);
  }, []);

  const loadEscandallo = useCallback(async (eventId: string) => {
    if (!eventId) { setEscandallo(null); return; }
    setLoadingEscandallo(true);
    try {
      const res = await fetch(`/api/stock/escandallos?event_id=${eventId}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const group = data.data[eventId];
        if (group) {
          setEscandallo({ event_id: eventId, event_name: group.event_name, items: group.items || [] });
        } else {
          setEscandallo(null);
        }
      }
    } catch { /* ignore */ }
    finally { setLoadingEscandallo(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'stock') { loadStock(); loadProviders(); }
    if (activeTab === 'escandallos' && events.length === 0) loadEvents();
    if (activeTab === 'pedidos') loadOrders();
  }, [activeTab, loadStock, loadProviders, loadEvents, loadOrders, events.length]);

  useEffect(() => {
    if (selectedEvent) loadEscandallo(selectedEvent);
  }, [selectedEvent, loadEscandallo]);

  /* ---------------------------------------------------------------- */
  /*  Derived data                                                     */
  /* ---------------------------------------------------------------- */

  const providerNames = useMemo(() => {
    const set = new Set(ingredients.map((i) => i.supplier).filter(Boolean));
    return Array.from(set).sort();
  }, [ingredients]);

  const filteredIngredients = useMemo(() => {
    return ingredients.filter((item) => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchProvider = filterProvider === 'all' || item.supplier === filterProvider;
      return matchSearch && matchProvider;
    });
  }, [ingredients, search, filterProvider]);

  const lowStockCount = useMemo(
    () => ingredients.filter((i) => i.quantity > 0 && i.quantity <= i.min_stock).length,
    [ingredients]
  );
  const outOfStockCount = useMemo(
    () => ingredients.filter((i) => i.quantity === 0).length,
    [ingredients]
  );

  const groupedItems = useMemo(() => {
    if (!escandallo) return [];
    const groups: Record<string, { provider: string; items: ShoppingItem[] }> = {};
    for (const item of escandallo.items) {
      const key = item.provider_name || 'Sin proveedor';
      if (!groups[key]) groups[key] = { provider: key, items: [] };
      groups[key].items.push(item);
    }
    return Object.values(groups);
  }, [escandallo]);

  const escandalloTotal = useMemo(() => {
    if (!escandallo) return { count: 0, totalQty: 0, totalGrams: 0, totalUnits: 0, totalMl: 0 };
    return {
      count: escandallo.items.length,
      totalQty: escandallo.items.reduce((s, i) => s + (i.total_grams || 0) + (i.total_units || 0) + (i.total_ml || 0), 0),
      totalGrams: escandallo.items.reduce((s, i) => s + (i.total_grams || 0), 0),
      totalUnits: escandallo.items.reduce((s, i) => s + (i.total_units || 0), 0),
      totalMl: escandallo.items.reduce((s, i) => s + (i.total_ml || 0), 0),
    };
  }, [escandallo]);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */

  const startEdit = (item: Ingredient) => {
    setEditingId(item.id);
    setEditData({ quantity: String(item.quantity), min_stock: String(item.min_stock), cost_per_unit: String(item.cost_per_unit) });
  };

  const handleRestock = async (id: string) => {
    const qty = parseFloat(restockQty);
    if (!qty || qty <= 0) return;
    try {
      const item = ingredients.find((i) => i.id === id);
      if (!item) return;
      const newQty = item.quantity + qty;
      await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, quantity: newQty, last_restocked: new Date().toISOString() }),
      });
      setRestockId(null);
      setRestockQty('');
      await loadStock();
    } catch { /* ignore */ }
  };

  const saveEdit = async () => {
    if (!editingId || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/stock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          quantity: parseFloat(editData.quantity) || 0,
          min_stock: parseFloat(editData.min_stock) || 0,
          cost_per_unit: parseFloat(editData.cost_per_unit) || 0,
        }),
      });
      if (res.ok) {
        setEditingId(null);
        await loadStock();
      }
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  /* ---------------------------------------------------------------- */
  /*  Escandallo actions                                               */
  /* ---------------------------------------------------------------- */

  const startEscandalloEdit = (item: ShoppingItem) => {
    setEditingEscandalloId(item.id);
    setEscandalloEditData({
      total_grams: String(item.total_grams ?? 0),
      total_units: String(item.total_units ?? 0),
      total_ml: String(item.total_ml ?? 0),
    });
  };

  const saveEscandalloEdit = async () => {
    if (!editingEscandalloId || savingEscandallo) return;
    setSavingEscandallo(true);
    try {
      const res = await fetch('/api/stock/escandallos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingEscandalloId,
          total_grams: parseFloat(escandalloEditData.total_grams) || 0,
          total_units: parseFloat(escandalloEditData.total_units) || 0,
          total_ml: parseFloat(escandalloEditData.total_ml) || 0,
        }),
      });
      if (res.ok) {
        setEditingEscandalloId(null);
        if (selectedEvent) await loadEscandallo(selectedEvent);
      }
    } catch { /* ignore */ }
    finally { setSavingEscandallo(false); }
  };

  const checkStock = async () => {
    if (!selectedEvent) return;
    setStockCheckLoading(true);
    setStockShortages([]);
    try {
      const res = await fetch(`/api/stock/check?event_id=${selectedEvent}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        setStockShortages(data.data.shortages || []);
      }
    } catch { /* ignore */ }
    finally { setStockCheckLoading(false); }
  };

  /* ---------------------------------------------------------------- */
  /*  Shared styles                                                    */
  /* ---------------------------------------------------------------- */

  const selectCls = 'px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all';

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Stock & Proveedores
          </h2>
          <p className="text-sm text-[#6B7280] mt-1">
            Gestión de almacén, ingredientes y proveedores del salon
            {activeTab === 'stock' && (lowStockCount + outOfStockCount) > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-[#D97706] font-medium">
                <Icon name="alertTriangle" className="w-3.5 h-3.5" />
                {lowStockCount + outOfStockCount} alerta{lowStockCount + outOfStockCount > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F8F3E6] rounded-xl p-1 border border-[#ECECF1]">
        {([
          { key: 'stock' as Tab, label: 'Stock & Proveedores', icon: 'package' },
          { key: 'escandallos' as Tab, label: 'Escandallos por Evento', icon: 'layers' },
          { key: 'pedidos' as Tab, label: 'Pedidos a Proveedores', icon: 'truck' },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-[#1A1A1A] shadow-sm border border-[#ECECF1]'
                : 'text-[#6B7280] hover:text-[#1A1A1A] hover:bg-white/50'
            }`}
          >
            <Icon name={tab.icon} className="w-4 h-4" />
            {tab.label}
            {tab.key === 'stock' && (lowStockCount + outOfStockCount) > 0 && (
              <span
                className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
              >
                {lowStockCount + outOfStockCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ============================================================= */}
      {/*  STOCK & PROVEEDORES TAB                                       */}
      {/* ============================================================= */}
      {activeTab === 'stock' && (
        <div className="space-y-6">
          {/* ── INVENTARIO ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="package" className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Inventario</h3>
              <span className="text-xs text-[#9CA3AF] ml-auto">{filteredIngredients.length} ingredientes</span>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A8B0]" />
                <input
                  type="text"
                  placeholder="Buscar ingrediente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all w-full"
                />
              </div>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className={`${selectCls} sm:w-56`}
              >
                <option value="all">Todos los proveedores</option>
                {providerNames.map((pn) => (
                  <option key={pn} value={pn}>{pn}</option>
                ))}
              </select>
            </div>

            {/* Stock Table */}
            <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="max-h-[calc(100vh-480px)] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#FAFAFC] z-10">
                    <tr className="border-b border-[#ECECF1]">
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Nombre</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Unidad</th>
                      <th className="text-right px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Stock</th>
                      <th className="text-right px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Mínimo</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Proveedor</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Estado</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIngredients.map((item) => {
                      const status = stockStatus(item.quantity, item.min_stock);
                      const isEditing = editingId === item.id;
                      const isRestocking = restockId === item.id;

                      return (
                        <tr key={item.id} className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors">
                          <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium max-w-[220px] truncate" title={item.name}>
                            {item.name}
                          </td>
                          <td className="px-4 py-2.5 text-[#6B7280] text-[13px]">{item.unit}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {isEditing ? (
                              <input type="number" step="0.1" value={editData.quantity}
                                onChange={(e) => setEditData((d) => ({ ...d, quantity: e.target.value }))}
                                className="w-24 px-2 py-1 rounded border border-[#C9A84C] bg-white text-[#1A1A1A] text-[13px] text-right focus:outline-none" />
                            ) : (
                              <span className={`text-[13px] ${status.color} font-medium`}>
                                {formatQty(item.quantity, item.unit)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            {isEditing ? (
                              <input type="number" step="0.1" value={editData.min_stock}
                                onChange={(e) => setEditData((d) => ({ ...d, min_stock: e.target.value }))}
                                className="w-24 px-2 py-1 rounded border border-[#C9A84C] bg-white text-[#1A1A1A] text-[13px] text-right focus:outline-none" />
                            ) : (
                              <span className="text-[13px] text-[#6B7280]">
                                {formatQty(item.min_stock, item.unit)}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-[#6B7280] text-[13px] max-w-[160px] truncate" title={item.supplier}>
                            {item.supplier || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${status.bg} ${status.color}`}>
                              <Icon name={status.icon} className="w-3 h-3" />
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {isEditing ? (
                                <>
                                  <button onClick={saveEdit} disabled={saving}
                                    className="p-1.5 rounded-lg text-white disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }} title="Guardar">
                                    <Icon name="check" className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => setEditingId(null)}
                                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors" title="Cancelar">
                                    <Icon name="close" className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : isRestocking ? (
                                <>
                                  <input type="number" step="0.1" placeholder="Cantidad" value={restockQty}
                                    onChange={(e) => setRestockQty(e.target.value)}
                                    className="w-20 px-2 py-1 rounded border border-[#C9A84C] bg-white text-[#1A1A1A] text-[13px] text-right focus:outline-none" />
                                  <button onClick={() => handleRestock(item.id)} disabled={saving || !restockQty}
                                    className="p-1.5 rounded-lg text-white disabled:opacity-60"
                                    style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }} title="Confirmar reposición">
                                    <Icon name="check" className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => { setRestockId(null); setRestockQty(''); }}
                                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors" title="Cancelar">
                                    <Icon name="close" className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(item)}
                                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors" title="Editar">
                                    <Icon name="edit" className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => { setRestockId(item.id); setRestockQty(''); }}
                                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EFFAF2] hover:text-[#16A34A] transition-colors" title="Reponer stock">
                                    <Icon name="plus" className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {loading && (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando inventario...
                </div>
              )}
              {!loading && filteredIngredients.length === 0 && (
                <div className="text-center py-12 text-[#9CA3AF]">
                  <Icon name="package" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No se encontraron ingredientes
                </div>
              )}
              {filteredIngredients.length > 0 && (
                <div className="px-4 py-2 border-t border-[#F2F2F5] text-xs text-[#9CA3AF] text-right">
                  {filteredIngredients.length} ingrediente{filteredIngredients.length > 1 ? 's' : ''}
                  {lowStockCount > 0 && <span className="ml-2 text-[#D97706]">· {lowStockCount} bajo mínimo</span>}
                  {outOfStockCount > 0 && <span className="ml-2 text-[#DC2626]">· {outOfStockCount} agotado{outOfStockCount > 1 ? 's' : ''}</span>}
                </div>
              )}
            </div>
          </div>

          {/* ── PROVEEDORES ── */}
          <div ref={providersRef}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Proveedores</h3>
              <span className="text-xs text-[#9CA3AF] ml-auto">{providers.length} proveedores</span>
            </div>

            <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="max-h-[320px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#FAFAFC] z-10">
                    <tr className="border-b border-[#ECECF1]">
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Nombre</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Categoría</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Contacto</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Teléfono</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Email</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Ingredientes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {providers.map((p) => {
                      const ingredientCount = ingredients.filter((i) => i.supplier === p.name).length;
                      return (
                        <tr key={p.id} className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors">
                          <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium max-w-[200px] truncate" title={p.name}>
                            {p.name}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-[10px] bg-[#F5F5F8] text-[#6B7280] px-2 py-0.5 rounded-full">
                              {p.category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[#6B7280] text-[13px] max-w-[180px] truncate" title={p.contact_name}>
                            {p.contact_name || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-[#6B7280] text-[13px]">
                            {p.phone ? (
                              <span className="inline-flex items-center gap-1">
                                <Icon name="phone" className="w-3 h-3 text-[#C9A84C]" />
                                {p.phone}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-[#6B7280] text-[13px] max-w-[220px] truncate" title={p.email}>
                            {p.email ? (
                              <span className="inline-flex items-center gap-1">
                                <Icon name="email" className="w-3 h-3 text-[#C9A84C]" />
                                {p.email}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-[#FBF6E9] text-[#C9A84C] text-xs font-semibold">
                              {ingredientCount}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {loadingProviders && (
                <div className="text-center py-8 text-[#9CA3AF]">
                  <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando proveedores...
                </div>
              )}
              {!loadingProviders && providers.length === 0 && (
                <div className="text-center py-8 text-[#9CA3AF]">
                  <Icon name="truck" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No se encontraron proveedores
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  ESCANDALLOS TAB                                               */}
      {/* ============================================================= */}
      {activeTab === 'escandallos' && (
        <div className="space-y-4">
          {/* Event selector */}
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedEvent}
              onChange={(e) => { setSelectedEvent(e.target.value); setStockShortages([]); setEditingEscandalloId(null); }}
              className={`${selectCls} sm:w-80`}
            >
              <option value="">Seleccionar evento...</option>
              {events.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  {ev.client_name} — {ev.event_date ? new Date(ev.event_date).toLocaleDateString('es-ES') : 'Sin fecha'} ({ev.status})
                </option>
              ))}
            </select>
          </div>

          {/* Escandallo display */}
          {loadingEscandallo && (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
              Cargando escandallo...
            </div>
          )}

          {!loadingEscandallo && selectedEvent && !escandallo && (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Icon name="layers" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Este evento no tiene escandallo generado</p>
              <p className="text-xs text-[#A8A8B0] mt-1">Se genera automáticamente al aceptar el presupuesto</p>
            </div>
          )}

          {!loadingEscandallo && escandallo && (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-[#F8F3E6] rounded-xl px-4 py-3 border border-[#ECECF1]">
                  <Icon name="layers" className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] text-[#6B7280]">Event:</span>
                  <span className="text-[13px] text-[#1A1A1A] font-semibold">{escandallo.event_name}</span>
                </div>
                <div className="flex items-center gap-2 bg-[#F8F3E6] rounded-xl px-4 py-3 border border-[#ECECF1]">
                  <Icon name="package" className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] text-[#6B7280]">Ingredientes:</span>
                  <span className="text-[13px] text-[#1A1A1A] font-semibold">{escandalloTotal.count}</span>
                </div>
                <div className="flex items-center gap-2 bg-[#F8F3E6] rounded-xl px-4 py-3 border border-[#ECECF1]">
                  <Icon name="scale" className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] text-[#6B7280]">Total cantidad:</span>
                  <span className="text-[13px] text-[#1A1A1A] font-semibold">{escandalloTotal.totalQty.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>
                </div>
                <div className="flex items-center gap-2 bg-[#F8F3E6] rounded-xl px-4 py-3 border border-[#ECECF1]">
                  <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] text-[#6B7280]">Proveedores:</span>
                  <span className="text-[13px] text-[#1A1A1A] font-semibold">{groupedItems.length}</span>
                </div>
              </div>

              {/* Grouped tables */}
              {groupedItems.map((group) => (
                <div key={group.provider} className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                  <div className="px-4 py-3 bg-[#FAFAFC] border-b border-[#ECECF1] flex items-center gap-2">
                    <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
                    <span className="text-[13px] font-semibold text-[#1A1A1A]">{group.provider}</span>
                    <span className="text-[11px] text-[#9CA3AF] ml-auto">{group.items.length} ingrediente{group.items.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#F2F2F5]">
                          <th className="text-left px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Ingrediente</th>
                          <th className="text-right px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Gramos</th>
                          <th className="text-right px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Unidades</th>
                          <th className="text-right px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Ml</th>
                          <th className="text-center px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => {
                          const isEditing = editingEscandalloId === item.id;
                          return (
                            <tr key={item.id} className="border-b border-[#F2F2F5] last:border-b-0 hover:bg-[#FAFCFE] transition-colors">
                              <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px]">{item.ingredient_name}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {isEditing ? (
                                  <input type="number" step="0.1" value={escandalloEditData.total_grams}
                                    onChange={(e) => setEscandalloEditData((d) => ({ ...d, total_grams: e.target.value }))}
                                    className="w-24 px-2 py-1 rounded border border-[#C9A84C] bg-white text-[#1A1A1A] text-[13px] text-right focus:outline-none" />
                                ) : (
                                  <span className="text-[#1A1A1A] text-[13px] font-medium">
                                    {Number(item.total_grams || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {isEditing ? (
                                  <input type="number" step="0.1" value={escandalloEditData.total_units}
                                    onChange={(e) => setEscandalloEditData((d) => ({ ...d, total_units: e.target.value }))}
                                    className="w-24 px-2 py-1 rounded border border-[#C9A84C] bg-white text-[#1A1A1A] text-[13px] text-right focus:outline-none" />
                                ) : (
                                  <span className="text-[#1A1A1A] text-[13px] font-medium">
                                    {Number(item.total_units || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {isEditing ? (
                                  <input type="number" step="0.1" value={escandalloEditData.total_ml}
                                    onChange={(e) => setEscandalloEditData((d) => ({ ...d, total_ml: e.target.value }))}
                                    className="w-24 px-2 py-1 rounded border border-[#C9A84C] bg-white text-[#1A1A1A] text-[13px] text-right focus:outline-none" />
                                ) : (
                                  <span className="text-[#6B7280] text-[13px]">
                                    {Number(item.total_ml || 0).toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {isEditing ? (
                                    <>
                                      <button onClick={saveEscandalloEdit} disabled={savingEscandallo}
                                        className="p-1.5 rounded-lg text-white disabled:opacity-60"
                                        style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }} title="Guardar">
                                        <Icon name="check" className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => setEditingEscandalloId(null)}
                                        className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors" title="Cancelar">
                                        <Icon name="close" className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button onClick={() => startEscandalloEdit(item)}
                                      className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors" title="Editar">
                                      <Icon name="edit" className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Escandallo summary */}
              <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="px-4 py-3 bg-[#FAFAFC] border-b border-[#ECECF1] flex items-center gap-2">
                  <Icon name="scale" className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] font-semibold text-[#1A1A1A]">Resumen Escandallo</span>
                </div>
                <div className="p-4 flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 bg-[#FBF6E9] rounded-xl px-4 py-3 border border-[#ECECF1]">
                    <span className="text-[12px] text-[#6B7280]">Total Gramos:</span>
                    <span className="text-[13px] text-[#1A1A1A] font-semibold tabular-nums">
                      {escandalloTotal.totalGrams.toLocaleString('es-ES', { maximumFractionDigits: 1 })} g
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FBF6E9] rounded-xl px-4 py-3 border border-[#ECECF1]">
                    <span className="text-[12px] text-[#6B7280]">Total Unidades:</span>
                    <span className="text-[13px] text-[#1A1A1A] font-semibold tabular-nums">
                      {escandalloTotal.totalUnits.toLocaleString('es-ES', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 bg-[#FBF6E9] rounded-xl px-4 py-3 border border-[#ECECF1]">
                    <span className="text-[12px] text-[#6B7280]">Total Ml:</span>
                    <span className="text-[13px] text-[#1A1A1A] font-semibold tabular-nums">
                      {escandalloTotal.totalMl.toLocaleString('es-ES', { maximumFractionDigits: 0 })} ml
                    </span>
                  </div>
                </div>
              </div>

              {/* Stock check section */}
              <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="px-4 py-3 bg-[#FAFAFC] border-b border-[#ECECF1] flex items-center gap-2">
                  <Icon name="check" className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] font-semibold text-[#1A1A1A]">Comprobar Stock</span>
                </div>
                <div className="p-4">
                  <button
                    onClick={checkStock}
                    disabled={stockCheckLoading || !selectedEvent}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                  >
                    <Icon name={stockCheckLoading ? 'spinner' : 'search'} className={`w-4 h-4 ${stockCheckLoading ? 'animate-spin' : ''}`} />
                    Comprobar stock
                  </button>

                  {stockShortages.length > 0 && (
                    <div className="mt-4 p-4 rounded-xl border" style={{ background: stockShortages.some((s) => s.available === 0) ? '#FEF3F3' : '#FFF8EC', borderColor: stockShortages.some((s) => s.available === 0) ? '#FECACA' : '#FDE68A' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="alertTriangle" className={`w-4 h-4 ${stockShortages.some((s: any) => s.available === 0) ? "text-[#DC2626]" : "text-[#D97706]"}`} />
                        <span className="text-sm font-semibold" >
                          {stockShortages.length} ingrediente{stockShortages.length > 1 ? 's' : ''} con falta de stock
                        </span>
                      </div>
                      <div className="space-y-2">
                        {stockShortages.map((shortage, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[13px] py-1.5 border-b border-black/5 last:border-b-0">
                            <span className="text-[#1A1A1A] font-medium">{shortage.ingredient_name}</span>
                            <span className={`font-semibold ${shortage.available === 0 ? 'text-[#DC2626]' : 'text-[#D97706]'}`}>
                              Necesita: {shortage.needed} · Disponible: {shortage.available} {shortage.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!stockCheckLoading && stockShortages.length === 0 && selectedEvent && (
                    <div className="mt-4 text-center text-[13px] text-[#9CA3AF] py-3">
                      Pulsa "Comprobar stock" para verificar disponibilidad
                    </div>
                  )}
                </div>
              </div>
            </>
          )}         
        </div>
      )}

      {/* ============================================================= */}
      {/*  PEDIDOS TAB                                                   */}
      {/* ============================================================= */}
      {activeTab === 'pedidos' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Pedidos a Proveedores</h3>
              <span className="text-xs text-[#9CA3AF] ml-1">{supplierOrders.length} pedido{supplierOrders.length !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={() => setShowNewOrder(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              <Icon name="plus" className="w-4 h-4" />
              Nuevo Pedido
            </button>
          </div>

          {/* Summary cards */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-3 bg-[#FFF8EC] rounded-xl px-5 py-4 border border-[#ECECF1] min-w-[160px]">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#FEF3C7]">
                <Icon name="clock" className="w-5 h-5 text-[#D97706]" />
              </div>
              <div>
                <span className="block text-[20px] font-bold text-[#D97706] tabular-nums">
                  {supplierOrders.filter((o) => o.status === 'pending').length}
                </span>
                <span className="block text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium">Pendientes</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[#EFF6FF] rounded-xl px-5 py-4 border border-[#ECECF1] min-w-[160px]">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#DBEAFE]">
                <Icon name="truck" className="w-5 h-5 text-[#2563EB]" />
              </div>
              <div>
                <span className="block text-[20px] font-bold text-[#2563EB] tabular-nums">
                  {supplierOrders.filter((o) => o.status === 'ordered').length}
                </span>
                <span className="block text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium">Enviados</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[#EFFAF2] rounded-xl px-5 py-4 border border-[#ECECF1] min-w-[160px]">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#D1FAE5]">
                <Icon name="check" className="w-5 h-5 text-[#16A34A]" />
              </div>
              <div>
                <span className="block text-[20px] font-bold text-[#16A34A] tabular-nums">
                  {supplierOrders.filter((o) => o.status === 'delivered').length}
                </span>
                <span className="block text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium">Entregados</span>
              </div>
            </div>
          </div>

          {/* Orders table */}
          {loadingOrders ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
              Cargando pedidos...
            </div>
          ) : supplierOrders.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Icon name="truck" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay pedidos registrados</p>
              <p className="text-xs text-[#A8A8B0] mt-1">Crea un nuevo pedido para empezar</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="max-h-[calc(100vh-480px)] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-[#FAFAFC] z-10">
                    <tr className="border-b border-[#ECECF1]">
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Proveedor</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Items</th>
                      <th className="text-right px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Coste</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Estado</th>
                      <th className="text-left px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Fecha esperada</th>
                      <th className="text-center px-4 py-3 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierOrders.map((order) => {
                      const statusBadge = (() => {
                        switch (order.status) {
                          case 'pending':
                            return { label: 'Pendiente', bg: 'bg-[#FEF3C7]', color: 'text-[#D97706]', icon: 'clock' };
                          case 'ordered':
                            return { label: 'Enviado', bg: 'bg-[#DBEAFE]', color: 'text-[#2563EB]', icon: 'truck' };
                          case 'delivered':
                            return { label: 'Entregado', bg: 'bg-[#D1FAE5]', color: 'text-[#16A34A]', icon: 'check' };
                          case 'cancelled':
                            return { label: 'Cancelado', bg: 'bg-[#FEE2E2]', color: 'text-[#DC2626]', icon: 'close' };
                          default:
                            return { label: order.status, bg: 'bg-[#F3F4F6]', color: 'text-[#6B7280]', icon: 'help' };
                        }
                      })();

                      const itemCount = order.items?.length || 0;
                      const totalCost = order.total_cost || order.items?.reduce((sum: number, it: any) => sum + (it.cost || 0) * (it.quantity || 0), 0) || 0;

                      return (
                        <tr key={order.id} className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors">
                          <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium max-w-[200px] truncate" title={order.supplier}>
                            {order.supplier || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-[#FBF6E9] text-[#C9A84C] text-xs font-semibold">
                              {itemCount}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-[#1A1A1A] text-[13px] font-medium tabular-nums">
                            €{totalCost.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusBadge.bg} ${statusBadge.color}`}>
                              <Icon name={statusBadge.icon} className="w-3 h-3" />
                              {statusBadge.label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-[#6B7280] text-[13px]">
                            {order.expected_date ? new Date(order.expected_date).toLocaleDateString('es-ES') : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {order.status === 'pending' && (
                                <button
                                  onClick={async () => {
                                    await fetch('/api/stock/supplier-orders', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: order.id, status: 'ordered' }),
                                    });
                                    loadOrders();
                                  }}
                                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EFF6FF] hover:text-[#2563EB] transition-colors"
                                  title="Marcar enviado"
                                >
                                  <Icon name="truck" className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {order.status === 'ordered' && (
                                <button
                                  onClick={async () => {
                                    await fetch('/api/stock/supplier-orders', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: order.id, status: 'delivered', delivered_date: new Date().toISOString() }),
                                    });
                                    loadOrders();
                                  }}
                                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EFFAF2] hover:text-[#16A34A] transition-colors"
                                  title="Marcar entregado"
                                >
                                  <Icon name="check" className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {order.status !== 'cancelled' && order.status !== 'delivered' && (
                                <button
                                  onClick={async () => {
                                    await fetch('/api/stock/supplier-orders', {
                                      method: 'DELETE',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ id: order.id }),
                                    });
                                    loadOrders();
                                  }}
                                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors"
                                  title="Eliminar"
                                >
                                  <Icon name="trash" className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-[#F2F2F5] text-xs text-[#9CA3AF] text-right">
                {supplierOrders.length} pedido{supplierOrders.length > 1 ? 's' : ''}
              </div>
            </div>
          )}

          {/* New Order Form Modal */}
          {showNewOrder && (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl border border-[#ECECF1] w-full max-w-lg max-h-[90vh] overflow-auto">
                <div className="px-6 py-4 border-b border-[#ECECF1] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
                    <h3 className="text-sm font-semibold text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      Nuevo Pedido
                    </h3>
                  </div>
                  <button onClick={() => { setShowNewOrder(false); setNewOrder({ supplier: '', notes: '', expected_date: '', items: [] }); }}
                    className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors">
                    <Icon name="close" className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Proveedor</label>
                    <input
                      type="text"
                      placeholder="Nombre del proveedor..."
                      value={newOrder.supplier}
                      onChange={(e) => setNewOrder((o) => ({ ...o, supplier: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Fecha esperada</label>
                      <input
                        type="date"
                        value={newOrder.expected_date}
                        onChange={(e) => setNewOrder((o) => ({ ...o, expected_date: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Notas</label>
                      <input
                        type="text"
                        placeholder="Notas..."
                        value={newOrder.notes}
                        onChange={(e) => setNewOrder((o) => ({ ...o, notes: e.target.value }))}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Items del pedido</label>
                    {newOrder.items.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {newOrder.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 bg-[#FAFAFC] rounded-xl px-3 py-2 border border-[#ECECF1]">
                            <span className="text-[13px] text-[#1A1A1A] font-medium flex-1 truncate">{item.name}</span>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              placeholder="Cant."
                              value={item.quantity || ''}
                              onChange={(e) => {
                                const items = [...newOrder.items];
                                items[idx] = { ...items[idx], quantity: parseFloat(e.target.value) || 0 };
                                setNewOrder((o) => ({ ...o, items }));
                              }}
                              className="w-20 px-2 py-1 rounded border border-[#E5E5EC] bg-white text-[#1A1A1A] text-[13px] text-right focus:border-[#C9A84C] focus:outline-none"
                            />
                            <button
                              onClick={() => setNewOrder((o) => ({ ...o, items: o.items.filter((_: any, i: number) => i !== idx) }))}
                              className="p-1 rounded text-[#9CA3AF] hover:text-[#DC2626] transition-colors"
                            >
                              <Icon name="close" className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[13px] text-[#A8A8B0] mb-2">Añade ingredientes del inventario al pedido:</p>
                    )}
                    <select
                      value=""
                      onChange={(e) => {
                        const ing = ingredients.find((i) => i.id === e.target.value);
                        if (ing && !newOrder.items.find((it: any) => it.ingredient_id === ing.id)) {
                          setNewOrder((o) => ({
                            ...o,
                            supplier: o.supplier || ing.supplier || '',
                            items: [...o.items, { ingredient_id: ing.id, name: ing.name, quantity: 1, unit: ing.unit, cost_per_unit: ing.cost_per_unit }],
                          }));
                        }
                      }}
                      className={selectCls + ' w-full'}
                    >
                      <option value="">+ Añadir ingrediente...</option>
                      {ingredients.filter((i) => i.active).map((ing) => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-[#ECECF1] flex justify-end gap-2">
                  <button
                    onClick={() => { setShowNewOrder(false); setNewOrder({ supplier: '', notes: '', expected_date: '', items: [] }); }}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F8] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      if (!newOrder.supplier || newOrder.items.length === 0) return;
                      await fetch('/api/stock/supplier-orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newOrder),
                      });
                      setShowNewOrder(false);
                      setNewOrder({ supplier: '', notes: '', expected_date: '', items: [] });
                      loadOrders();
                    }}
                    disabled={!newOrder.supplier || newOrder.items.length === 0}
                    className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all"
                    style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                  >
                    <Icon name="check" className="w-4 h-4 inline mr-1" />
                    Crear Pedido
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
