'use client';
/**
 * EventFlow — Operations Manager (ERP)
 * Vista de detalle: escandallo + mapa de mesas visual (sin drag & drop).
 * Las mesas se editan inline al hacer clic.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '@/components/shared/Icon';

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
}
interface ShoppingItem {
  ingredient_name: string; total_grams: number; total_units: number; total_ml: number;
}
interface TableInfo {
  id: string; name: string; capacity: number; waiter: string;
}
interface Waiter { id: string; name: string; role: string; }

// ── Helpers ────────────────────────────────────────────────────
const money = (n: number | string) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
};

// ── COMPONENT ═══════════════════════════════════════════════
export default function OperationsManager() {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventOrder | null>(null);
  const [tablesManual, setTablesManual] = useState(0);
  const [waitersManual, setWaitersManual] = useState(0);
  const [extraItems, setExtraItems] = useState<{ desc: string; amount: number }[]>([]);
  const [showComplete, setShowComplete] = useState(false);

  // Map state — simple list of tables
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loadingDist, setLoadingDist] = useState(false);
  const [editingTable, setEditingTable] = useState<string | null>(null);

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

  const handleSelectOrder = (o: EventOrder) => {
    setSelected(o);
    setTablesManual(o.tables_confirmed || o.tables_suggested);
    setWaitersManual(o.waiters_confirmed || o.waiters_suggested);
    setExtraItems(o.extra_consumptions?.length ? o.extra_consumptions : [{ desc: '', amount: 0 }]);
    loadTables(o);
  };

  // ── Load tables from API or generate ────────────────────────
  const loadTables = async (order: EventOrder) => {
    setLoadingDist(true);
    try {
      // Load waiters
      let wList: Waiter[] = [];
      try {
        const wr = await fetch(`/api/event-orders/${order.id}/waiters`);
        const wd = await wr.json();
        if (wd.success) wList = wd.waiters || [];
      } catch { /* ok */ }
      setWaiters(wList);

      // Load saved plan or generate
      const params = new URLSearchParams();
      if (order.event_id) params.set('event_id', order.event_id);
      const r = await fetch(`/api/floor-plan?${params}`);
      const data = await r.json();
      if (data.success && data.data) {
        // Convert from TablePos to TableInfo
        const list: TableInfo[] = data.data.map((t: any) => ({
          id: t.id, name: t.name, capacity: t.capacity,
          waiter: t.waiter || '',
        }));
        setTables(list);
        // Reassign waiters if none assigned
        if (!list.some(t => t.waiter) && wList.length > 0) {
          setTables(prev => prev.map((t, i) => ({ ...t, waiter: wList[i % wList.length].name })));
        }
      } else if (order.guest_count > 0) {
        // Generate via API
        const gen = await fetch('/api/floor-plan/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestCount: order.guest_count, tablesSuggested: order.tables_suggested, kidsCount: order.kids_count, waiters: wList }),
        });
        const gd = await gen.json();
        if (gd.success) {
          setTables(gd.data.map((t: any) => ({ id: t.id, name: t.name, capacity: t.capacity, waiter: t.waiter || '' })));
        }
      }
    } catch { /* fallback */ }
    setLoadingDist(false);
  };

  const saveTables = async () => {
    if (!selected) return;
    try {
      const payload = tables.map(t => ({
        id: t.id, name: t.name, capacity: t.capacity, waiter: t.waiter,
        // keep existing positions from API
      }));
      const params = new URLSearchParams();
      if (selected.event_id) params.set('event_id', selected.event_id);
      await fetch(`/api/floor-plan?${params}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: payload }),
      });
    } catch (e) { console.error(e); }
  };

  const updateTable = (id: string, field: keyof TableInfo, value: any) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  // ── Render: List View ───────────────────────────────────────
  const renderList = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">Operaciones</h1>
          <p className="text-xs text-[#6B7280]">Eventos activos, escandallos y logística</p>
        </div>
        <button onClick={fetchOrders} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">↻</button>
      </div>
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#EFF4FF] border border-[#BFDBFE]">
            <p className="text-[10px] text-[#2563EB] uppercase tracking-wide font-semibold">En curso</p>
            <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{orders.filter(o => o.status === 'in_progress').length}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#EFFAF2] border border-[#A7F3D0]">
            <p className="text-[10px] text-[#15803D] uppercase tracking-wide font-semibold">Completados</p>
            <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{orders.filter(o => o.status === 'completed').length}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Total pax</p>
            <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{orders.reduce((s, o) => s + (o.guest_count || 0), 0)}</p>
          </div>
        </div>
      )}
      {loading ? <div className="text-center py-12 text-sm text-[#6B7280]">Cargando...</div> :
        orders.length === 0 ? <div className="text-center py-12 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E7EB]">No hay órdenes de evento activas.</div> :
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Cliente</th>
                <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Evento</th>
                <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Pax</th>
                <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Mesas</th>
                <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Camareros</th>
                <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Total</th>
                <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
                <tr key={o.id} onClick={() => handleSelectOrder(o)}
                  className="border-b border-[#F3F4F6] hover:bg-[#FAF8F5] cursor-pointer transition-colors">
                  <td className="px-4 py-3.5"><p className="text-sm font-medium text-[#1A1A2E]">{o.client_name}</p><p className="text-[11px] text-[#9CA3AF]">{o.client_email}</p></td>
                  <td className="px-4 py-3.5"><p className="text-sm text-[#1A1A2E]">{o.event_type}</p><p className="text-[11px] text-[#9CA3AF]">{fmtDate(o.event_date)}</p></td>
                  <td className="px-4 py-3.5 text-center text-sm text-[#1A1A2E] font-medium">{o.guest_count}</td>
                  <td className="px-4 py-3.5 text-center"><span className="text-sm font-medium text-[#1A1A2E]">{o.tables_confirmed || o.tables_suggested}</span><span className="text-[10px] text-[#9CA3AF] ml-1">/ {o.tables_suggested}</span></td>
                  <td className="px-4 py-3.5 text-center"><span className="text-sm font-medium text-[#1A1A2E]">{o.waiters_confirmed || o.waiters_suggested}</span><span className="text-[10px] text-[#9CA3AF] ml-1">/ {o.waiters_suggested}</span></td>
                  <td className="px-4 py-3.5 text-right text-sm font-medium text-[#1A1A2E]">{money(o.confirmed_price)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${o.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : o.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                      {o.status === 'in_progress' ? 'En curso' : o.status === 'completed' ? '✅' : o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      }
    </div>
  );

  // ── Render: Detail (escandallo + mesa) ──────────────────────
  const renderDetail = () => {
    if (!selected) return null;
    const canComplete = selected.status === 'in_progress';
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* Back + Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">{selected.client_name}</h2>
            <p className="text-xs text-[#6B7280]">{selected.event_type} · {fmtDate(selected.event_date)} · {selected.guest_count} pax</p>
          </div>
          <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full border ${selected.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' : selected.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            {selected.status === 'in_progress' ? 'En curso' : selected.status === 'completed' ? 'Completado' : selected.status}
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Comensales</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.guest_count}</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Mesas sugeridas</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.tables_suggested}</p><p className="text-[10px] text-[#9CA3AF] mt-0.5">(8 pax/mesa)</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Camareros</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.waiters_suggested}</p><p className="text-[10px] text-[#9CA3AF] mt-0.5">(1/12 pax)</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Precio</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(selected.confirmed_price)}</p></div>
        </div>

        {/* Manual overrides */}
        {canComplete && (
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white border border-[#E5E7EB]">
            <div>
              <label className="text-[11px] text-[#6B7280] font-medium">Mesas confirmadas</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={tablesManual} onChange={e => setTablesManual(+e.target.value)} className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0} />
                <span className="text-xs text-[#9CA3AF]">sugerido: {selected.tables_suggested}</span>
                <button onClick={() => updateOrder(selected.id, { tables_confirmed: tablesManual })}
                  className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">Guardar</button>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#6B7280] font-medium">Camareros confirmados</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={waitersManual} onChange={e => setWaitersManual(+e.target.value)} className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0} />
                <span className="text-xs text-[#9CA3AF]">sugerido: {selected.waiters_suggested}</span>
                <button onClick={() => updateOrder(selected.id, { waiters_confirmed: waitersManual })}
                  className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">Guardar</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Mapa de Mesas (inline, como el escandallo) ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">🗂 Distribución de Mesas</h3>
            {tables.length > 0 && (
              <button onClick={saveTables}
                className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#C9A84C] text-white hover:bg-[#A88A3A] transition-colors">
                Guardar distribución
              </button>
            )}
          </div>

          {loadingDist ? (
            <div className="flex items-center justify-center py-12 text-sm text-[#C9A84C] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E0D3A8]">
              <div className="w-5 h-5 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mr-3" />
              Generando distribución...
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-8 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E7EB]">
              {selected.guest_count > 0
                ? 'No se pudo generar la distribución. Revisa que el evento tenga datos de presupuesto.'
                : 'No hay datos de invitados para generar distribución.'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                      <th className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Mesa</th>
                      <th className="text-center text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Capacidad</th>
                      <th className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Camarero</th>
                      <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tables.map((table) => (
                      <tr key={table.id} className="border-b border-[#F3F4F6] hover:bg-[#FAF8F5]">
                        <td className="px-3 py-2.5">
                          {editingTable === table.id ? (
                            <input type="text" value={table.name}
                              onChange={e => updateTable(table.id, 'name', e.target.value)}
                              className="w-32 text-sm border border-[#C9A84C] rounded-lg px-2 py-1" />
                          ) : (
                            <span className="text-sm font-medium text-[#1A1A2E]">{table.name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {editingTable === table.id ? (
                            <input type="number" value={table.capacity}
                              onChange={e => updateTable(table.id, 'capacity', parseInt(e.target.value) || 0)}
                              className="w-16 text-sm text-center border border-[#C9A84C] rounded-lg px-2 py-1" min={0} />
                          ) : (
                            <span className="text-sm text-[#6B7280]">{table.capacity} pax</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {editingTable === table.id ? (
                            <select value={table.waiter}
                              onChange={e => updateTable(table.id, 'waiter', e.target.value)}
                              className="text-sm border border-[#C9A84C] rounded-lg px-2 py-1">
                              <option value="">Sin asignar</option>
                              {waiters.map(w => (
                                <option key={w.id} value={w.name}>{w.name} ({w.role})</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-[#6B7280]">{table.waiter || '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {editingTable === table.id ? (
                            <button onClick={() => setEditingTable(null)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">
                              OK
                            </button>
                          ) : (
                            <button onClick={() => setEditingTable(table.id)}
                              className="text-[11px] font-medium px-2.5 py-1 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
                              <Icon name="edit" className="w-3 h-3 inline" /> Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="px-3 py-2.5 bg-[#FBF6E9] border-t border-[#E0D3A8] text-xs text-[#6B7280] flex items-center gap-4">
                <span className="font-medium text-[#1A1A1A]">{tables.length} mesas</span>
                <span>{tables.reduce((s, t) => s + t.capacity, 0)} plazas totales</span>
                <span>⋮ {tables.filter(t => t.waiter).length} mesas con camarero</span>
              </div>
            </div>
          )}
        </div>

        {/* Escandallo */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">📋 Lista de Necesidades (Escandallo)</h3>
          {(!selected.shopping_list || selected.shopping_list.length === 0) ? (
            <div className="text-center py-8 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E7EB]">
              No hay datos de escandallo disponibles.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                    <th className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Ingrediente</th>
                    <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Gramos</th>
                    <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Unidades</th>
                    <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">ML</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.shopping_list.map((item: ShoppingItem, i: number) => (
                    <tr key={i} className="border-b border-[#F3F4F6]">
                      <td className="px-3 py-2.5 text-sm text-[#1A1A2E] font-medium">{item.ingredient_name}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-[#6B7280]">{item.total_grams > 0 ? `${Math.round(item.total_grams)}g` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-[#6B7280]">{item.total_units > 0 ? `${Math.round(item.total_units)} ud` : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-sm text-[#6B7280]">{item.total_ml > 0 ? `${Math.round(item.total_ml)}ml` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Extra + Complete */}
        {canComplete && (
          <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-4">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">➕ Consumos Extra</h3>
            {extraItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="text" value={item.desc} placeholder="Descripción"
                  onChange={e => { const c = [...extraItems]; c[i] = { ...c[i], desc: e.target.value }; setExtraItems(c); }}
                  className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" />
                <input type="number" value={item.amount || ''} placeholder="Importe €"
                  onChange={e => { const c = [...extraItems]; c[i] = { ...c[i], amount: +e.target.value }; setExtraItems(c); }}
                  className="w-28 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" />
                <button onClick={() => { if (extraItems.length > 1) setExtraItems(extraItems.filter((_, idx) => idx !== i)); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50">×</button>
              </div>
            ))}
            <button onClick={() => setExtraItems([...extraItems, { desc: '', amount: 0 }])}
              className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">+ Añadir extra</button>
            <div className="pt-2">
              <button onClick={() => setShowComplete(true)}
                className="w-full text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">
                ✅ Marcar Evento como Completado
              </button>
            </div>
          </div>
        )}

        {/* Menú */}
        {selected.selected_items && selected.selected_items.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">🍽 Menú seleccionado</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {selected.selected_items.map((item: any, i: number) => (
                <div key={i} className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E5E7EB]">
                  <p className="text-xs text-[#1A1A2E] font-medium">{item.name || item.item_id}</p>
                  <p className="text-[10px] text-[#9CA3AF]">{item.category} · {item.quantity} ud</p>
                </div>
              ))}
            </div>
          </div>
        )}

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
                    <span className="block mt-2 font-medium text-[#1A1A2E]">
                      Se añadirán {money(extraItems.filter(e => e.desc && e.amount > 0).reduce((s, e) => s + e.amount, 0))} en consumos extra.
                    </span>
                  )}
                </p>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleComplete}
                    className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">✅ Finalizar Evento</button>
                  <button onClick={() => setShowComplete(false)}
                    className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">Cancelar</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ── Main ────────────────────────────────────────────────────
  if (selected) return renderDetail();
  return renderList();
}
