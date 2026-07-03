'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Icon from '../shared/Icon';
import { DataCard, DataList } from '@/components/ui';
import { StatStrip } from '@/components/ui/StatStrip';

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
  actual_quantity?: number;
  actual_unit?: string;
  actual_cost?: number;
  cost_per_unit?: number;
}

interface RecipeItem {
  id?: string;
  ingredient_name: string;
  quantity_per_pax: number;
  unit: string;
  supplier: string;
}

interface Recipe {
  id: string;
  name: string;
  category: string;
  base_pax: number;
  description: string;
  is_active: boolean;
  items: RecipeItem[];
}

interface Escandallo {
  event_id: string;
  event_name: string;
  items: ShoppingItem[];
}

type Tab = 'stock' | 'escandallos' | 'pedidos' | 'recetas';

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

/* ── Inline-editable provider row ──────────────────────────────── */
function ProviderRow({ p, ingredients, setProviders }: {
  p: Provider;
  ingredients: { supplier: string }[];
  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const ingredientCount = ingredients.filter((i) => i.supplier === p.name).length;

  const saveField = async (field: string) => {
    setSaving(true);
    try {
      await fetch(`/api/providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: draft[field] || null }),
      });
      setProviders((prev: any[]) => prev.map((x: any) => x.id === p.id ? { ...x, [field]: draft[field] || null } : x));
    } catch {}
    setEditing(null);
    setSaving(false);
  };

  const Cell = ({ field, value }: { field: string; value: string | null }) => {
    if (editing === field) {
      return (
        <input
          autoFocus
          value={draft[field] || ''}
          onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value }))}
          onBlur={() => saveField(field)}
          onKeyDown={(e) => { if (e.key === 'Enter') saveField(field); if (e.key === 'Escape') setEditing(null); }}
          disabled={saving}
          className="w-full px-2 py-1 text-[13px] border border-[#C9A84C] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
        />
      );
    }
    return (
      <span
        className="cursor-pointer hover:bg-[#FBF6E9] px-2 py-1 rounded-lg transition-colors text-[#6B7280] text-[13px]"
        title={value || 'Click para editar'}
        onClick={() => { setEditing(field); setDraft({ [field]: value || '' }); }}
      >
        {value || <span className="text-[#C9A84C] italic text-[12px]">+ anadir</span>}
      </span>
    );
  };

  return (
    <tr className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors">
      <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium max-w-[200px] truncate" title={p.name}>{p.name}</td>
      <td className="px-4 py-2.5">
        <span className="text-[10px] bg-[#F5F5F8] text-[#6B7280] px-2 py-0.5 rounded-full">{p.category}</span>
      </td>
      <td className="px-4 py-2.5"><Cell field="contact_name" value={p.contact_name} /></td>
      <td className="px-4 py-2.5"><Cell field="phone" value={p.phone} /></td>
      <td className="px-4 py-2.5"><Cell field="email" value={p.email} /></td>
      <td className="px-4 py-2.5 text-center">
        <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-[#FBF6E9] text-[#C9A84C] text-xs font-semibold">{ingredientCount}</span>
      </td>
    </tr>
  );
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
  // Sprint 6 (F1.2): recepción completa de pedido con trazabilidad (lote/caducidad auto)
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);
  const [receiveResult, setReceiveResult] = useState<{ orderId: string; message: string; ok: boolean } | null>(null);

  // Stock check state
  const [stockCheckLoading, setStockCheckLoading] = useState(false);
  const [stockShortages, setStockShortages] = useState<Array<{ ingredient_name: string; needed: number; available: number; unit: string; metric: string }>>([]);

  // Proveedores state
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const providersRef = useRef<HTMLDivElement>(null);

  // Add ingredient form state
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', unit: 'kg', quantity: '', min_stock: '', cost_per_unit: '', supplier: '' });
  const [savingNewItem, setSavingNewItem] = useState(false);

  // Add provider form state
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', category: '' });
  const [savingNewProvider, setSavingNewProvider] = useState(false);

  // Recipes state
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  const [showRecipeForm, setShowRecipeForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    category: 'general',
    base_pax: '50',
    description: '',
    items: [] as RecipeItem[],
  });
  const [savingRecipe, setSavingRecipe] = useState(false);

  // Actuals state (escandallo)
  const [actualsData, setActualsData] = useState<Record<string, { actual_quantity: string; actual_unit: string; actual_cost: string }>>({});
  const [savingActuals, setSavingActuals] = useState<string | null>(null);

  // Generate order state
  const [generatingOrder, setGeneratingOrder] = useState(false);
  const [generateOrderResult, setGenerateOrderResult] = useState<{ count: number } | null>(null);

  // Price history state
  const [priceHistoryIngredientId, setPriceHistoryIngredientId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<Array<{ old_price: number; new_price: number; created_at: string }>>([]);
  const [loadingPriceHistory, setLoadingPriceHistory] = useState(false);

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
    setEscandallo(null); // Clear previous data while loading
    try {
      const res = await fetch(`/api/stock/escandallos?event_id=${eventId}`);
      const data = await res.json();
      if (res.ok && data.success && data.data) {
        const group = data.data[eventId];
        if (group) {
          setEscandallo({ event_id: eventId, event_name: group.event_name, items: group.items || [] });
        }
      }
    } catch { /* ignore */ }
    finally { setLoadingEscandallo(false); }
  }, []);

  const loadRecipes = useCallback(async () => {
    try {
      setLoadingRecipes(true);
      const res = await fetch('/api/recipes');
      const data = await res.json();
      if (data.success) setRecipes(data.data || []);
    } catch { /* ignore */ }
    finally { setLoadingRecipes(false); }
  }, []);

  const loadPriceHistory = useCallback(async (ingredientId: string) => {
    try {
      setLoadingPriceHistory(true);
      setPriceHistoryIngredientId(ingredientId);
      const res = await fetch(`/api/stock/price-history?ingredient_id=${ingredientId}`);
      const data = await res.json();
      if (data.success) setPriceHistory(data.data || []);
    } catch { /* ignore */ }
    finally { setLoadingPriceHistory(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'stock') { loadStock(); loadProviders(); }
    if (activeTab === 'escandallos' && events.length === 0) loadEvents();
    if (activeTab === 'pedidos') loadOrders();
    if (activeTab === 'recetas') loadRecipes();
  }, [activeTab, loadStock, loadProviders, loadEvents, loadOrders, loadRecipes, events.length]);

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

  const handleAddIngredient = async () => {
    if (!newItem.name) return;
    setSavingNewItem(true);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newItem.name,
          unit: newItem.unit,
          quantity: parseFloat(newItem.quantity) || 0,
          min_stock: parseFloat(newItem.min_stock) || 0,
          cost_per_unit: parseFloat(newItem.cost_per_unit) || 0,
          supplier: newItem.supplier || '',
        }),
      });
      if (res.ok) {
        setShowAddIngredient(false);
        setNewItem({ name: '', unit: 'kg', quantity: '', min_stock: '', cost_per_unit: '', supplier: '' });
        await loadStock();
      }
    } catch { /* ignore */ }
    finally { setSavingNewItem(false); }
  };

  const handleAddProvider = async () => {
    if (!newProvider.name) return;
    setSavingNewProvider(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProvider.name, category: newProvider.category }),
      });
      if (res.ok) {
        setShowAddProvider(false);
        setNewProvider({ name: '', category: '' });
        await loadProviders();
      }
    } catch { /* ignore */ }
    finally { setSavingNewProvider(false); }
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
  /*  Recipe actions                                                   */
  /* ---------------------------------------------------------------- */

  const openNewRecipe = () => {
    setEditingRecipe(null);
    setRecipeForm({ name: '', category: 'general', base_pax: '50', description: '', items: [] });
    setShowRecipeForm(true);
  };

  const openEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(recipe);
    setRecipeForm({
      name: recipe.name,
      category: recipe.category,
      base_pax: String(recipe.base_pax),
      description: recipe.description || '',
      items: recipe.items || [],
    });
    setShowRecipeForm(true);
  };

  const saveRecipe = async () => {
    if (!recipeForm.name) return;
    setSavingRecipe(true);
    try {
      const url = editingRecipe ? `/api/recipes/${editingRecipe.id}` : '/api/recipes';
      const method = editingRecipe ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: recipeForm.name,
          category: recipeForm.category,
          base_pax: parseInt(recipeForm.base_pax) || 50,
          description: recipeForm.description,
          items: recipeForm.items,
        }),
      });
      if (res.ok) {
        setShowRecipeForm(false);
        setEditingRecipe(null);
        await loadRecipes();
      }
    } catch { /* ignore */ }
    finally { setSavingRecipe(false); }
  };

  const deleteRecipe = async (id: string, name: string) => {
    if (!confirm(`Eliminar receta "${name}"?`)) return;
    try {
      await fetch(`/api/recipes/${id}`, { method: 'DELETE' });
      await loadRecipes();
    } catch { /* ignore */ }
  };

  const addRecipeItem = () => {
    setRecipeForm((f) => ({
      ...f,
      items: [...f.items, { ingredient_name: '', quantity_per_pax: 0, unit: 'g', supplier: '' }],
    }));
  };

  const removeRecipeItem = (idx: number) => {
    setRecipeForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== idx),
    }));
  };

  const updateRecipeItem = (idx: number, field: string, value: any) => {
    setRecipeForm((f) => ({
      ...f,
      items: f.items.map((item, i) => i === idx ? { ...item, [field]: value } : item),
    }));
  };

  /* ---------------------------------------------------------------- */
  /*  Actuals actions                                                  */
  /* ---------------------------------------------------------------- */

  const saveActuals = async (itemId: string) => {
    const data = actualsData[itemId];
    if (!data) return;
    setSavingActuals(itemId);
    try {
      const res = await fetch('/api/stock/actuals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{
            id: itemId,
            actual_quantity: parseFloat(data.actual_quantity) || null,
            actual_unit: data.actual_unit || null,
            actual_cost: parseFloat(data.actual_cost) || null,
          }],
        }),
      });
      if (res.ok && selectedEvent) await loadEscandallo(selectedEvent);
    } catch { /* ignore */ }
    finally { setSavingActuals(null); }
  };

  const updateActualsField = (itemId: string, field: string, value: string) => {
    setActualsData((prev) => {
      const existing = prev[itemId] || { actual_quantity: '', actual_unit: 'g', actual_cost: '' };
      return { ...prev, [itemId]: { ...existing, [field]: value } };
    });
  };

  /* ---------------------------------------------------------------- */
  /*  Generate order action                                            */
  /* ---------------------------------------------------------------- */

  const generateOrder = async () => {
    if (!selectedEvent) return;
    setGeneratingOrder(true);
    setGenerateOrderResult(null);
    try {
      const res = await fetch('/api/stock/generate-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: selectedEvent }),
      });
      const data = await res.json();
      if (data.success) {
        setGenerateOrderResult({ count: data.data?.count || 0 });
        loadOrders();
      }
    } catch { /* ignore */ }
    finally { setGeneratingOrder(false); }
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

      {/* KPI Summary Cards */}
      <StatStrip items={[
        { label: 'Total', value: ingredients.length, accent: true },
        { label: 'Stock bajo', value: lowStockCount },
        { label: 'Agotados', value: outOfStockCount },
        { label: 'Proveedores', value: providers.length },
      ]} />

      {/* Tabs */}
      <div className="flex gap-1 bg-[#F8F3E6] rounded-xl p-1 border border-[#ECECF1]">
        {([
          { key: 'stock' as Tab, label: 'Stock & Proveedores', icon: 'package' },
          { key: 'escandallos' as Tab, label: 'Escandallos por Evento', icon: 'layers' },
          { key: 'pedidos' as Tab, label: 'Pedidos a Proveedores', icon: 'truck' },
          { key: 'recetas' as Tab, label: 'Recetas', icon: 'book' },
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
              <button onClick={() => setShowAddIngredient(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-all ml-2" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                <Icon name="plus" className="w-3.5 h-3.5" />
                Añadir
              </button>
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

            {/* Stock List */}
            <DataList
              loading={loading}
              emptyIcon={<Icon name="package" className="w-8 h-8" />}
              emptyTitle="No se encontraron ingredientes"
              count={filteredIngredients.length}
            >
              {filteredIngredients.map((item) => {
                const status = stockStatus(item.quantity, item.min_stock);
                const isEditing = editingId === item.id;
                const isRestocking = restockId === item.id;

                return (
                  <DataCard
                    key={item.id}
                    avatar={{
                      initials: item.name.charAt(0).toUpperCase(),
                      color: item.quantity === 0
                        ? '#DC2626'
                        : item.quantity <= item.min_stock
                          ? '#D97706'
                          : '#16A34A',
                    }}
                    title={item.name}
                    subtitle={item.supplier || 'Sin proveedor'}
                    badges={[{
                      label: status.label,
                      variant: status.label === 'OK' ? 'success' : status.label === 'Bajo' ? 'warning' : 'danger',
                    }]}
                    meta={[
                      { label: 'Stock', value: formatQty(item.quantity, item.unit) },
                      { label: 'Mínimo', value: formatQty(item.min_stock, item.unit) },
                      { label: 'Coste/u', value: item.cost_per_unit ? `${Number(item.cost_per_unit).toFixed(2)}€` : '—' },
                    ]}
                    actions={
                      isEditing ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#9CA3AF]">Stock:</span>
                            <input type="number" step="0.1" value={editData.quantity}
                              onChange={(e) => setEditData((d) => ({ ...d, quantity: e.target.value }))}
                              className="w-20 px-2 py-1 rounded-lg border border-[#C9A84C] bg-white text-[#1A1A1A] text-[12px] text-right focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#9CA3AF]">Mín:</span>
                            <input type="number" step="0.1" value={editData.min_stock}
                              onChange={(e) => setEditData((d) => ({ ...d, min_stock: e.target.value }))}
                              className="w-20 px-2 py-1 rounded-lg border border-[#C9A84C] bg-white text-[#1A1A1A] text-[12px] text-right focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[#9CA3AF]">Coste:</span>
                            <input type="number" step="0.01" value={editData.cost_per_unit}
                              onChange={(e) => setEditData((d) => ({ ...d, cost_per_unit: e.target.value }))}
                              className="w-20 px-2 py-1 rounded-lg border border-[#C9A84C] bg-white text-[#1A1A1A] text-[12px] text-right focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
                            <button onClick={() => loadPriceHistory(item.id)}
                              className="text-[9px] text-[#C9A84C] hover:underline whitespace-nowrap" title="Ver historial de precios">
                              (historial)
                            </button>
                          </div>
                          <button onClick={saveEdit} disabled={saving}
                            className="p-1.5 rounded-lg text-white disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }} title="Guardar">
                            <Icon name="check" className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors" title="Cancelar">
                            <Icon name="close" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : isRestocking ? (
                        <div className="flex items-center gap-1.5">
                          <input type="number" step="0.1" placeholder="Cantidad" value={restockQty}
                            onChange={(e) => setRestockQty(e.target.value)}
                            className="w-24 px-2 py-1 rounded-lg border border-[#C9A84C] bg-white text-[#1A1A1A] text-[12px] text-right focus:outline-none focus:ring-1 focus:ring-[#C9A84C]" />
                          <button onClick={() => handleRestock(item.id)} disabled={saving || !restockQty}
                            className="p-1.5 rounded-lg text-white disabled:opacity-60"
                            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }} title="Confirmar reposición">
                            <Icon name="check" className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setRestockId(null); setRestockQty(''); }}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors" title="Cancelar">
                            <Icon name="close" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button onClick={() => startEdit(item)}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors" title="Editar">
                            <Icon name="edit" className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { setRestockId(item.id); setRestockQty(''); }}
                            className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EFFAF2] hover:text-[#16A34A] transition-colors" title="Reponer stock">
                            <Icon name="plus" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    }
                  />
                );
              })}
            </DataList>
            {filteredIngredients.length > 0 && (lowStockCount > 0 || outOfStockCount > 0) && (
              <div className="px-4 py-2 text-xs text-[#9CA3AF] text-right">
                {lowStockCount > 0 && <span className="text-[#D97706]">{lowStockCount} bajo mínimo</span>}
                {outOfStockCount > 0 && <span className="ml-2 text-[#DC2626]">{outOfStockCount} agotado{outOfStockCount > 1 ? 's' : ''}</span>}
              </div>
            )}
          </div>

          {/* ── PROVEEDORES ── */}
          <div ref={providersRef}>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Proveedores</h3>
              <span className="text-xs text-[#9CA3AF] ml-auto">{providers.length} proveedores</span>
              <button onClick={() => setShowAddProvider(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-white transition-all ml-2" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                <Icon name="plus" className="w-3.5 h-3.5" />
                Añadir
              </button>
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
                    {providers.map((p) => (
                      <ProviderRow key={p.id} p={p} ingredients={ingredients} setProviders={setProviders} />
                    ))}
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
      {/*  ADD INGREDIENT MODAL                                          */}
      {/* ============================================================= */}
      {showAddIngredient && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#ECECF1] w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#ECECF1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="package" className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-sm font-semibold text-[#1A1A1A]">A&#241;adir ingrediente</h3>
              </div>
              <button onClick={() => { setShowAddIngredient(false); setNewItem({ name: '', unit: 'kg', quantity: '', min_stock: '', cost_per_unit: '', supplier: '' }); }}
                className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Nombre *</label>
                <input type="text" placeholder="Nombre del ingrediente..." value={newItem.name}
                  onChange={(e) => setNewItem((n) => ({ ...n, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Unidad</label>
                  <select value={newItem.unit} onChange={(e) => setNewItem((n) => ({ ...n, unit: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all w-full">
                    <option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="ud">ud</option><option value="caja">caja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Proveedor</label>
                  <select value={newItem.supplier} onChange={(e) => setNewItem((n) => ({ ...n, supplier: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all w-full">
                    <option value="">Sin proveedor</option>
                    {providers.map((p) => (<option key={p.id} value={p.name}>{p.name}</option>))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Cantidad</label>
                  <input type="number" step="0.1" min="0" placeholder="0" value={newItem.quantity}
                    onChange={(e) => setNewItem((n) => ({ ...n, quantity: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm text-right tabular-nums focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">M&#237;nimo</label>
                  <input type="number" step="0.1" min="0" placeholder="0" value={newItem.min_stock}
                    onChange={(e) => setNewItem((n) => ({ ...n, min_stock: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm text-right tabular-nums focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Coste/u</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00" value={newItem.cost_per_unit}
                    onChange={(e) => setNewItem((n) => ({ ...n, cost_per_unit: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm text-right tabular-nums focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#ECECF1] flex justify-end gap-2">
              <button onClick={() => { setShowAddIngredient(false); setNewItem({ name: '', unit: 'kg', quantity: '', min_stock: '', cost_per_unit: '', supplier: '' }); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F8] transition-colors">
                Cancelar
              </button>
              <button onClick={handleAddIngredient} disabled={!newItem.name || savingNewItem}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                <Icon name={savingNewItem ? 'spinner' : 'check'} className={'w-4 h-4 inline mr-1 ' + (savingNewItem ? 'animate-spin' : '')} />
                A&#241;adir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/*  ADD PROVIDER MODAL                                            */}
      {/* ============================================================= */}
      {showAddProvider && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#ECECF1] w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#ECECF1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-sm font-semibold text-[#1A1A1A]">A&#241;adir proveedor</h3>
              </div>
              <button onClick={() => { setShowAddProvider(false); setNewProvider({ name: '', category: '' }); }}
                className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Nombre *</label>
                <input type="text" placeholder="Nombre del proveedor..." value={newProvider.name}
                  onChange={(e) => setNewProvider((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Categor&#237;a</label>
                <input type="text" placeholder="Ej: Carnicer&#237;a, Fruter&#237;a, L&#225;cteos..." value={newProvider.category}
                  onChange={(e) => setNewProvider((p) => ({ ...p, category: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#ECECF1] flex justify-end gap-2">
              <button onClick={() => { setShowAddProvider(false); setNewProvider({ name: '', category: '' }); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F8] transition-colors">
                Cancelar
              </button>
              <button onClick={handleAddProvider} disabled={!newProvider.name || savingNewProvider}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                <Icon name={savingNewProvider ? 'spinner' : 'check'} className={'w-4 h-4 inline mr-1 ' + (savingNewProvider ? 'animate-spin' : '')} />
                A&#241;adir
              </button>
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
                          <th className="text-center px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Real (cant. + ud)</th>
                          <th className="text-right px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Coste real</th>
                          <th className="text-center px-4 py-2.5 text-[#9CA3AF] font-medium text-[11px] uppercase tracking-wider">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => {
                          const isEditing = editingEscandalloId === item.id;
                          const actual = actualsData[item.id] || { actual_quantity: '', actual_unit: 'g', actual_cost: '' };
                          const plannedQty = (item.total_grams || 0) + (item.total_units || 0) + (item.total_ml || 0);
                          const actualQty = parseFloat(actual.actual_quantity) || 0;
                          const deviation = plannedQty > 0 ? Math.abs(actualQty - plannedQty) / plannedQty : 0;
                          const borderClass = actualQty > 0
                            ? (deviation > 0.1 ? 'border border-[#DC2626]' : 'border border-[#16A34A]')
                            : 'border border-[#E5E5EC]';
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
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder="0"
                                  value={actual.actual_quantity}
                                  onChange={(e) => updateActualsField(item.id, 'actual_quantity', e.target.value)}
                                  className={`w-16 px-1.5 py-1 rounded text-[12px] text-right bg-white text-[#1A1A1A] focus:outline-none ${borderClass}`}
                                />
                                <select
                                  value={actual.actual_unit}
                                  onChange={(e) => updateActualsField(item.id, 'actual_unit', e.target.value)}
                                  className="px-1 py-1 rounded border border-[#E5E5EC] bg-white text-[12px] text-[#6B7280] focus:outline-none"
                                >
                                  <option value="g">g</option>
                                  <option value="ml">ml</option>
                                  <option value="ud">ud</option>
                                </select>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={actual.actual_cost}
                                onChange={(e) => updateActualsField(item.id, 'actual_cost', e.target.value)}
                                className={`w-20 px-1.5 py-1 rounded text-[12px] text-right bg-white text-[#1A1A1A] focus:outline-none ${borderClass}`}
                              />
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
                                    <>
                                      <button onClick={() => saveActuals(item.id)}
                                        disabled={savingActuals === item.id || (!actual.actual_quantity && !actual.actual_cost)}
                                        className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EFFAF2] hover:text-[#16A34A] transition-colors disabled:opacity-40" title="Guardar real">
                                        <Icon name={savingActuals === item.id ? 'spinner' : 'check'} className={`w-3.5 h-3.5 ${savingActuals === item.id ? 'animate-spin' : ''}`} />
                                      </button>
                                      <button onClick={() => startEscandalloEdit(item)}
                                        className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors" title="Editar">
                                        <Icon name="edit" className="w-3.5 h-3.5" />
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

              {/* Generate order button */}
              <div className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <div className="px-4 py-3 bg-[#FAFAFC] border-b border-[#ECECF1] flex items-center gap-2">
                  <Icon name="truck" className="w-4 h-4 text-[#C9A84C]" />
                  <span className="text-[13px] font-semibold text-[#1A1A1A]">Generar Pedido a Proveedor</span>
                </div>
                <div className="p-4">
                  <button
                    onClick={generateOrder}
                    disabled={generatingOrder || !selectedEvent}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60 transition-all"
                    style={{ backgroundColor: '#C9A84C' }}
                  >
                    <Icon name={generatingOrder ? 'spinner' : 'truck'} className={`w-4 h-4 ${generatingOrder ? 'animate-spin' : ''}`} />
                    Generar pedido a proveedor
                  </button>
                  {generateOrderResult && (
                    <div className="mt-3 p-3 rounded-xl bg-[#EFFAF2] border border-[#D1FAE5]">
                      <div className="flex items-center gap-2">
                        <Icon name="check" className="w-4 h-4 text-[#16A34A]" />
                        <span className="text-[13px] text-[#16A34A] font-medium">
                          {generateOrderResult.count} pedido{generateOrderResult.count !== 1 ? 's' : ''} generado{generateOrderResult.count !== 1 ? 's' : ''} correctamente
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}         
        </div>
      )}

      {/* ============================================================= */}
      {/*  RECETAS TAB                                                   */}
      {/* ============================================================= */}
      {activeTab === 'recetas' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="book" className="w-4 h-4 text-[#C9A84C]" />
              <h3 className="text-sm font-semibold text-[#1A1A1A]">Plantillas de Recetas</h3>
              <span className="text-xs text-[#9CA3AF] ml-1">{recipes.length} receta{recipes.length !== 1 ? 's' : ''}</span>
            </div>
            <button
              onClick={openNewRecipe}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              <Icon name="plus" className="w-4 h-4" />
              Nueva Receta
            </button>
          </div>

          {/* Recipe list */}
          {loadingRecipes ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
              Cargando recetas...
            </div>
          ) : recipes.length === 0 ? (
            <div className="text-center py-12 text-[#9CA3AF]">
              <Icon name="book" className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No hay recetas creadas</p>
              <p className="text-xs text-[#A8A8B0] mt-1">Crea una nueva receta para empezar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:shadow-md transition-shadow">
                  <div className="px-4 py-3 bg-[#FAFAFC] border-b border-[#ECECF1]">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[13px] font-semibold text-[#1A1A1A]">{recipe.name}</h4>
                      <span className="text-[10px] bg-[#FBF6E9] text-[#C9A84C] px-2 py-0.5 rounded-full font-medium">{recipe.category}</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-3 text-[12px] text-[#6B7280]">
                      <span className="flex items-center gap-1">
                        <Icon name="users" className="w-3 h-3" />
                        {recipe.base_pax} comensales base
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="package" className="w-3 h-3" />
                        {recipe.items?.length || 0} ingrediente{(recipe.items?.length || 0) !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {recipe.description && (
                      <p className="text-[12px] text-[#9CA3AF] line-clamp-2">{recipe.description}</p>
                    )}
                  </div>
                  <div className="px-4 py-3 border-t border-[#F2F2F5] flex items-center justify-end gap-2">
                    <button
                      onClick={() => openEditRecipe(recipe)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FBF6E9] hover:text-[#C9A84C] transition-colors"
                      title="Editar"
                    >
                      <Icon name="edit" className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRecipe(recipe.id, recipe.name)}
                      className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors"
                      title="Eliminar"
                    >
                      <Icon name="trash" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================= */}
      {/*  RECETA FORM MODAL                                             */}
      {/* ============================================================= */}
      {showRecipeForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#ECECF1] w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-4 border-b border-[#ECECF1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="book" className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-sm font-semibold text-[#1A1A1A]">{editingRecipe ? 'Editar Receta' : 'Nueva Receta'}</h3>
              </div>
              <button onClick={() => { setShowRecipeForm(false); setEditingRecipe(null); }}
                className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Nombre *</label>
                  <input type="text" placeholder="Nombre de la receta..." value={recipeForm.name}
                    onChange={(e) => setRecipeForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Categoría</label>
                  <select value={recipeForm.category} onChange={(e) => setRecipeForm((f) => ({ ...f, category: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all w-full">
                    <option value="boda">Boda</option>
                    <option value="corporativo">Corporativo</option>
                    <option value="bautizo">Bautizo</option>
                    <option value="comuni&#243;n">Comuni&#243;n</option>
                    <option value="cumple">Cumplea&#241;os</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Comensales base</label>
                  <input type="number" min="1" step="1" value={recipeForm.base_pax}
                    onChange={(e) => setRecipeForm((f) => ({ ...f, base_pax: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm text-right tabular-nums focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium mb-1.5">Descripci&#243;n</label>
                  <input type="text" placeholder="Descripci&#243;n breve..." value={recipeForm.description}
                    onChange={(e) => setRecipeForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm placeholder:text-[#A8A8B0] focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all" />
                </div>
              </div>

              {/* Recipe items */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="package" className="w-4 h-4 text-[#C9A84C]" />
                  <label className="text-[11px] uppercase tracking-wider text-[#9CA3AF] font-medium">Ingredientes de la receta</label>
                </div>
                {recipeForm.items.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#E5E5EC] overflow-hidden mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#ECECF1] bg-[#FAFAFC]">
                          <th className="text-left px-3 py-2 text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Ingrediente</th>
                          <th className="text-right px-3 py-2 text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Cant./pax</th>
                          <th className="text-center px-3 py-2 text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Unidad</th>
                          <th className="text-left px-3 py-2 text-[10px] text-[#9CA3AF] font-medium uppercase tracking-wider">Proveedor</th>
                          <th className="w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {recipeForm.items.map((item, idx) => (
                          <tr key={idx} className="border-b border-[#F2F2F5] last:border-b-0">
                            <td className="px-2 py-1.5">
                              <input type="text" placeholder="Nombre..." value={item.ingredient_name}
                                onChange={(e) => updateRecipeItem(idx, 'ingredient_name', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-[#E5E5EC] bg-white text-[#1A1A1A] text-[12px] focus:border-[#C9A84C] focus:outline-none" />
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="number" step="0.1" min="0" value={item.quantity_per_pax || ''}
                                onChange={(e) => updateRecipeItem(idx, 'quantity_per_pax', parseFloat(e.target.value) || 0)}
                                className="w-16 px-2 py-1 rounded border border-[#E5E5EC] bg-white text-[#1A1A1A] text-[12px] text-right focus:border-[#C9A84C] focus:outline-none" />
                            </td>
                            <td className="px-2 py-1.5">
                              <select value={item.unit} onChange={(e) => updateRecipeItem(idx, 'unit', e.target.value)}
                                className="w-full px-1 py-1 rounded border border-[#E5E5EC] bg-white text-[12px] text-[#6B7280] focus:outline-none">
                                <option value="g">g</option>
                                <option value="ml">ml</option>
                                <option value="ud">ud</option>
                              </select>
                            </td>
                            <td className="px-2 py-1.5">
                              <input type="text" placeholder="Proveedor..." value={item.supplier}
                                onChange={(e) => updateRecipeItem(idx, 'supplier', e.target.value)}
                                className="w-full px-2 py-1 rounded border border-[#E5E5EC] bg-white text-[#1A1A1A] text-[12px] focus:border-[#C9A84C] focus:outline-none" />
                            </td>
                            <td className="px-1 py-1.5 text-center">
                              <button onClick={() => removeRecipeItem(idx)}
                                className="p-1 rounded text-[#9CA3AF] hover:text-[#DC2626] transition-colors">
                                <Icon name="close" className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <button onClick={addRecipeItem}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#C9A84C] hover:bg-[#FBF6E9] transition-colors border border-[#E5E5EC]">
                  <Icon name="plus" className="w-3 h-3" />
                  Añadir ingrediente
                </button>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#ECECF1] flex justify-end gap-2">
              <button onClick={() => { setShowRecipeForm(false); setEditingRecipe(null); }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-[#6B7280] hover:bg-[#F5F5F8] transition-colors">
                Cancelar
              </button>
              <button onClick={saveRecipe} disabled={!recipeForm.name || savingRecipe}
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all"
                style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                <Icon name={savingRecipe ? 'spinner' : 'check'} className={'w-4 h-4 inline mr-1 ' + (savingRecipe ? 'animate-spin' : '')} />
                {editingRecipe ? 'Guardar cambios' : 'Crear receta'}
              </button>
            </div>
          </div>
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
                  {supplierOrders.filter((o) => o.status === 'delivered' || o.status === 'received').length}
                </span>
                <span className="block text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium">Entregados</span>
              </div>
            </div>
          </div>

          {receiveResult && (
            <div className={`flex items-start justify-between gap-3 rounded-xl px-4 py-3 text-sm ${receiveResult.ok ? 'bg-[#EFFAF2] text-[#16A34A]' : 'bg-[#FEF3F3] text-[#DC2626]'}`}>
              <div className="flex items-start gap-2">
                <Icon name={receiveResult.ok ? 'check' : 'alertTriangle'} className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{receiveResult.message}</span>
              </div>
              <button onClick={() => setReceiveResult(null)} className="flex-shrink-0 opacity-60 hover:opacity-100">
                <Icon name="close" className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

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
                          case 'received':
                            return { label: 'Recibido (trazado)', bg: 'bg-[#D1FAE5]', color: 'text-[#16A34A]', icon: 'check' };
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
                                  disabled={receivingOrderId === order.id}
                                  onClick={async () => {
                                    setReceivingOrderId(order.id);
                                    setReceiveResult(null);
                                    try {
                                      const res = await fetch(`/api/trazabilidad/receiving/from-order/${order.id}`, { method: 'POST' });
                                      const json = await res.json();
                                      if (json.success) {
                                        const { items_processed, items_total, errors } = json.data;
                                        setReceiveResult({
                                          orderId: order.id,
                                          ok: !errors,
                                          message: errors
                                            ? `Recibido ${items_processed}/${items_total} · ${errors.length} incidencia(s): ${errors.join(' ')}`
                                            : `Pedido recibido: ${items_processed}/${items_total} items con lote/caducidad trazados.`,
                                        });
                                      } else {
                                        setReceiveResult({ orderId: order.id, ok: false, message: json.error || 'Error al recibir el pedido.' });
                                      }
                                    } catch {
                                      setReceiveResult({ orderId: order.id, ok: false, message: 'Error de red al recibir el pedido.' });
                                    } finally {
                                      setReceivingOrderId(null);
                                      loadOrders();
                                    }
                                  }}
                                  className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#EFFAF2] hover:text-[#16A34A] transition-colors disabled:opacity-50"
                                  title="Recibir pedido completo (registra lote/caducidad de cada item automáticamente)"
                                >
                                  <Icon name={receivingOrderId === order.id ? 'spinner' : 'check'} className={'w-3.5 h-3.5 ' + (receivingOrderId === order.id ? 'animate-spin' : '')} />
                                </button>
                              )}
                              {order.status !== 'cancelled' && order.status !== 'delivered' && order.status !== 'received' && (
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

      {/* ============================================================= */}
      {/*  PRICE HISTORY MODAL                                           */}
      {/* ============================================================= */}
      {priceHistoryIngredientId && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-[#ECECF1] w-full max-w-md">
            <div className="px-6 py-4 border-b border-[#ECECF1] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="clock" className="w-4 h-4 text-[#C9A84C]" />
                <h3 className="text-sm font-semibold text-[#1A1A1A]">Historial de Precios</h3>
              </div>
              <button onClick={() => { setPriceHistoryIngredientId(null); setPriceHistory([]); }}
                className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#FEF3F3] hover:text-[#DC2626] transition-colors">
                <Icon name="close" className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6">
              {loadingPriceHistory ? (
                <div className="text-center py-6 text-[#9CA3AF]">
                  <Icon name="spinner" className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Cargando historial...
                </div>
              ) : priceHistory.length === 0 ? (
                <div className="text-center py-6 text-[#9CA3AF]">
                  <Icon name="clock" className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-[13px]">No hay cambios de precio registrados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {priceHistory.slice(0, 10).map((entry, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-[#F2F2F5] last:border-b-0">
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="text-[#6B7280]">{entry.old_price?.toFixed(2) || '0.00'} EUR</span>
                        <Icon name="arrowRight" className="w-3 h-3 text-[#9CA3AF]" />
                        <span className="font-semibold text-[#1A1A1A]">{entry.new_price?.toFixed(2) || '0.00'} EUR</span>
                      </div>
                      <span className="text-[11px] text-[#9CA3AF]">
                        {entry.created_at ? new Date(entry.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
