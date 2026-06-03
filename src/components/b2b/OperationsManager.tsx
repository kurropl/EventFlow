'use client';
/**
 * EventFlow — Operations Manager (ERP)
 * Eventos activos, escandallos, cálculo de mesas y personal.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import MapaMesas from '@/components/b2b/MapaMesas';

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

const money = (n: number | string) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0);
const fmtDate = (d: string) => {
  if (!d) return '—';
  const [y, m, day] = d.slice(0, 10).split('-');
  const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
};

export default function OperationsManager() {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventOrder | null>(null);
  const [tablesManual, setTablesManual] = useState(0);
  const [waitersManual, setWaitersManual] = useState(0);
  const [extraItems, setExtraItems] = useState<{desc: string; amount: number}[]>([]);
  const [showComplete, setShowComplete] = useState(false);
  const [viewTab, setViewTab] = useState<'list' | 'map'>('list');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/event-orders');
      const json = await res.json();
      setOrders(json.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const updateOrder = async (id: string, data: any) => {
    await fetch(`/api/event-orders/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
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
  };

  // View: order detail (back from detail)
  if (selected) {
    const canComplete = selected.status === 'in_progress';
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">{selected.client_name}</h2>
            <p className="text-xs text-[#6B7280]">{selected.event_type} · {fmtDate(selected.event_date)} · {selected.guest_count} pax</p>
          </div>
          <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full border ${
            selected.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
            selected.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            'bg-gray-50 text-gray-500 border-gray-200'
          }`}>
            {selected.status === 'in_progress' ? 'En curso' : selected.status === 'completed' ? 'Completado' : selected.status}
          </span>
        </div>

        {/* Tables & Staff */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Comensales</p>
            <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.guest_count}</p>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Mesas sugeridas</p>
            <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.tables_suggested}</p>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">(8 pax/mesa)</p>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Camareros sugeridos</p>
            <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.waiters_suggested}</p>
            <p className="text-[10px] text-[#9CA3AF] mt-0.5">(1/12 pax)</p>
          </div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Precio confirmado</p>
            <p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(selected.confirmed_price)}</p>
          </div>
        </div>

        {/* Manual overrides */}
        {selected.status === 'in_progress' && (
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white border border-[#E5E7EB]">
            <div>
              <label className="text-[11px] text-[#6B7280] font-medium">Mesas confirmadas</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={tablesManual} onChange={e => setTablesManual(+e.target.value)}
                  className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0} />
                <span className="text-xs text-[#9CA3AF]">sugerido: {selected.tables_suggested}</span>
                <button onClick={() => updateOrder(selected.id, { tables_confirmed: tablesManual })}
                  className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">
                  Guardar
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] text-[#6B7280] font-medium">Camareros confirmados</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={waitersManual} onChange={e => setWaitersManual(+e.target.value)}
                  className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0} />
                <span className="text-xs text-[#9CA3AF]">sugerido: {selected.waiters_suggested}</span>
                <button onClick={() => updateOrder(selected.id, { waiters_confirmed: waitersManual })}
                  className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Escandallo / Shopping List */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">📋 Lista de Necesidades (Escandallo)</h3>
          {(!selected.shopping_list || selected.shopping_list.length === 0) ? (
            <div className="text-center py-8 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E7EB]">
              No hay datos de escandallo disponibles. Asegúrate de que los items del menú están enlazados al catálogo.
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

        {/* Extra consumptions & Complete */}
        {canComplete && (
          <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-4">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">➕ Consumos Extra (antes de finalizar)</h3>
            {extraItems.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="text" value={item.desc} placeholder="Descripción"
                  onChange={e => {
                    const copy = [...extraItems];
                    copy[i] = { ...copy[i], desc: e.target.value };
                    setExtraItems(copy);
                  }}
                  className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" />
                <input type="number" value={item.amount || ''} placeholder="Importe €"
                  onChange={e => {
                    const copy = [...extraItems];
                    copy[i] = { ...copy[i], amount: +e.target.value };
                    setExtraItems(copy);
                  }}
                  className="w-28 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2" />
                <button onClick={() => {
                  if (extraItems.length > 1) setExtraItems(extraItems.filter((_, idx) => idx !== i));
                }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50">
                  ×
                </button>
              </div>
            ))}
            <button onClick={() => setExtraItems([...extraItems, { desc: '', amount: 0 }])}
              className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">
              + Añadir extra
            </button>
            <div className="pt-2">
              <button onClick={() => setShowComplete(true)}
                className="w-full text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">
                ✅ Marcar Evento como Completado
              </button>
            </div>
          </div>
        )}

        {/* Menú items */}
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

        {/* Complete confirmation modal */}
        <AnimatePresence>
          {showComplete && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
              onClick={e => { if (e.target === e.currentTarget) setShowComplete(false); }}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
                <h3 className="text-lg font-bold text-[#1A1A2E]">Finalizar Evento</h3>
                <p className="text-sm text-[#6B7280]">
                  Al marcar como completado, el evento pasará a estado finalizado y se generarán los datos para facturación.
                  {extraItems.filter(e => e.desc && e.amount > 0).length > 0 && (
                    <span className="block mt-2 font-medium text-[#1A1A2E]">
                      Se añadirán {money(extraItems.filter(e => e.desc && e.amount > 0).reduce((s, e) => s + e.amount, 0))} en consumos extra.
                    </span>
                  )}
                </p>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleComplete}
                    className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">
                    ✅ Finalizar Evento
                  </button>
                  <button onClick={() => setShowComplete(false)}
                    className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // List view
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#1A1A2E]">Operaciones</h1>
          <p className="text-xs text-[#6B7280]">Eventos activos, escandallos y logística</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setViewTab('list')}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors ${viewTab === 'list' ? 'bg-[#1A1A2E] text-white' : 'border border-[#E5E7EB] hover:bg-[#F3F4F6]'}`}>
            Lista
          </button>
          <button onClick={() => setViewTab('map')}
            className={`text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors ${viewTab === 'map' ? 'bg-[#1A1A2E] text-white' : 'border border-[#E5E7EB] hover:bg-[#F3F4F6]'}`}>
            Mapa de Mesas
          </button>
          <button onClick={fetchOrders}
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
            ↻ Actualizar
          </button>
        </div>
      </div>

      {viewTab === 'map' ? (
        <div className="rounded-2xl border border-[#ECECF1] bg-white overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          style={{ height: 'calc(100vh - 200px)', minHeight: 500 }}>
          {(selected ? (() => {
            const sel: EventOrder = selected as unknown as EventOrder;
            return            <MapaMesas
            operationId={sel.id}
            eventId={sel.event_id}
            operationName={`${sel.client_name} — ${sel.event_type}`}
            guestCount={sel.guest_count}
            tablesSuggested={sel.tables_suggested}
            kidsCount={sel.kids_count}
          />;})() : null)}
          {!selected && (
            <div className="flex items-center justify-center h-full text-sm text-[#6B7280]">
              Selecciona un evento de la lista para ver su mapa de mesas
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Stats */}
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

      {loading ? (
        <div className="text-center py-12 text-sm text-[#6B7280]">Cargando...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E7EB]">
          No hay órdenes de evento activas. Cuando un lead acepte un presupuesto, aparecerá aquí.
        </div>
      ) : (
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
              {orders.map((o) => (
                <tr key={o.id} onClick={() => handleSelectOrder(o)}
                  className="border-b border-[#F3F4F6] hover:bg-[#FAF8F5] cursor-pointer transition-colors">
                  <td className="px-4 py-3.5">
                    <p className="text-sm font-medium text-[#1A1A2E]">{o.client_name}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{o.client_email}</p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-sm text-[#1A1A2E]">{o.event_type}</p>
                    <p className="text-[11px] text-[#9CA3AF]">{fmtDate(o.event_date)}</p>
                  </td>
                  <td className="px-4 py-3.5 text-center text-sm text-[#1A1A2E] font-medium">{o.guest_count}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-sm font-medium text-[#1A1A2E]">{o.tables_confirmed || o.tables_suggested}</span>
                    <span className="text-[10px] text-[#9CA3AF] ml-1">/ {o.tables_suggested}</span>
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="text-sm font-medium text-[#1A1A2E]">{o.waiters_confirmed || o.waiters_suggested}</span>
                    <span className="text-[10px] text-[#9CA3AF] ml-1">/ {o.waiters_suggested}</span>
                  </td>
                  <td className="px-4 py-3.5 text-right text-sm font-medium text-[#1A1A2E]">{money(o.confirmed_price)}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                      o.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      o.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>
                      {o.status === 'in_progress' ? 'En curso' : o.status === 'completed' ? '✅' : o.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>
      )}
    </div>
  );
}
