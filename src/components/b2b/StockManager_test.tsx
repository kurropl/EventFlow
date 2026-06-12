     1|'use client';
     2|
     3|import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
     4|import Icon from '../shared/Icon';
     5|
     6|/* ------------------------------------------------------------------ */
     7|/*  Types                                                              */
     8|/* ------------------------------------------------------------------ */
     9|
    10|interface Ingredient {
    11|  id: string;
    12|  name: string;
    13|  unit: string;
    14|  quantity: number;
    15|  min_stock: number;
    16|  cost_per_unit: number;
    17|  supplier: string;
    18|  active: boolean;
    19|  low_stock?: boolean;
    20|  last_restocked?: string;
    21|}
    22|
    23|interface Provider {
    24|  id: string;
    25|  name: string;
    26|  category: string;
    27|  contact_name: string;
    28|  phone: string;
    29|  email: string;
    30|}
    31|
    32|interface EventOption {
    33|  id: string;
    34|  client_name: string;
    35|  event_date: string;
    36|  status: string;
    37|}
    38|
    39|interface ShoppingItem {
    40|  id: string;
    41|  ingredient_name: string;
    42|  total_grams: number;
    43|  total_units: number;
    44|  total_ml: number;
    45|  provider_name: string;
    46|  completed: boolean;
    47|}
    48|
    49|interface Escandallo {
    50|  event_id: string;
    51|  event_name: string;
    52|  items: ShoppingItem[];
    53|}
    54|
    55|type Tab = 'stock' | 'escandallos' | 'pedidos';
    56|
    57|/* ------------------------------------------------------------------ */
    58|/*  Helpers                                                            */
    59|/* ------------------------------------------------------------------ */
    60|
    61|function stockStatus(qty: number, min: number): { label: string; icon: string; color: string; bg: string } {
    62|  if (qty === 0) return { label: 'Agotado', icon: 'circleX', color: 'text-[#DC2626]', bg: 'bg-[#FEF3F3]' };
    63|  if (qty <= min) return { label: 'Bajo', icon: 'alertTriangle', color: 'text-[#D97706]', bg: 'bg-[#FFF8EC]' };
    64|  return { label: 'OK', icon: 'check', color: 'text-[#16A34A]', bg: 'bg-[#EFFAF2]' };
    65|}
    66|
    67|function formatQty(value: number, unit: string): string {
    68|  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} ${unit}`;
    69|}
    70|
    71|/* ── Inline-editable provider row ──────────────────────────────── */
    72|function ProviderRow({ p, ingredients, setProviders }: {
    73|  p: Provider;
    74|  ingredients: { supplier: string }[];
    75|  setProviders: React.Dispatch<React.SetStateAction<Provider[]>>;
    76|}) {
    77|  const [editing, setEditing] = useState<string | null>(null);
    78|  const [draft, setDraft] = useState<Record<string, string>>({});
    79|  const [saving, setSaving] = useState(false);
    80|  const ingredientCount = ingredients.filter((i) => i.supplier === p.name).length;
    81|
    82|  const saveField = async (field: string) => {
    83|    setSaving(true);
    84|    try {
    85|      await fetch(`/api/providers/${p.id}`, {
    86|        method: 'PATCH',
    87|        headers: { 'Content-Type': 'application/json' },
    88|        body: JSON.stringify({ [field]: draft[field] || null }),
    89|      });
    90|      setProviders((prev: any[]) => prev.map((x: any) => x.id === p.id ? { ...x, [field]: draft[field] || null } : x));
    91|    } catch {}
    92|    setEditing(null);
    93|    setSaving(false);
    94|  };
    95|
    96|  const Cell = ({ field, value }: { field: string; value: string | null }) => {
    97|    if (editing === field) {
    98|      return (
    99|        <input
   100|          autoFocus
   101|          value={draft[field] || ''}
   102|          onChange={(e) => setDraft(d => ({ ...d, [field]: e.target.value }))}
   103|          onBlur={() => saveField(field)}
   104|          onKeyDown={(e) => { if (e.key === 'Enter') saveField(field); if (e.key === 'Escape') setEditing(null); }}
   105|          disabled={saving}
   106|          className="w-full px-2 py-1 text-[13px] border border-[#C9A84C] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#C9A84C]"
   107|        />
   108|      );
   109|    }
   110|    return (
   111|      <span
   112|        className="cursor-pointer hover:bg-[#FBF6E9] px-2 py-1 rounded-lg transition-colors text-[#6B7280] text-[13px]"
   113|        title={value || 'Click para editar'}
   114|        onClick={() => { setEditing(field); setDraft({ [field]: value || '' }); }}
   115|      >
   116|        {value || <span className="text-[#C9A84C] italic text-[12px]">+ anadir</span>}
   117|      </span>
   118|    );
   119|  };
   120|
   121|  return (
   122|    <tr className="border-b border-[#F2F2F5] hover:bg-[#FAFCFE] transition-colors">
   123|      <td className="px-4 py-2.5 text-[#1A1A1A] text-[13px] font-medium max-w-[200px] truncate" title={p.name}>{p.name}</td>
   124|      <td className="px-4 py-2.5">
   125|        <span className="text-[10px] bg-[#F5F5F8] text-[#6B7280] px-2 py-0.5 rounded-full">{p.category}</span>
   126|      </td>
   127|      <td className="px-4 py-2.5"><Cell field="contact_name" value={p.contact_name} /></td>
   128|      <td className="px-4 py-2.5"><Cell field="phone" value={p.phone} /></td>
   129|      <td className="px-4 py-2.5"><Cell field="email" value={p.email} /></td>
   130|      <td className="px-4 py-2.5 text-center">
   131|        <span className="inline-flex items-center justify-center min-w-[24px] h-6 rounded-full bg-[#FBF6E9] text-[#C9A84C] text-xs font-semibold">{ingredientCount}</span>
   132|      </td>
   133|    </tr>
   134|  );
   135|}
   136|
   137|/* ------------------------------------------------------------------ */
   138|/*  Component                                                          */
   139|/* ------------------------------------------------------------------ */
   140|
   141|export default function StockManager() {
   142|  const [activeTab, setActiveTab] = useState<Tab>('stock');
   143|
   144|  // Stock state
   145|  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
   146|  const [loading, setLoading] = useState(true);
   147|  const [search, setSearch] = useState('');
   148|  const [filterProvider, setFilterProvider] = useState('all');
   149|  const [editingId, setEditingId] = useState<string | null>(null);
   150|  const [editData, setEditData] = useState({ quantity: '', min_stock: '', cost_per_unit: '' });
   151|  const [saving, setSaving] = useState(false);
   152|  const [restockId, setRestockId] = useState<string | null>(null);
   153|  const [restockQty, setRestockQty] = useState('');
   154|
   155|  // Escandallos state
   156|  const [events, setEvents] = useState<EventOption[]>([]);
   157|  const [selectedEvent, setSelectedEvent] = useState('');
   158|  const [escandallo, setEscandallo] = useState<Escandallo | null>(null);
   159|  const [loadingEscandallo, setLoadingEscandallo] = useState(false);
   160|  const [editingEscandalloId, setEditingEscandalloId] = useState<string | null>(null);
   161|  const [escandalloEditData, setEscandalloEditData] = useState<{ total_grams: string; total_units: string; total_ml: string }>({ total_grams: '', total_units: '', total_ml: '' });
   162|  const [savingEscandallo, setSavingEscandallo] = useState(false);
   163|
   164|  // Supplier orders state
   165|  const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
   166|  const [loadingOrders, setLoadingOrders] = useState(false);
   167|  const [showNewOrder, setShowNewOrder] = useState(false);
   168|  const [newOrder, setNewOrder] = useState({ supplier: '', notes: '', expected_date: '', items: [] as any[] });
   169|
   170|  // Stock check state
   171|  const [stockCheckLoading, setStockCheckLoading] = useState(false);
   172|  const [stockShortages, setStockShortages] = useState<Array<{ ingredient_name: string; needed: number; available: number; unit: string; metric: string }>>([]);
   173|
   174|  // Proveedores state
   175|  const [providers, setProviders] = useState<Provider[]>([]);
   176|  const [loadingProviders, setLoadingProviders] = useState(true);
   177|  const providersRef = useRef<HTMLDivElement>(null);
   178|
   179|  // Add ingredient form state
   180|  const [showAddIngredient, setShowAddIngredient] = useState(false);
   181|  const [newItem, setNewItem] = useState({ name: '', unit: 'kg', quantity: '', min_stock: '', cost_per_unit: '', supplier: '' });
   182|  const [savingNewItem, setSavingNewItem] = useState(false);
   183|
   184|  // Add provider form state
   185|  const [showAddProvider, setShowAddProvider] = useState(false);
   186|  const [newProvider, setNewProvider] = useState({ name: '', category: '' });
   187|  const [savingNewProvider, setSavingNewProvider] = useState(false);
   188|
   189|  // Auto-scroll to providers if URL has #proveedores
   190|  useEffect(() => {
   191|    if (typeof window !== 'undefined' && window.location.hash === '#proveedores') {
   192|      setActiveTab('stock');
   193|      setTimeout(() => providersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300);
   194|    }
   195|  }, []);
   196|
   197|  /* ---------------------------------------------------------------- */
   198|  /*  Data loading                                                     */
   199|  /* ---------------------------------------------------------------- */
   200|
   201|  const loadStock = useCallback(async () => {
   202|    try {
   203|      setLoading(true);
   204|      const res = await fetch('/api/stock');
   205|      const data = await res.json();
   206|      if (data.success) setIngredients(data.data || []);
   207|    } catch { /* ignore */ }
   208|    finally { setLoading(false); }
   209|  }, []);
   210|
   211|  const loadEvents = useCallback(async () => {
   212|    try {
   213|      const res = await fetch('/api/events?limit=200');
   214|      const data = await res.json();
   215|      if (data.success) setEvents(data.data || []);
   216|    } catch { /* ignore */ }
   217|  }, []);
   218|
   219|  const loadProviders = useCallback(async () => {
   220|    try {
   221|      setLoadingProviders(true);
   222|      const res = await fetch('/api/providers');
   223|      const data = await res.json();
   224|      if (data.success) setProviders(data.data || []);
   225|    } catch { /* ignore */ }
   226|    finally { setLoadingProviders(false); }
   227|  }, []);
   228|
   229|  const loadOrders = useCallback(async () => {
   230|    setLoadingOrders(true);
   231|    try {
   232|      const res = await fetch('/api/stock/supplier-orders');
   233|      const data = await res.json();
   234|      if (data.success) setSupplierOrders(data.data || []);
   235|    } catch { /* ignore */ }
   236|    setLoadingOrders(false);
   237|  }, []);
   238|
   239|  const loadEscandallo = useCallback(async (eventId: string) => {
   240|    if (!eventId) { setEscandallo(null); return; }
   241|    setLoadingEscandallo(true);
   242|    try {
   243|      const res = await fetch(`/api/stock/escandallos?event_id=${eventId}`);
   244|      const data = await res.json();
   245|      if (res.ok && data.success && data.data) {
   246|        const group = data.data[eventId];
   247|        if (group) {
   248|          setEscandallo({ event_id: eventId, event_name: group.event_name, items: group.items || [] });
   249|        } else {
   250|          setEscandallo(null);
   251|        }
   252|      }
   253|    } catch { /* ignore */ }
   254|    finally { setLoadingEscandallo(false); }
   255|  }, []);
   256|
   257|  useEffect(() => {
   258|    if (activeTab === 'stock') { loadStock(); loadProviders(); }
   259|    if (activeTab === 'escandallos' && events.length === 0) loadEvents();
   260|    if (activeTab === 'pedidos') loadOrders();
   261|  }, [activeTab, loadStock, loadProviders, loadEvents, loadOrders, events.length]);
   262|
   263|  useEffect(() => {
   264|    if (selectedEvent) loadEscandallo(selectedEvent);
   265|  }, [selectedEvent, loadEscandallo]);
   266|
   267|  /* ---------------------------------------------------------------- */
   268|  /*  Derived data                                                     */
   269|  /* ---------------------------------------------------------------- */
   270|
   271|  const providerNames = useMemo(() => {
   272|    const set = new Set(ingredients.map((i) => i.supplier).filter(Boolean));
   273|    return Array.from(set).sort();
   274|  }, [ingredients]);
   275|
   276|  const filteredIngredients = useMemo(() => {
   277|    return ingredients.filter((item) => {
   278|      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
   279|      const matchProvider = filterProvider === 'all' || item.supplier === filterProvider;
   280|      return matchSearch && matchProvider;
   281|    });
   282|  }, [ingredients, search, filterProvider]);
   283|
   284|  const lowStockCount = useMemo(
   285|    () => ingredients.filter((i) => i.quantity > 0 && i.quantity <= i.min_stock).length,
   286|    [ingredients]
   287|  );
   288|  const outOfStockCount = useMemo(
   289|    () => ingredients.filter((i) => i.quantity === 0).length,
   290|    [ingredients]
   291|  );
   292|
   293|  const groupedItems = useMemo(() => {
   294|    if (!escandallo) return [];
   295|    const groups: Record<string, { provider: string; items: ShoppingItem[] }> = {};
   296|    for (const item of escandallo.items) {
   297|      const key = item.provider_name || 'Sin proveedor';
   298|      if (!groups[key]) groups[key] = { provider: key, items: [] };
   299|      groups[key].items.push(item);
   300|    }
   301|    return Object.values(groups);
   302|  }, [escandallo]);
   303|
   304|  const escandalloTotal = useMemo(() => {
   305|    if (!escandallo) return { count: 0, totalQty: 0, totalGrams: 0, totalUnits: 0, totalMl: 0 };
   306|    return {
   307|      count: escandallo.items.length,
   308|      totalQty: escandallo.items.reduce((s, i) => s + (i.total_grams || 0) + (i.total_units || 0) + (i.total_ml || 0), 0),
   309|      totalGrams: escandallo.items.reduce((s, i) => s + (i.total_grams || 0), 0),
   310|      totalUnits: escandallo.items.reduce((s, i) => s + (i.total_units || 0), 0),
   311|      totalMl: escandallo.items.reduce((s, i) => s + (i.total_ml || 0), 0),
   312|    };
   313|  }, [escandallo]);
   314|
   315|  /* ---------------------------------------------------------------- */
   316|  /*  Actions                                                          */
   317|  /* ---------------------------------------------------------------- */
   318|
   319|  const startEdit = (item: Ingredient) => {
   320|    setEditingId(item.id);
   321|    setEditData({ quantity: String(item.quantity), min_stock: String(item.min_stock), cost_per_unit: String(item.cost_per_unit) });
   322|  };
   323|
   324|  const handleRestock = async (id: string) => {
   325|    const qty = parseFloat(restockQty);
   326|    if (!qty || qty <= 0) return;
   327|    try {
   328|      const item = ingredients.find((i) => i.id === id);
   329|      if (!item) return;
   330|      const newQty = item.quantity + qty;
   331|      await fetch('/api/stock', {
   332|        method: 'PUT',
   333|        headers: { 'Content-Type': 'application/json' },
   334|        body: JSON.stringify({ id, quantity: newQty, last_restocked: new Date().toISOString() }),
   335|      });
   336|      setRestockId(null);
   337|      setRestockQty('');
   338|      await loadStock();
   339|    } catch { /* ignore */ }
   340|  };
   341|
   342|  const saveEdit = async () => {
   343|    if (!editingId || saving) return;
   344|    setSaving(true);
   345|    try {
   346|      const res = await fetch('/api/stock', {
   347|        method: 'PUT',
   348|        headers: { 'Content-Type': 'application/json' },
   349|        body: JSON.stringify({
   350|          id: editingId,
   351|          quantity: parseFloat(editData.quantity) || 0,
   352|          min_stock: parseFloat(editData.min_stock) || 0,
   353|          cost_per_unit: parseFloat(editData.cost_per_unit) || 0,
   354|        }),
   355|      });
   356|      if (res.ok) {
   357|        setEditingId(null);
   358|        await loadStock();
   359|      }
   360|    } catch { /* ignore */ }
   361|    finally { setSaving(false); }
   362|  };
   363|
   364|  const handleAddIngredient = async () => {
   365|    if (!newItem.name) return;
   366|    setSavingNewItem(true);
   367|    try {
   368|      const res = await fetch('/api/stock', {
   369|        method: 'POST',
   370|        headers: { 'Content-Type': 'application/json' },
   371|        body: JSON.stringify({
   372|          name: newItem.name,
   373|          unit: newItem.unit,
   374|          quantity: parseFloat(newItem.quantity) || 0,
   375|          min_stock: parseFloat(newItem.min_stock) || 0,
   376|          cost_per_unit: parseFloat(newItem.cost_per_unit) || 0,
   377|          supplier: newItem.supplier || '',
   378|        }),
   379|      });
   380|      if (res.ok) {
   381|        setShowAddIngredient(false);
   382|        setNewItem({ name: '', unit: 'kg', quantity: '', min_stock: '', cost_per_unit: '', supplier: '' });
   383|        await loadStock();
   384|      }
   385|    } catch { /* ignore */ }
   386|    finally { setSavingNewItem(false); }
   387|  };
   388|
   389|  const handleAddProvider = async () => {
   390|    if (!newProvider.name) return;
   391|    setSavingNewProvider(true);
   392|    try {
   393|      const res = await fetch('/api/providers', {
   394|        method: 'POST',
   395|        headers: { 'Content-Type': 'application/json' },
   396|        body: JSON.stringify({ name: newProvider.name, category: newProvider.category }),
   397|      });
   398|      if (res.ok) {
   399|        setShowAddProvider(false);
   400|        setNewProvider({ name: '', category: '' });
   401|        await loadProviders();
   402|      }
   403|    } catch { /* ignore */ }
   404|    finally { setSavingNewProvider(false); }
   405|  };
   406|
   407|  /* ---------------------------------------------------------------- */
   408|  /*  Escandallo actions                                               */
   409|  /* ---------------------------------------------------------------- */
   410|
   411|  const startEscandalloEdit = (item: ShoppingItem) => {
   412|    setEditingEscandalloId(item.id);
   413|    setEscandalloEditData({
   414|      total_grams: String(item.total_grams ?? 0),
   415|      total_units: String(item.total_units ?? 0),
   416|      total_ml: String(item.total_ml ?? 0),
   417|    });
   418|  };
   419|
   420|  const saveEscandalloEdit = async () => {
   421|    if (!editingEscandalloId || savingEscandallo) return;
   422|    setSavingEscandallo(true);
   423|    try {
   424|      const res = await fetch('/api/stock/escandallos', {
   425|        method: 'PUT',
   426|        headers: { 'Content-Type': 'application/json' },
   427|        body: JSON.stringify({
   428|          id: editingEscandalloId,
   429|          total_grams: parseFloat(escandalloEditData.total_grams) || 0,
   430|          total_units: parseFloat(escandalloEditData.total_units) || 0,
   431|          total_ml: parseFloat(escandalloEditData.total_ml) || 0,
   432|        }),
   433|      });
   434|      if (res.ok) {
   435|        setEditingEscandalloId(null);
   436|        if (selectedEvent) await loadEscandallo(selectedEvent);
   437|      }
   438|    } catch { /* ignore */ }
   439|    finally { setSavingEscandallo(false); }
   440|  };
   441|
   442|  const checkStock = async () => {
   443|    if (!selectedEvent) return;
   444|    setStockCheckLoading(true);
   445|    setStockShortages([]);
   446|    try {
   447|      const res = await fetch(`/api/stock/check?event_id=${selectedEvent}`);
   448|      const data = await res.json();
   449|      if (res.ok && data.success && data.data) {
   450|        setStockShortages(data.data.shortages || []);
   451|      }
   452|    } catch { /* ignore */ }
   453|    finally { setStockCheckLoading(false); }
   454|  };
   455|
   456|  /* ---------------------------------------------------------------- */
   457|  /*  Shared styles                                                    */
   458|  /* ---------------------------------------------------------------- */
   459|
   460|  const selectCls = 'px-3 py-2.5 rounded-xl bg-white border border-[#E5E5EC] text-[#1A1A1A] text-sm focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 focus:outline-none transition-all';
   461|
   462|  /* ---------------------------------------------------------------- */
   463|  /*  Render                                                           */
   464|  /* ---------------------------------------------------------------- */
   465|
   466|  return (
   467|    <div className="space-y-6">
   468|      {/* Header */}
   469|      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
   470|        <div>
   471|          <h2 className="text-xl font-semibold text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
   472|            Stock & Proveedores
   473|          </h2>
   474|          <p className="text-sm text-[#6B7280] mt-1">
   475|            Gestión de almacén, ingredientes y proveedores del salon
   476|            {activeTab === 'stock' && (lowStockCount + outOfStockCount) > 0 && (
   477|              <span className="ml-2 inline-flex items-center gap-1 text-[#D97706] font-medium">
   478|                <Icon name="alertTriangle" className="w-3.5 h-3.5" />
   479|                {lowStockCount + outOfStockCount} alerta{lowStockCount + outOfStockCount > 1 ? 's' : ''}
   480|              </span>
   481|            )}
   482|          </p>
   483|        </div>
   484|      </div>
   485|
   486|      {/* KPI Summary Cards */}
   487|      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
   488|        <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-[#ECECF1] shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
   489|          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#F3F4F6]">
   490|            <Icon name="package" className="w-5 h-5 text-[#6B7280]" />
   491|          </div>
   492|          <div>
   493|            <span className="block text-[20px] font-bold text-[#1A1A1A] tabular-nums">
   494|              {ingredients.length}
   495|            </span>
   496|            <span className="block text-[11px] text-[#9CA3AF] uppercase tracking-wider font-medium">Total ingredientes</span>
   497|          </div>
   498|        </div>
   499|        <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border border-[#ECECF1] shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
   500|          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-[#FEF3C7]">
   501|