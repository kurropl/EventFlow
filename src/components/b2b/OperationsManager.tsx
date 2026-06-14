'use client';
/**
 * EventFlow — Operations Manager
 * Lista + detalle con mapa de mesas SVG drag & drop nativo en React.
 * Sin iframes, sin librerías externas de canvas.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/shared/Icon';
import EventStaffingPanel from '@/components/b2b/EventStaffingPanel';
import { PageHeader, StatStrip, DataCard, DataList } from '@/components/ui';

// ── Status Map (Spanish labels + color variants) ──────────────
const STATUS_MAP: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  draft:      { label: 'Borrador',   variant: 'neutral' },
  sent:       { label: 'Enviado',    variant: 'info' },
  accepted:   { label: 'Aceptado',   variant: 'success' },
  in_progress:{ label: 'En curso',   variant: 'info' },
  completed:  { label: 'Completado', variant: 'success' },
  cancelled:  { label: 'Cancelado',  variant: 'danger' },
  paid:       { label: 'Pagado',     variant: 'success' },
  lost:       { label: 'Perdido',    variant: 'danger' },
  pending:    { label: 'Pendiente',  variant: 'warning' },
  confirmed:  { label: 'Confirmado', variant: 'success' },
  won:        { label: 'Ganado',     variant: 'warning' },
};

// ── Types ──────────────────────────────────────────────────────
interface EventOrder {
  id: string; event_id: string; client_name: string; client_email: string;
  event_type: string; guest_count: number; kids_count: number;
  event_date: string; status: string;
  confirmed_price: number; final_price: number;
  tables_suggested: number; tables_confirmed: number;
  waiters_suggested: number; waiters_confirmed: number;
  extra_consumptions: any[]; shopping_list: any[];
  selected_items: any[];
  client_token?: string;
}
interface ShoppingItem {
  ingredient_name: string; total_grams: number; total_units: number; total_ml: number;
  provider_name?: string;
}
interface CanvasTable {
  id: string; name: string; x: number; y: number;
  width: number; height: number; rotation: number;
  capacity: number; shape: 'round' | 'rect' | 'long';
  color: string; waiter: string;
}
interface Waiter { id: string; name: string; role: string; }
interface DragState { tableId: string; clientX: number; clientY: number; origX: number; origY: number; }

// ── Constants ──────────────────────────────────────────────────
const CANVAS_W = 1200, CANVAS_H = 800, GRID = 20;
const WAITER_COLORS = ['#C9A84C','#4682B4','#6B8E23','#9370DB','#CD5C5C','#20B2AA','#D2691E','#B8860B'];

const money = (n: number | string) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
};
const snap = (v: number) => Math.round(v / GRID) * GRID;

// ── Component ──────────────────────────────────────────────────
export default function OperationsManager() {
  const router = useRouter();
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventOrder | null>(null);
  const [viewMode, setViewMode] = useState<'detail' | 'map'>('detail');
  const [tablesManual, setTablesManual] = useState(0);
  const [waitersManual, setWaitersManual] = useState(0);
  const [extraItems, setExtraItems] = useState<{ desc: string; amount: number }[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [showBudget, setShowBudget] = useState(false);

  // Map state
  const [tables, setTables] = useState<CanvasTable[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loadingDist, setLoadingDist] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [waiterColors, setWaiterColors] = useState<Record<string, string>>({});
  const [showWaitersModal, setShowWaitersModal] = useState(false);
  const [editingWaiter, setEditingWaiter] = useState<string | null>(null);
  const [newWaiterName, setNewWaiterName] = useState('');
  const [showWaitersSaved, setShowWaitersSaved] = useState(false);
  const [decorLinen, setDecorLinen] = useState('blanco');
  const [decorCenterpiece, setDecorCenterpiece] = useState('floral');
  const [shoppingItems, setShoppingItems] = useState<any[]>([]);
  const [newIngName, setNewIngName] = useState('');
  const [newIngProvider, setNewIngProvider] = useState('');
  const [newIngGrams, setNewIngGrams] = useState(0);
  const [newIngUnits, setNewIngUnits] = useState(0);
  const [newIngMl, setNewIngMl] = useState(0);
  const [decorSaving, setDecorSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/event-orders'); const j = await r.json(); setOrders(j.data || []); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrder = async (id: string, data: any) => {
    await fetch(`/api/event-orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    fetchOrders();
  };

  const handleComplete = async () => {
    if (!selected) return;
    const extras = extraItems.filter(e => e.desc && e.amount > 0);
    await updateOrder(selected.id, {
      status: 'completed',
      tables_confirmed: tablesManual || selected.tables_suggested,
      waiters_confirmed: waitersManual || selected.waiters_suggested,
      extra_consumptions: extras,
    });
    setShowComplete(false);
    setSelected(null);
  };

  const [copiedLink, setCopiedLink] = useState(false);

  const copyClientLink = () => {
    if (!selected?.client_token) return;
    const url = `${window.location.origin}/invitados/${selected.client_token}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSelectOrder = (o: EventOrder) => {
    setSelected(o);
    setViewMode('detail');
    setWaitersManual(o.waiters_confirmed || o.waiters_suggested);
    setExtraItems(o.extra_consumptions?.length ? o.extra_consumptions : [{ desc: '', amount: 0 }]);
    setViewMode('detail');
    loadTables(o);
    // Load decoration settings from events table
    if (o.event_id) {
      fetch(`/api/events/${o.event_id}`).then(r => r.json()).then(d => {
        if (d.success && d.data) {
          setDecorLinen(d.data.linen_type || 'blanco');
          setDecorCenterpiece(d.data.centerpiece || 'floral');
        }
      }).catch(() => {});
      fetchShopping(o.event_id);
    }
  };
  // ── Load tables from API or generate ────────────────────────
  const loadTables = async (order: EventOrder) => {
    setLoadingDist(true);
    try {
      // Load ALL waiters from API
      let wList: Waiter[] = [];
      try {
        const wr = await fetch('/api/waiters');
        const wd = await wr.json();
        if (wd.success) wList = wd.waiters || [];
      } catch { /* fallback to event-specific */
        try {
          const wr = await fetch(`/api/event-orders/${order.id}/waiters`);
          const wd = await wr.json();
          if (wd.success) wList = wd.waiters || [];
        } catch { /* ok */ }
      }
      setWaiters(wList);
      const colors: Record<string, string> = {};
      wList.forEach((w, i) => { colors[w.name] = WAITER_COLORS[i % WAITER_COLORS.length]; });
      setWaiterColors(colors);

      // Load saved plan or generate
      const params = new URLSearchParams();
      if (order.event_id) params.set('event_id', order.event_id);
      const r = await fetch(`/api/floor-plan?${params}`);
      const data = await r.json();

      let finalTables: CanvasTable[] = [];

      if (data.success && data.data && data.data.length > 0) {
        finalTables = data.data.map((t: any) => ({ ...t, waiter: t.waiter || '' }));
      } else if (order.guest_count > 0) {
        const gen = await fetch('/api/floor-plan/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestCount: order.guest_count, tablesSuggested: order.tables_suggested, kidsCount: order.kids_count }),
        });
        const gd = await gen.json();
        if (gd.success) {
          finalTables = gd.data.map((t: any) => ({ ...t, waiter: '' }));
        }
      }

      // Auto-create waiters if needed: 1 per 3 tables
      const tableCount = finalTables.length;
      const waiterCount = wList.length;
      const neededWaiters = Math.max(1, Math.ceil(tableCount / 3));

      if (waiterCount < neededWaiters) {
        // Create missing waiters
        const missing = neededWaiters - waiterCount;
        const newWaiters: Waiter[] = [];
        for (let i = 0; i < missing; i++) {
          const id = `w${Date.now() + i}`;
          const name = `Camarero ${waiterCount + i + 1}`;
          const color = WAITER_COLORS[(waiterCount + i) % WAITER_COLORS.length];
          newWaiters.push({ id, name, role: 'camarero' });
          colors[name] = color;
        }
        setWaiters(prev => [...prev, ...newWaiters]);
        wList = [...wList, ...newWaiters];
      }

      // Round-robin assign: 1 waiter per 3 tables
      if (finalTables.length > 0 && wList.length > 0) {
        const tablesPerWaiter = Math.max(1, Math.ceil(finalTables.length / wList.length));
        finalTables.forEach((t, i) => {
          if (!t.waiter) {
            t.waiter = wList[Math.floor(i / tablesPerWaiter) % wList.length].name;
          }
        });
      }

      setWaiterColors(colors);
      setTables(finalTables);
    } catch { /* fallback */ }
    setLoadingDist(false);
  };

  const saveLayout = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const params = new URLSearchParams();
      if (selected.event_id) params.set('event_id', selected.event_id);
      await fetch(`/api/floor-plan?${params}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables }),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  // ── Map interactions (pointer events for reliable drag) ──────
  const handlePointerDownTable = useCallback((e: React.PointerEvent, tid: string) => {
    if (e.button !== 0) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.stopPropagation();
    const t = tables.find(x => x.id === tid);
    if (!t) return;
    setSelectedTable(tid);
    setDrag({ tableId: tid, clientX: e.clientX, clientY: e.clientY, origX: t.x, origY: t.y });
  }, [tables]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drag) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dx = (e.clientX - drag.clientX) / (rect.width / CANVAS_W);
    const dy = (e.clientY - drag.clientY) / (rect.height / CANVAS_H);
    setTables(prev => prev.map(t => t.id === drag.tableId ? { ...t, x: snap(drag.origX + dx), y: snap(drag.origY + dy) } : t));
  }, [drag]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    setDrag(null);
  }, []);

  const updateTableField = useCallback((tid: string, field: string, value: any) => {
    setTables(prev => prev.map(t => t.id === tid ? { ...t, [field]: value } : t));
  }, []);

  const rotateTable = useCallback((tid: string) => {
    setTables(prev => prev.map(t => t.id === tid ? { ...t, width: t.height, height: t.width, rotation: (t.rotation + 90) % 360 } : t));
  }, []);

  const deleteTable = useCallback((tid: string) => {
    setTables(prev => prev.filter(t => t.id !== tid));
    setSelectedTable(null);
  }, []);

  const addTable = useCallback(() => {
    const maxNum = tables.reduce((mx, t) => {
      const m = t.name.match(/\d+/); return m ? Math.max(mx, parseInt(m[0], 10)) : mx;
    }, 0);
    const maxId = tables.reduce((mx, t) => {
      const n = parseInt(t.id.replace(/\D/g, ''), 10); return isNaN(n) ? mx : Math.max(mx, n);
    }, 0);
    const newId = `t${maxId + 1}`;
    const cx = CANVAS_W / 2 - 30, cy = CANVAS_H / 2 - 30;
    setTables(prev => [...prev, {
      id: newId, name: `Mesa ${maxNum + 1}`, x: snap(cx), y: snap(cy),
      width: 80, height: 80, rotation: 0, capacity: 8, shape: 'round',
      color: '#4682B4', waiter: waiters.length > 0 ? waiters[prev.length % waiters.length].name : '',
    }]);
    setSelectedTable(newId);
  }, [tables, waiters]);

  const selectedTableData = useMemo(() => tables.find(t => t.id === selectedTable) || null, [tables, selectedTable]);

  // ── Waiter management ────────────────────────────────────────
  const renameWaiter = (oldName: string, newName: string) => {
    if (!newName.trim()) return;
    setWaiters(prev => prev.map(w => w.name === oldName ? { ...w, name: newName.trim() } : w));
    setTables(prev => prev.map(t => t.waiter === oldName ? { ...t, waiter: newName.trim() } : t));
    setEditingWaiter(null);
  };

  const deleteWaiter = (name: string) => {
    setWaiters(prev => prev.filter(w => w.name !== name));
    setTables(prev => prev.map(t => t.waiter === name ? { ...t, waiter: '' } : t));
    setWaiterColors(prev => { const c = { ...prev }; delete c[name]; return c; });
  };

  const addWaiter = () => {
    if (!newWaiterName.trim()) return;
    const id = `w${Date.now()}`;
    const color = WAITER_COLORS[waiters.length % WAITER_COLORS.length];
    setWaiters(prev => [...prev, { id, name: newWaiterName.trim(), role: 'camarero' }]);
    setWaiterColors(prev => ({ ...prev, [newWaiterName.trim()]: color }));
    setNewWaiterName('');
  };

  // Auto-reparto: 1 camarero cada 3 mesas (round-robin)
  const autoAssignWaiters = () => {
    if (waiters.length === 0 || tables.length === 0) return;
    setTables(prev => prev.map((t, i) => ({ ...t, waiter: waiters[i % waiters.length].name })));
  };

  // Save decoration settings to events table
  const saveDecoration = async (field: 'linen_type' | 'centerpiece', value: string) => {
    if (!selected?.event_id) return;
    setDecorSaving(true);
    try {
      await fetch(`/api/events/${selected.event_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (field === 'linen_type') setDecorLinen(value);
      if (field === 'centerpiece') setDecorCenterpiece(value);
    } catch (e) { console.error(e); }
    setDecorSaving(false);
  };

  // Reassign a single table's waiter
  const assignTableWaiter = (tableId: string, waiterName: string) => {
    setTables(prev => prev.map(t => t.id === tableId ? { ...t, waiter: waiterName } : t));
  };

  // Move table from one waiter to another (bulk)
  const moveWaiterTables = (fromWaiter: string, toWaiter: string) => {
    setTables(prev => prev.map(t => t.waiter === fromWaiter ? { ...t, waiter: toWaiter } : t));
  };

  // ── SVG: render a single table ───────────────────────────────
  const renderTableShape = (t: CanvasTable) => {
    const isSelected = t.id === selectedTable;
    const wColor = t.waiter && waiterColors[t.waiter] ? waiterColors[t.waiter] : null;
    const strokeColor = isSelected ? '#6B2737' : (wColor || t.color);
    const strokeWidth = isSelected ? 3 : 1.5;

    if (t.shape === 'round') {
      const r = Math.min(t.width, t.height) / 2;
      return (
        <g>
          <circle cx={t.width / 2} cy={t.height / 2} r={r - 2}
            fill={t.color} stroke={strokeColor} strokeWidth={strokeWidth} opacity={0.9} />
          {isSelected && <circle cx={t.width / 2} cy={t.height / 2} r={r + 2}
            fill="none" stroke="#6B2737" strokeWidth={1} strokeDasharray="4 2" />}
          <text x={t.width / 2} y={t.height / 2 - 4} textAnchor="middle"
            fill="white" fontSize={11} fontWeight={600}>{t.name}</text>
          <text x={t.width / 2} y={t.height / 2 + 10} textAnchor="middle"
            fill="rgba(255,255,255,0.8)" fontSize={9}>{t.capacity} pax</text>
          {t.waiter && <text x={t.width / 2} y={t.height / 2 + 22} textAnchor="middle"
            fill="#FFF8DC" fontSize={8}>{t.waiter.split(' ')[0]}</text>}
        </g>
      );
    }
    const rx = t.shape === 'long' ? 4 : 6;
    return (
      <g>
        <rect x={2} y={2} width={t.width - 4} height={t.height - 4} rx={rx}
          fill={t.color} stroke={strokeColor} strokeWidth={strokeWidth} opacity={0.9} />
        {isSelected && <rect x={0} y={0} width={t.width} height={t.height} rx={rx + 2}
          fill="none" stroke="#6B2737" strokeWidth={1} strokeDasharray="4 2" />}
        <text x={t.width / 2} y={t.height / 2 - 4} textAnchor="middle"
          fill="white" fontSize={11} fontWeight={600}>{t.name}</text>
        <text x={t.width / 2} y={t.height / 2 + 10} textAnchor="middle"
          fill="rgba(255,255,255,0.8)" fontSize={9}>{t.capacity} pax</text>
        {t.waiter && <text x={t.width / 2} y={t.height / 2 + 22} textAnchor="middle"
          fill="#FFF8DC" fontSize={8}>{t.waiter.split(' ')[0]}</text>}
      </g>
    );
  };

  // ── List View ────────────────────────────────────────────────
  const renderList = () => (
    <div className="space-y-5">
      <PageHeader
        title="Operaciones"
        subtitle="Eventos activos, escandallos y logística"
        actions={
          <button onClick={fetchOrders} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
            <Icon name="refresh" className="w-3.5 h-3.5"/>
          </button>
        }
        stats={orders.length > 0 ? (
          <StatStrip items={[
            { label: 'En curso', value: orders.filter(o => o.status === 'in_progress').length, accent: true },
            { label: 'Completados', value: orders.filter(o => o.status === 'completed').length },
            { label: 'Total pax', value: orders.reduce((s, o) => s + (o.guest_count || 0), 0) },
          ]} />
        ) : undefined}
      />
      <DataList loading={loading} count={orders.length} emptyTitle="No hay órdenes de evento activas.">
        {orders.map(o => (
          <DataCard
            key={o.id}
            onClick={() => handleSelectOrder(o)}
            avatar={{
              initials: o.client_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
              color: 'linear-gradient(135deg, #C9A84C, #A88A3A)',
            }}
            title={o.client_name}
            subtitle={o.client_email}
            badges={[{
              label: STATUS_MAP[o.status]?.label || o.status,
              variant: STATUS_MAP[o.status]?.variant || 'neutral',
            }]}
            meta={[
              { label: 'Evento', value: o.event_type + ' · ' + fmtDate(o.event_date) },
              { label: 'Pax', value: String(o.guest_count) },
              { label: 'Mesas', value: (o.tables_confirmed || 0) + '/' + (o.tables_suggested ?? '—') },
              { label: 'Camareros', value: (o.waiters_confirmed || 0) + '/' + (o.waiters_suggested ?? '—') },
              { label: 'Total', value: money(o.confirmed_price) },
            ]}
          />
        ))}
      </DataList>
    </div>
  );

  // ── Detail View ──────────────────────────────────────────────
  const renderDetail = () => {
    if (!selected) return null;
    const canComplete = selected.status === 'in_progress';
    const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);
    const tablesWithWtr = tables.filter(t => t.waiter).length;

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Sticky Action Bar */}
        <div className="sticky top-0 z-30 -mx-6 px-6 py-2.5 bg-[#FAF8F5]/95 backdrop-blur-sm border-b border-[#E0D3A8]/50 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button onClick={() => router.push(`/admin/mapa-mesas?event_id=${selected!.event_id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white border border-[#E0D3A8] text-[#8B6914] hover:bg-[#FBF6E9] hover:border-[#C9A84C] transition-colors whitespace-nowrap">
              <Icon name="layout" className="w-3.5 h-3.5"/>
              Mapa de mesas
            </button>
            <button onClick={() => { setViewMode('detail'); setTimeout(() => { document.getElementById('escandallo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white border border-[#E0D3A8] text-[#8B6914] hover:bg-[#FBF6E9] hover:border-[#C9A84C] transition-colors whitespace-nowrap">
              <Icon name="shoppingCart" className="w-3.5 h-3.5"/>
              Escandallo
            </button>
            <button onClick={() => router.push(`/admin/checklist?event_id=${selected!.event_id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white border border-[#E0D3A8] text-[#8B6914] hover:bg-[#FBF6E9] hover:border-[#C9A84C] transition-colors whitespace-nowrap">
              <Icon name="clipboardCheck" className="w-3.5 h-3.5"/>
              Día D / Checklist
            </button>
            <button onClick={() => setShowBudget(prev => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors whitespace-nowrap ${showBudget ? 'bg-[#C9A84C] text-white border-[#C9A84C]' : 'bg-white border-[#E0D3A8] text-[#8B6914] hover:bg-[#FBF6E9] hover:border-[#C9A84C]'}`}>
              <Icon name="cheque" className="w-3.5 h-3.5"/>
              Ver presupuesto
            </button>
            <button onClick={() => router.push(`/admin/cobros?event_id=${selected!.event_id}`)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-[#C9A84C] text-white hover:bg-[#A88A3A] transition-colors whitespace-nowrap shadow-sm">
              <Icon name="banknote" className="w-3.5 h-3.5"/>
              Cobrar
            </button>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
            <Icon name="arrowLeft" className="w-4 h-4"/>
            <span className="text-[12px] font-medium text-[#6B7280]">Volver</span>
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">{selected.client_name}</h2>
            <p className="text-xs text-[#6B7280]">{selected.event_type} · {fmtDate(selected.event_date)} · {selected.guest_count} pax</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {viewMode === 'detail' && (
              <button onClick={() => setViewMode('map')}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#C9A84C] text-[#C9A84C] hover:bg-[#FBF6E9] transition-colors flex items-center gap-1.5">
                <Icon name="layout" className="w-3.5 h-3.5"/>
                Mapa de mesas
              </button>
            )}
            <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${STATUS_MAP[selected.status]?.variant === 'info' ? 'bg-blue-50 text-blue-700 border-blue-200' : STATUS_MAP[selected.status]?.variant === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : STATUS_MAP[selected.status]?.variant === 'danger' ? 'bg-red-50 text-red-700 border-red-200' : STATUS_MAP[selected.status]?.variant === 'warning' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              {STATUS_MAP[selected.status]?.label || selected.status}
            </span>
            {selected.client_token && (
              <button onClick={copyClientLink}
                className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${copiedLink ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-[#FBF6E9] text-[#A88A3A] hover:bg-[#F5EAD0] border border-[#E5D5A0]'}`}>
                <Icon name="link" className="w-3.5 h-3.5"/>
                {copiedLink ? 'Copiado' : 'Enlace cliente'}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Comensales</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.guest_count}</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Mesas sugeridas</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.tables_suggested}</p><p className="text-[10px] text-[#9CA3AF] mt-0.5">(8 pax/mesa)</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Camareros</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.waiters_suggested}</p><p className="text-[10px] text-[#9CA3AF] mt-0.5">(1/12 pax)</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Precio</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(selected.confirmed_price)}</p></div>
        </div>

        {/* Budget / Presupuesto panel */}
        {showBudget && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="rounded-xl bg-white border border-[#E0D3A8] p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
              <Icon name="cheque" className="w-4 h-4 text-[#C9A84C]"/> Presupuesto del evento
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg bg-[#FAF8F5]">
                <p className="text-[10px] text-[#6B7280] uppercase">Precio base</p>
                <p className="text-lg font-bold text-[#1A1A2E]">{money(selected.confirmed_price)}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8F5]">
                <p className="text-[10px] text-[#6B7280] uppercase">Precio final</p>
                <p className="text-lg font-bold text-[#1A1A2E]">{money(selected.final_price || selected.confirmed_price)}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8F5]">
                <p className="text-[10px] text-[#6B7280] uppercase">Pax</p>
                <p className="text-lg font-bold text-[#1A1A2E]">{selected.guest_count + (selected.kids_count || 0)}</p>
              </div>
              <div className="p-3 rounded-lg bg-[#FAF8F5]">
                <p className="text-[10px] text-[#6B7280] uppercase">Precio/pax</p>
                <p className="text-lg font-bold text-[#1A1A2E]">
                  {money((selected.final_price || selected.confirmed_price) / Math.max(1, selected.guest_count + (selected.kids_count || 0)))}
                </p>
              </div>
            </div>
            <div className="text-[11px] text-[#9CA3AF]">
              Consumos extra: {money(extraItems.filter(e => e.desc && e.amount > 0).reduce((s, e) => s + e.amount, 0))}
            </div>
          </motion.div>
        )}

        {/* Tab bar: Escandallo | Mapa */}
        <div className="flex border-b border-[#E5E7EB]">
          <button onClick={() => setViewMode('detail')}
            className={`text-[12px] font-medium px-4 py-2.5 border-b-2 transition-colors ${viewMode === 'detail' ? 'border-[#C9A84C] text-[#1A1A2E]' : 'border-transparent text-[#6B7280] hover:text-[#1A1A2E]'}`}>
            <Icon name="clipboardList" className="w-4 h-4 inline mr-1.5"/> Escandallo & datos
          </button>
          <button onClick={() => setViewMode('map')}
            className={`text-[12px] font-medium px-4 py-2.5 border-b-2 transition-colors ${viewMode === 'map' ? 'border-[#C9A84C] text-[#1A1A2E]' : 'border-transparent text-[#6B7280] hover:text-[#1A1A2E]'}`}>
            <Icon name="layout" className="w-4 h-4 inline mr-1.5"/> Mapa de mesas
          </button>
        </div>

        {viewMode === 'map' ? renderMapView() : renderDataView(selected, canComplete)}

        {/* Complete modal */}
        <AnimatePresence>
          {showComplete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
              onClick={e => { if (e.target === e.currentTarget) setShowComplete(false); }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
                <h3 className="text-lg font-bold text-[#1A1A2E]">Finalizar Evento</h3>
                <p className="text-sm text-[#6B7280]">Al marcar como completado, el evento pasará a estado finalizado.
                  {extraItems.filter(e => e.desc && e.amount > 0).length > 0 && (
                    <span className="block mt-2 font-medium text-[#1A1A2E]">Se añadirán {money(extraItems.filter(e => e.desc && e.amount > 0).reduce((s, e) => s + e.amount, 0))} en consumos extra.</span>
                  )}
                </p>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleComplete} className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">Finalizar Evento</button>
                  <button onClick={() => setShowComplete(false)} className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">Cancelar</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ── Shopping items (Escandallo) ──
  const fetchShopping = async (eventId: string) => {
    try {
      const res = await fetch(`/api/shopping?event_id=${eventId}`);
      const data = await res.json();
      if (data.success) setShoppingItems(data.data || []);
    } catch {}
  };

  const updateShoppingItem = async (id: string, fields: any) => {
    try {
      await fetch('/api/shopping', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...fields }) });
      setShoppingItems(prev => prev.map(item => item.id === id ? { ...item, ...fields } : item));
    } catch {}
  };

  const deleteShoppingItem = async (id: string) => {
    try {
      await fetch(`/api/shopping?id=${id}`, { method: 'DELETE' });
      setShoppingItems(prev => prev.filter(item => item.id !== id));
    } catch {}
  };

  const regenerateShopping = async (eventId: string) => {
    try {
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', event_id: eventId })
      });
      const data = await res.json();
      if (data.success) setShoppingItems(data.data || []);
    } catch {}
  };

  const addShoppingItem = async (eventId: string) => {
    if (!newIngName.trim()) return;
    try {
      const res = await fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, ingredient_name: newIngName.trim(), provider_name: newIngProvider || '—', total_grams: newIngGrams, total_units: newIngUnits, total_ml: newIngMl })
      });
      const data = await res.json();
      if (data.success) {
        setShoppingItems(prev => [...prev, data.data]);
        setNewIngName(''); setNewIngProvider(''); setNewIngGrams(0); setNewIngUnits(0); setNewIngMl(0);
      }
    } catch {}
  };

  // ── Data View (escandallo, extras, menu) ─────────────────────
  const renderDataView = (selected: EventOrder, canComplete: boolean) => (
    <div className="space-y-6">
      {/* Manual overrides */}
      {canComplete && (
        <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-[#6B7280] font-medium">Mesas confirmadas</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={tablesManual} onChange={e => setTablesManual(+e.target.value)} className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0} />
              <span className="text-[11px] text-[#9CA3AF] whitespace-nowrap">sug: {selected.tables_suggested}</span>
              <button onClick={() => updateOrder(selected.id, { tables_confirmed: tablesManual })}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">Guardar</button>
            </div>
          </div>
          <div>
            <label className="text-[11px] text-[#6B7280] font-medium">Camareros confirmados</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="number" value={waitersManual} onChange={e => setWaitersManual(+e.target.value)} className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0} />
              <span className="text-[11px] text-[#9CA3AF] whitespace-nowrap">sug: {selected.waiters_suggested}</span>
              <button onClick={() => updateOrder(selected.id, { waiters_confirmed: waitersManual })}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">Guardar</button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* Escandallo editable */}
      <div className="space-y-3">
        <div id="escandallo-section" className="flex items-center justify-between scroll-mt-20">
          <h3 className="text-sm font-semibold text-[#1A1A2E]"><Icon name="clipboardList" className="w-4 h-4 inline mr-1.5"/> Lista de Necesidades (Escandallo)</h3>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#9CA3AF]">{shoppingItems.length} artículos</span>
            {canComplete && (
              <button onClick={() => regenerateShopping(selected!.event_id)}
                className="px-3 py-1 text-[11px] font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#FAF8F5] hover:border-[#C9A84C] transition-colors">
                <Icon name="refreshCw" className="w-3 h-3 inline mr-1" /> Regenerar
              </button>
            )}
          </div>
        </div>

        {shoppingItems.length === 0 ? (
          <div className="text-center py-8 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E7EB]">
            No hay artículos en el escandallo. Pulsa "Regenerar" para calcular desde el catálogo.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                  <th className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5 w-8">✓</th>
                  <th className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Ingrediente</th>
                  <th className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Proveedor</th>
                  <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Gramos</th>
                  <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Unidades</th>
                  <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">ML</th>
                  <th className="text-center text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {shoppingItems.map((item: any) => (
                  <tr key={item.id} className={`border-b border-[#F3F4F6] transition-colors ${item.completed ? 'bg-[#F0FDF4] opacity-60' : 'hover:bg-[#FAFAFC]'}`}>
                    <td className="px-3 py-2 text-center">
                      <input type="checkbox" checked={!!item.completed}
                        onChange={e => updateShoppingItem(item.id, { completed: e.target.checked })}
                        className="w-4 h-4 rounded border-[#D1D5DB] text-[#C9A84C] focus:ring-[#C9A84C]" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.ingredient_name}
                        onChange={e => updateShoppingItem(item.id, { ingredient_name: e.target.value })}
                        className="w-full text-sm text-[#1A1A2E] font-medium bg-transparent border-b border-transparent hover:border-[#E5E7EB] focus:border-[#C9A84C] focus:outline-none px-1 py-0.5" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="text" value={item.provider_name || ''}
                        onChange={e => updateShoppingItem(item.id, { provider_name: e.target.value })}
                        className="w-full text-sm text-[#6B7280] bg-transparent border-b border-transparent hover:border-[#E5E7EB] focus:border-[#C9A84C] focus:outline-none px-1 py-0.5" />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.total_grams || 0} min={0}
                        onChange={e => updateShoppingItem(item.id, { total_grams: +e.target.value })}
                        className="w-20 text-sm text-right text-[#6B7280] bg-transparent border-b border-transparent hover:border-[#E5E7EB] focus:border-[#C9A84C] focus:outline-none px-1 py-0.5" />
                      {item.total_grams > 0 && <span className="text-[10px] text-[#9CA3AF] ml-0.5">g</span>}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.total_units || 0} min={0}
                        onChange={e => updateShoppingItem(item.id, { total_units: +e.target.value })}
                        className="w-20 text-sm text-right text-[#6B7280] bg-transparent border-b border-transparent hover:border-[#E5E7EB] focus:border-[#C9A84C] focus:outline-none px-1 py-0.5" />
                      {item.total_units > 0 && <span className="text-[10px] text-[#9CA3AF] ml-0.5">ud</span>}
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" value={item.total_ml || 0} min={0}
                        onChange={e => updateShoppingItem(item.id, { total_ml: +e.target.value })}
                        className="w-20 text-sm text-right text-[#6B7280] bg-transparent border-b border-transparent hover:border-[#E5E7EB] focus:border-[#C9A84C] focus:outline-none px-1 py-0.5" />
                      {item.total_ml > 0 && <span className="text-[10px] text-[#9CA3AF] ml-0.5">ml</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => deleteShoppingItem(item.id)}
                        className="p-1 rounded text-[#C7C7CF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors" title="Eliminar">
                        <Icon name="trash" className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add new item row */}
        {canComplete && (
          <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
            <div className="flex-1 min-w-[140px]">
              <label className="text-[10px] text-[#6B7280] font-medium">Ingrediente</label>
              <input type="text" value={newIngName} onChange={e => setNewIngName(e.target.value)} placeholder="Nombre..."
                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div className="w-32">
              <label className="text-[10px] text-[#6B7280] font-medium">Proveedor</label>
              <input type="text" value={newIngProvider} onChange={e => setNewIngProvider(e.target.value)} placeholder="—"
                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-[#6B7280] font-medium">Gramos</label>
              <input type="number" value={newIngGrams || ''} onChange={e => setNewIngGrams(+e.target.value)} min={0}
                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-[#6B7280] font-medium">Unidades</label>
              <input type="number" value={newIngUnits || ''} onChange={e => setNewIngUnits(+e.target.value)} min={0}
                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <div className="w-20">
              <label className="text-[10px] text-[#6B7280] font-medium">ML</label>
              <input type="number" value={newIngMl || ''} onChange={e => setNewIngMl(+e.target.value)} min={0}
                className="w-full text-sm border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 mt-0.5 focus:outline-none focus:border-[#C9A84C]" />
            </div>
            <button onClick={() => addShoppingItem(selected.event_id)}
              className="px-3 py-1.5 text-[11px] font-medium text-white rounded-lg shadow-sm hover:shadow transition-all"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              <Icon name="plus" className="w-3.5 h-3.5 inline mr-1" /> Añadir
            </button>
          </div>
        )}
      </div>

      {/* Personal del evento (escandallo de personal) — puente con Staffing */}
      <EventStaffingPanel
        eventId={selected.event_id}
        eventDate={selected.event_date}
        guestCount={selected.guest_count}
        waitersSuggested={selected.waiters_suggested}
        canEdit={canComplete}
      />

      {/* Selección decorativa */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[#1A1A2E]"><Icon name="star" className="w-4 h-4 inline mr-1.5"/> Selección decorativa</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Linen type */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-3">
            <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Mantelería</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'blanco', label: 'Blanco', color: '#FFFFFF', border: '#E5E7EB' },
                { value: 'crema', label: 'Crema', color: '#F5F0E8', border: '#E8DCC8' },
                { value: 'dorado', label: 'Dorado', color: '#C9A84C', border: '#A88A3A' },
                { value: 'negro', label: 'Negro', color: '#1A1A1A', border: '#374151' },
                { value: 'rosa', label: 'Rosa', color: '#F9D5D3', border: '#E8A5A1' },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => saveDecoration('linen_type', opt.value)}
                  disabled={decorSaving}
                  className={`flex flex-col items-center rounded-xl border-2 overflow-hidden transition-all disabled:opacity-60 ${
                    decorLinen === opt.value
                      ? 'border-[#C9A84C] bg-[#FBF6E9] shadow-sm'
                      : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                  }`}>
                  <div className="w-12 h-8 rounded-t-[9px]" style={{ background: opt.color, borderBottom: `1px solid ${opt.border}` }} />
                  <span className="text-[10px] font-medium px-2 py-1.5 text-[#1A1A2E]">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Centerpiece */}
          <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-3">
            <p className="text-[11px] font-medium text-[#6B7280] uppercase tracking-wide">Centro de mesa</p>
            <div className="flex flex-wrap gap-2">
              {[
                { value: 'floral', label: 'Floral', icon: 'flower', bg: '#FFF5F5' },
                { value: 'velas', label: 'Velas', icon: 'candle', bg: '#FFFBEB' },
                { value: 'frutas', label: 'Frutas', icon: 'apple', bg: '#F0FDF4' },
                { value: 'minimalista', label: 'Minimalista', icon: 'minimize2', bg: '#F8FAFC' },
              ].map(opt => (
                <button key={opt.value}
                  onClick={() => saveDecoration('centerpiece', opt.value)}
                  disabled={decorSaving}
                  className={`flex flex-col items-center rounded-xl border-2 overflow-hidden transition-all disabled:opacity-60 ${
                    decorCenterpiece === opt.value
                      ? 'border-[#C9A84C] bg-[#FBF6E9] shadow-sm'
                      : 'border-[#E5E7EB] bg-white hover:border-[#D1D5DB]'
                  }`}>
                  <div className="w-12 h-8 rounded-t-[9px] flex items-center justify-center" style={{ background: opt.bg }}>
                    <Icon name={opt.icon} className="w-4 h-4 text-[#1A1A2E]" />
                  </div>
                  <span className="text-[10px] font-medium px-2 py-1.5 text-[#1A1A2E]">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Extra consumptions */}
      {canComplete && (
        <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-4">
          <h3 className="text-sm font-semibold text-[#1A1A2E] flex items-center gap-2">
            <Icon name="plus" className="w-4 h-4 text-[#6B7280]"/> Consumos Extra
          </h3>
          {extraItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <input type="text" value={item.desc} placeholder="Descripción"
                onChange={e => { const c = [...extraItems]; c[i] = { ...c[i], desc: e.target.value }; setExtraItems(c); }}
                className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" />
              <input type="number" value={item.amount || ''} placeholder="Importe €"
                onChange={e => { const c = [...extraItems]; c[i] = { ...c[i], amount: +e.target.value }; setExtraItems(c); }}
                className="w-28 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" />
              <button onClick={() => { if (extraItems.length > 1) setExtraItems(extraItems.filter((_, idx) => idx !== i)); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50">
                <Icon name="x" className="w-3.5 h-3.5"/>
              </button>
            </div>
          ))}
          <button onClick={() => setExtraItems([...extraItems, { desc: '', amount: 0 }])}
            className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">+ Añadir extra</button>
        </div>
      )}

      {/* Selected items (editable menu) */}
      {selected.selected_items && selected.selected_items.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[#1A1A2E]"><Icon name="food" className="w-4 h-4 inline mr-1.5"/> Menú seleccionado</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {selected.selected_items.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E5E7EB]">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#1A1A2E] font-medium truncate">{item.name || item.item_id}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{item.category}</p>
                </div>
                {canComplete && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={item.quantity || 1}
                      min={1}
                      onChange={e => {
                        const newQty = parseInt(e.target.value) || 1;
                        const newItems = [...selected.selected_items];
                        newItems[i] = { ...newItems[i], quantity: newQty };
                        setSelected({ ...selected, selected_items: newItems });
                      }}
                      onBlur={() => updateOrder(selected.id, { selected_items: selected.selected_items })}
                      className="w-14 text-xs text-center border border-[#E5E7EB] rounded px-1 py-1"
                    />
                    <span className="text-[10px] text-[#9CA3AF]">ud</span>
                  </div>
                )}
                {!canComplete && (
                  <span className="text-xs text-[#6B7280]">{item.quantity} ud</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // ── Map View (SVG canvas drag & drop) ────────────────────────
  const renderMapView = () => {
    const totalCapacity = tables.reduce((s, t) => s + t.capacity, 0);
    const tablesWithWtr = tables.filter(t => t.waiter).length;

    return (
      <div className="flex flex-col lg:flex-row gap-5 min-h-[500px]">
        {/* Canvas */}
        <div className="flex-1 bg-white rounded-2xl border border-[#ECECF1] shadow overflow-hidden">
          {loadingDist ? (
            <div className="flex items-center justify-center h-[500px] text-sm text-[#C9A84C]">
              <div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mr-3" />
              Generando distribución de mesas...
            </div>
          ) : tables.length === 0 ? (
            <div className="flex items-center justify-center h-[500px] text-sm text-[#6B7280] flex-col gap-3">
              <Icon name="layout" className="w-16 h-16 mx-auto text-[#E0D3A8]"/>
              <span>No hay distribución de mesas para este evento.</span>
              <button onClick={() => loadTables(selected!)}
                className="text-[11px] font-medium px-4 py-2 rounded-lg bg-[#C9A84C] text-white hover:bg-[#A88A3A] transition-colors">
                Generar distribución
              </button>
            </div>
          ) : (
            <div className="relative">
              {/* Toolbar */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-[#FAF8F5] border border-[#E0D3A8] rounded-lg px-2 py-1.5 shadow-sm">
                <button onClick={addTable} title="Añadir mesa"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#E0D3A8] transition-colors text-[#5A4A38]">
                  <Icon name="plus" className="w-4 h-4"/>
                </button>
                <div className="w-px h-5 bg-[#E0D3A8]"/>
                <button onClick={() => setSelectedTable(null)} title="Deseleccionar"
                  className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#E0D3A8] transition-colors text-[#5A4A38]">
                  <Icon name="x" className="w-4 h-4"/>
                </button>
                <div className="w-px h-5 bg-[#E0D3A8]"/>
                <button onClick={saveLayout} disabled={saving}
                  className="text-[11px] font-medium px-3 py-1 rounded bg-[#C9A84C] text-white hover:bg-[#A88A3A] disabled:opacity-60 transition-colors flex items-center gap-1">
                  {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
                </button>
              </div>

              {/* SVG Canvas */}
              <svg ref={svgRef} width="100%" height="500"
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                preserveAspectRatio="xMidYMid meet"
                className="bg-[#FAF8F5] cursor-default"
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onClick={() => setSelectedTable(null)}
                style={{ minHeight: 500 }}>
                {/* Grid */}
                <defs>
                  <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                    <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="#E0D3A8" strokeWidth={0.5} opacity={0.5}/>
                  </pattern>
                  <pattern id="grid-lg" width={GRID * 5} height={GRID * 5} patternUnits="userSpaceOnUse">
                    <path d={`M ${GRID * 5} 0 L 0 0 0 ${GRID * 5}`} fill="none" stroke="#D4A548" strokeWidth={1} opacity={0.2}/>
                  </pattern>
                </defs>
                <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)"/>
                <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid-lg)"/>

                {/* Labels */}
                <text x={CANVAS_W / 2} y={25} textAnchor="middle" fill="#D4A548" fontSize={13} fontStyle="italic" opacity={0.5} letterSpacing={3}>
                  — ESCENARIO / DJ —
                </text>
                <text x={CANVAS_W / 2} y={CANVAS_H - 8} textAnchor="middle" fill="#9CA3AF" fontSize={10} opacity={0.6}>
                  ← ENTRADA PRINCIPAL →
                </text>

                {/* Tables */}
                {tables.map(t => {
                  const isSelected = t.id === selectedTable;
                  const wColor = t.waiter && waiterColors[t.waiter] ? waiterColors[t.waiter] : null;
                  const borderColor = isSelected ? '#6B2737' : (wColor || t.color);
                  return (
                    <g key={t.id}
                      transform={`translate(${t.x}, ${t.y}) rotate(${t.rotation})`}
                      onPointerDown={e => handlePointerDownTable(e, t.id)}
                      className="cursor-grab active:cursor-grabbing"
                      style={{ cursor: drag?.tableId === t.id ? 'grabbing' : 'grab', touchAction: 'none' }}
                      onClick={e => e.stopPropagation()}>
                      {/* Shadow */}
                      {t.shape === 'round' ? (
                        <circle cx={Math.min(t.width, t.height) / 2} cy={Math.min(t.width, t.height) / 2}
                          r={Math.min(t.width, t.height) / 2 + 1} fill="rgba(0,0,0,0.08)"/>
                      ) : (
                        <rect x={1} y={1} width={t.width} height={t.height} rx={t.shape === 'long' ? 4 : 6}
                          fill="rgba(0,0,0,0.08)"/>
                      )}
                      {/* Shape */}
                      {t.shape === 'round' ? (
                        <circle cx={Math.min(t.width, t.height) / 2} cy={Math.min(t.width, t.height) / 2}
                          r={Math.min(t.width, t.height) / 2 - 3}
                          fill={t.color} stroke={borderColor} strokeWidth={isSelected ? 3 : 1.5} opacity={0.9}/>
                      ) : (
                        <rect x={2} y={2} width={t.width - 4} height={t.height - 4}
                          rx={t.shape === 'long' ? 4 : 6}
                          fill={t.color} stroke={borderColor} strokeWidth={isSelected ? 3 : 1.5} opacity={0.9}/>
                      )}
                      {/* Text */}
                      <text x={t.width / 2} y={t.height / 2 - 5} textAnchor="middle"
                        fill="white" fontSize={11} fontWeight={600} style={{ pointerEvents: 'none' }}>
                        {t.name}
                      </text>
                      <text x={t.width / 2} y={t.height / 2 + 8} textAnchor="middle"
                        fill="rgba(255,255,255,0.85)" fontSize={9} style={{ pointerEvents: 'none' }}>
                        {t.capacity} pax
                      </text>
                      {t.waiter && (
                        <text x={t.width / 2} y={t.height / 2 + 20} textAnchor="middle"
                          fill="#FFF8DC" fontSize={8} style={{ pointerEvents: 'none' }}>
                          {t.waiter.split(' ')[0]}
                        </text>
                      )}
                      {/* Selection ring */}
                      {isSelected && t.shape === 'round' && (
                        <circle cx={Math.min(t.width, t.height) / 2} cy={Math.min(t.width, t.height) / 2}
                          r={Math.min(t.width, t.height) / 2 + 3} fill="none" stroke="#6B2737" strokeWidth={1}
                          strokeDasharray="4 3"/>
                      )}
                      {isSelected && t.shape !== 'round' && (
                        <rect x={-1} y={-1} width={t.width + 2} height={t.height + 2}
                          rx={(t.shape === 'long' ? 4 : 6) + 2} fill="none" stroke="#6B2737" strokeWidth={1}
                          strokeDasharray="4 3"/>
                      )}
                      {/* Resize handle */}
                      {isSelected && (
                        <rect x={t.width - 10} y={t.height - 10} width={10} height={10}
                          fill="#6B2737" rx={2}
                          onPointerDown={e => {
                            e.stopPropagation(); e.preventDefault();
                            (e.target as HTMLElement).setPointerCapture(e.pointerId);
                            const startX = e.clientX, startY = e.clientY;
                            const ow = t.width, oh = t.height;
                            const move = (me: PointerEvent) => {
                              const rect = svgRef.current?.getBoundingClientRect();
                              if (!rect) return;
                              const dx = (me.clientX - startX) / (rect.width / CANVAS_W);
                              const dy = (me.clientY - startY) / (rect.height / CANVAS_H);
                              setTables(prev => prev.map(x => x.id === t.id ? {
                                ...x, width: Math.max(40, snap(ow + dx)), height: Math.max(40, snap(oh + dy))
                              } : x));
                            };
                            const up = () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); };
                            document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
                          }}
                          style={{ cursor: 'nwse-resize' }}/>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="w-full lg:w-72 space-y-4">
          {/* Selected table properties */}
          {selectedTableData ? (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow">
              <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTableData.color }}/>
                {selectedTableData.name}
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Nombre</label>
                  <input type="text" value={selectedTableData.name}
                    onChange={e => updateTableField(selectedTableData.id, 'name', e.target.value)}
                    className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Capacidad</label>
                    <input type="number" value={selectedTableData.capacity}
                      onChange={e => updateTableField(selectedTableData.id, 'capacity', parseInt(e.target.value) || 0)}
                      className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]" min={0}/>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Forma</label>
                    <select value={selectedTableData.shape}
                      onChange={e => updateTableField(selectedTableData.id, 'shape', e.target.value)}
                      className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]">
                      <option value="round">Redonda</option>
                      <option value="rect">Rectangular</option>
                      <option value="long">Alargada</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">
                    <Icon name="user" className="w-3 h-3 inline mr-1"/> Camarero
                  </label>
                  <select value={selectedTableData.waiter}
                    onChange={e => updateTableField(selectedTableData.id, 'waiter', e.target.value)}
                    className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]">
                    <option value="">Sin asignar</option>
                    {waiters.map(w => (
                      <option key={w.id} value={w.name}>
                        {waiterColors[w.name] && <span style={{color: waiterColors[w.name]}}>● </span>}
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <button onClick={() => rotateTable(selectedTableData.id)}
                    className="text-xs font-medium py-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F5F5F8] transition-colors flex items-center justify-center gap-1">
                    <Icon name="rotate" className="w-3 h-3"/>
                    Rotar
                  </button>
                  <button onClick={() => deleteTable(selectedTableData.id)}
                    className="text-xs font-medium py-2 rounded-lg bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FCE3E3] transition-colors flex items-center justify-center gap-1">
                    <Icon name="trash" className="w-3 h-3"/>
                    Eliminar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-6 shadow">
              <div className="text-center text-sm text-[#9CA3AF] space-y-2">
                <Icon name="layout" className="w-12 h-12 mx-auto text-[#E0D3A8]"/>
                <p>Haz clic en una mesa para editarla</p>
                <p className="text-[11px] text-[#C9A84C]">Arrástralas para distribuir</p>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow">
            <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Resumen</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-[#6B7280]">Mesas</span><span className="font-semibold">{tables.length}</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Plazas</span><span className="font-semibold">{totalCapacity} pax</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Invitados</span><span className="font-semibold">{selected?.guest_count || 0} pax</span></div>
              <div className="flex justify-between"><span className="text-[#6B7280]">Mesas con camarero</span><span className="font-semibold text-[#C9A84C]">{tablesWithWtr} / {tables.length}</span></div>
            </div>
          </div>

          {/* Waiter management panel */}
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm text-[#1A1A1A] flex items-center gap-2">
                <Icon name="userCheck" className="w-4 h-4"/> Camareros ({waiters.length})
              </h3>
              <button onClick={autoAssignWaiters} disabled={waiters.length === 0 || tables.length === 0}
                className="text-[10px] font-medium px-2 py-1 rounded-lg border border-[#C9A84C] text-[#C9A84C] hover:bg-[#FBF6E9] disabled:opacity-40 transition-colors">
                Repartir 1/3
              </button>
            </div>
            <div className="text-[10px] text-[#9CA3AF] mb-2 text-center">
              {tables.length} mesas · ~{Math.max(1, Math.round(tables.length / Math.max(1, waiters.length)))} mesas por camarero
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {waiters.map(w => {
                const assigned = tables.filter(t => t.waiter === w.name);
                const unassigned = tables.filter(t => !t.waiter);
                const isEditing = editingWaiter === w.name;
                return (
                  <div key={w.id} className="border border-[#F3F4F6] rounded-xl p-2.5 hover:border-[#E0D3A8] transition-colors">
                    {/* Waiter header */}
                    <div className="flex items-center justify-between group mb-1.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input type="text" defaultValue={w.name}
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') renameWaiter(w.name, (e.target as HTMLInputElement).value);
                              if (e.key === 'Escape') setEditingWaiter(null);
                            }}
                            onBlur={e => renameWaiter(w.name, e.target.value)}
                            className="flex-1 text-sm border border-[#C9A84C] rounded-lg px-2 py-0.5"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: waiterColors[w.name] || '#C9A84C' }}/>
                          <span className="text-sm font-medium text-[#1A1A1A]">{w.name}</span>
                          <span className="text-[10px] text-[#9CA3AF]">({assigned.length} mesa{assigned.length !== 1 ? 's' : ''})</span>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isEditing ? (
                          <button onClick={() => setEditingWaiter(null)}
                            className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#F3F4F6]"><Icon name="check" className="w-3 h-3"/></button>
                        ) : (
                          <>
                            <button onClick={() => setEditingWaiter(w.name)}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#F3F4F6]"><Icon name="edit" className="w-3 h-3 text-[#6B7280]"/></button>
                            <button onClick={() => {
                              if (confirm(`¿Eliminar a ${w.name}? Sus mesas quedarán sin asignar.`)) deleteWaiter(w.name);
                            }}
                              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-50"><Icon name="x" className="w-3 h-3 text-red-400"/></button>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Assigned tables list */}
                    {assigned.length > 0 ? (
                      <div className="space-y-1">
                        {assigned.map(t => (
                          <div key={t.id} className="flex items-center gap-1.5 text-[11px] pl-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#E0D3A8]"/>
                            <span className="text-[#1A1A1A] flex-1 truncate">{t.name}</span>
                            <select value={t.waiter}
                              onChange={e => assignTableWaiter(t.id, e.target.value)}
                              className="text-[10px] border border-[#ECECF1] rounded px-1 py-0.5 w-20 truncate">
                              <option value="">Sin asignar</option>
                              {waiters.map(w2 => (
                                <option key={w2.id} value={w2.name}>{w2.name}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[10px] text-[#9CA3AF] italic pl-4">Sin mesas asignadas</div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Add waiter */}
            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-[#ECECF1]">
              <input type="text" value={newWaiterName}
                onChange={e => setNewWaiterName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addWaiter(); }}
                placeholder="Añadir camarero..."
                className="flex-1 text-[11px] border border-[#ECECF1] rounded-lg px-2 py-1.5"
              />
              <button onClick={addWaiter} disabled={!newWaiterName.trim()}
                className="w-6 h-6 flex items-center justify-center rounded bg-[#C9A84C] text-white disabled:opacity-50"><Icon name="plus" className="w-3 h-3"/></button>
            </div>
            <button onClick={async () => {
              try {
                await fetch('/api/waiters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ waiters }) });
                setShowWaitersSaved(true);
                setTimeout(() => setShowWaitersSaved(false), 2000);
              } catch (e) { console.error(e); }
            }} className="w-full mt-2 text-[11px] font-medium py-1.5 rounded-lg bg-[#C9A84C] text-white hover:bg-[#A88A3A] transition-colors">
              {showWaitersSaved ? '✓ Guardado' : 'Guardar camareros'}
            </button>
          </div>

          {/* Help */}
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#E0D3A8] p-4">
            <h3 className="font-semibold text-sm text-[#1A1A1A] mb-2">Cómo usar</h3>
            <ul className="text-xs text-[#6B7280] space-y-1">
              <li>• <strong>Arrastra</strong> mesas para moverlas</li>
              <li>• <strong>Haz clic</strong> para editar propiedades</li>
              <li>• <strong>Esquina</strong> para redimensionar</li>
              <li>• <strong>+</strong> para añadir nueva mesa</li>
              <li>• <strong>↻</strong> para rotar 90°</li>
              <li>• <strong>Guardar</strong> para persistir en BD</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // ── Main ────────────────────────────────────────────────────
  if (selected) return renderDetail();
  return renderList();
}