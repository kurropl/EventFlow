'use client';
/**
 * EventFlow — Operations Manager (ERP)
 * Eventos activos, escandallos y logística. Incluye mapa de mesas drag & drop.
 * 
 * FIX: All sub-views are extracted as const arrow functions to avoid
 * TypeScript control-flow narrowing issues with the viewTab discriminated union.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
interface TablePos {
  id: string; name: string; x: number; y: number;
  width: number; height: number; rotation: number;
  capacity: number; shape: 'round' | 'rect' | 'long';
  color: string; waiter: string;
}
interface Waiter { id: string; name: string; role: string; }
interface DragState { tableId: string; startX: number; startY: number; origX: number; origY: number; }

// ── Constants ──────────────────────────────────────────────────
const HALL_WIDTH = 800, HALL_HEIGHT = 600, GRID_SIZE = 10;
const TABLE_COLORS = ['#C9A84C','#4682B4','#6B8E23','#9370DB','#CD5C5C','#20B2AA','#A88A3A','#D4A574','#B8860B','#D2691E','#8B7355','#7B68EE','#2E8B57','#B22222','#F4A460'];
const DEFAULT_TABLES: TablePos[] = [
  { id:'t1', name:'Mesa Principal', x:350, y:250, width:100, height:60, rotation:0, capacity:10, shape:'rect', color:'#C9A84C', waiter:'' },
  { id:'t2', name:'Mesa 1', x:100, y:100, width:60, height:60, rotation:0, capacity:8, shape:'round', color:'#4682B4', waiter:'' },
  { id:'t3', name:'Mesa 2', x:300, y:80, width:60, height:60, rotation:0, capacity:8, shape:'round', color:'#6B8E23', waiter:'' },
  { id:'t4', name:'Mesa 3', x:550, y:100, width:60, height:60, rotation:0, capacity:8, shape:'round', color:'#9370DB', waiter:'' },
  { id:'t5', name:'Mesa 4', x:150, y:350, width:60, height:60, rotation:0, capacity:8, shape:'round', color:'#CD5C5C', waiter:'' },
  { id:'t6', name:'Mesa 5', x:550, y:350, width:60, height:60, rotation:0, capacity:8, shape:'round', color:'#20B2AA', waiter:'' },
  { id:'t7', name:'Mesa 6', x:350, y:450, width:100, height:40, rotation:0, capacity:12, shape:'long', color:'#A88A3A', waiter:'' },
];

// ── Helpers ────────────────────────────────────────────────────
const money = (n: number | string) => new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR', maximumFractionDigits:0 }).format(Number(n)||0);
const fmtDate = (d: string) => { if(!d) return '—'; const [y,m,day]=d.slice(0,10).split('-'); const months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']; return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`; };
const snap = (v: number, g: number) => Math.round(v/g)*g;

// ── Component ──────────────────────────────────────────────────
export default function OperationsManager() {
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EventOrder | null>(null);
  const [viewTab, setViewTab] = useState<'list'|'map'>('list');

  // Detail view state
  const [tablesManual, setTablesManual] = useState(0);
  const [waitersManual, setWaitersManual] = useState(0);
  const [extraItems, setExtraItems] = useState<{desc:string;amount:number}[]>([]);
  const [showComplete, setShowComplete] = useState(false);

  // Map state
  const [tables, setTables] = useState<TablePos[]>(DEFAULT_TABLES);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [drag, setDrag] = useState<DragState|null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newShape, setNewShape] = useState<'round'|'rect'|'long'>('round');
  const [newCapacity, setNewCapacity] = useState(8);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);
  const [scale, setScale] = useState(1);
  const hallRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedTable = tables.find(t => t.id === selectedId) || null;

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/event-orders'); const j = await r.json(); setOrders(j.data||[]); }
    catch(e) { console.error(e); }
    setLoading(false);
  }, []);
  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Scale
  useEffect(() => {
    const update = () => {
      if(!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const sx = (rect.width-32)/HALL_WIDTH, sy = (rect.height-32)/HALL_HEIGHT;
      setScale(Math.min(sx, sy, 1.2));
    };
    update(); window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Generate tables for event
  const generateTablesForEvent = useCallback(async (order: EventOrder) => {
    if(!order.event_id) return;
    setLoaded(false); setLoadingDist(true);
    try {
      const params = new URLSearchParams(); params.set('event_id', order.event_id);
      const r = await fetch(`/api/floor-plan?${params}`);
      const data = await r.json();
      if(data.success && data.data) {
        setTables(data.data.map((t:TablePos) => ({...t, waiter: t.waiter||''})));
      } else if(order.guest_count > 0) {
        const gen = await fetch('/api/floor-plan/generate', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ guestCount:order.guest_count, tablesSuggested:order.tables_suggested, kidsCount:order.kids_count, waiters }),
        });
        const gd = await gen.json();
        if(gd.success) setTables(gd.data);
      }
    } catch { /* fallback */ }
    setLoadingDist(false); setLoaded(true);
  }, [waiters]);

  useEffect(() => {
    if(viewTab !== 'map' || !selected) return;
    generateTablesForEvent(selected);
  }, [selected, viewTab, generateTablesForEvent]);

  // Load waiters
  useEffect(() => {
    if(!selected?.id) return;
    (async () => {
      try { const r = await fetch(`/api/event-orders/${selected.id}/waiters`); const d = await r.json(); if(d.success) setWaiters(d.waiters||[]); }
      catch { /* no waiters */ }
    })();
  }, [selected?.id]);

  // Reassign waiters
  useEffect(() => {
    if(!loaded || waiters.length === 0) return;
    if(tables.some(t => t.waiter?.trim())) return;
    setTables(prev => prev.map((t,i) => ({...t, waiter: waiters[i%waiters.length]?.name||t.waiter})));
  }, [loaded, waiters.length]);

  // ── Actions ──────────────────────────────────────────────────
  const updateOrder = async (id: string, data: any) => {
    await fetch(`/api/event-orders/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    fetchOrders();
  };

  const handleComplete = async () => {
    if(!selected) return;
    const extras = extraItems.filter(e => e.desc && e.amount > 0);
    await updateOrder(selected.id, { status:'completed', tables_confirmed: tablesManual||selected.tables_suggested, waiters_confirmed: waitersManual||selected.waiters_suggested, extra_consumptions: extras });
    setShowComplete(false); setSelected(null);
  };

  const handleSelectOrder = (o: EventOrder) => {
    setSelected(o);
    setTablesManual(o.tables_confirmed||o.tables_suggested);
    setWaitersManual(o.waiters_confirmed||o.waiters_suggested);
    setExtraItems(o.extra_consumptions?.length ? o.extra_consumptions : [{desc:'',amount:0}]);
  };

  // Map: drag
  const handleMouseDown = useCallback((e: React.MouseEvent, tid: string) => {
    e.stopPropagation(); const t = tables.find(x => x.id === tid); if(!t) return;
    setSelectedId(tid); setDrag({tableId:tid, startX:e.clientX, startY:e.clientY, origX:t.x, origY:t.y});
  }, [tables]);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if(!drag) return;
    const dx=(e.clientX-drag.startX)/scale, dy=(e.clientY-drag.startY)/scale;
    setTables(prev => prev.map(t => t.id===drag.tableId ? {...t, x:snap(drag.origX+dx,GRID_SIZE), y:snap(drag.origY+dy,GRID_SIZE)} : t));
  }, [drag, scale]);
  const handleMouseUp = useCallback(() => setDrag(null), []);

  // Map: resize
  const handleResizeStart = useCallback((e: React.MouseEvent, tid: string) => {
    e.stopPropagation(); e.preventDefault();
    const t = tables.find(x => x.id === tid); if(!t) return;
    const sx=e.clientX, sy=e.clientY, ow=t.width, oh=t.height;
    const move = (me: MouseEvent) => {
      const dx=(me.clientX-sx)/scale, dy=(me.clientY-sy)/scale;
      setTables(prev => prev.map(x => x.id===tid ? {...x, width:Math.max(40,snap(ow+dx,GRID_SIZE)), height:Math.max(30,snap(oh+dy,GRID_SIZE))} : x));
    };
    const up = () => { document.removeEventListener('mousemove',move); document.removeEventListener('mouseup',up); };
    document.addEventListener('mousemove',move); document.addEventListener('mouseup',up);
  }, [tables, scale]);

  // Map: rotate/delete/add
  const rotateTable = useCallback((tid: string) => {
    setTables(prev => prev.map(t => t.id===tid ? {...t, width:t.height, height:t.width, rotation:(t.rotation+90)%360} : t));
  }, []);
  const deleteTable = useCallback((tid: string) => { setTables(prev => prev.filter(t => t.id!==tid)); setSelectedId(null); }, []);
  const addTable = useCallback(() => {
    const hall = hallRef.current; if(!hall) return;
    const rect = hall.getBoundingClientRect();
    const cx=(rect.width/2-30)/scale, cy=(rect.height/2-30)/scale;
    let max=0; tables.forEach(t => { const n=parseInt(t.id.replace(/\D/g,''),10); if(n>max) max=n; });
    let nm=0; tables.forEach(t => { const m=t.name.match(/\d+/); if(m){ const n=parseInt(m[0],10); if(n>nm) nm=n; } });
    const dims = newShape==='round'?{width:60,height:60}:newShape==='rect'?{width:80,height:50}:{width:120,height:40};
    setTables(prev => [...prev, {id:`t${max+1}`, name:`Mesa ${nm+1}`, x:snap(cx,GRID_SIZE), y:snap(cy,GRID_SIZE), ...dims, rotation:0, capacity:newCapacity, shape:newShape, color:TABLE_COLORS[prev.length%TABLE_COLORS.length], waiter:''}]);
    setShowAdd(false);
  }, [tables, newShape, newCapacity, scale]);

  const saveLayout = useCallback(async () => {
    if(!selected) return;
    setSaving(true);
    try {
      const params = new URLSearchParams(); params.set('event_id', selected.event_id);
      await fetch(`/api/floor-plan?${params}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({tables}) });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch(e) { console.error(e); }
    setSaving(false);
  }, [tables, selected]);

  const totalCapacity = useMemo(() => tables.reduce((s,t) => s+t.capacity, 0), [tables]);
  const tablesWithWtr = tables.filter(t => t.waiter && t.waiter.trim()).length;

  // ── Detail View ──────────────────────────────────────────────
  const renderDetail = () => {
    if(!selected) return null;
    const canComplete = selected.status === 'in_progress';
    return (
      <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div>
            <h2 className="text-lg font-bold text-[#1A1A2E]">{selected.client_name}</h2>
            <p className="text-xs text-[#6B7280]">{selected.event_type} · {fmtDate(selected.event_date)} · {selected.guest_count} pax</p>
          </div>
          <span className={`ml-auto text-[11px] font-medium px-2.5 py-1 rounded-full border ${selected.status==='in_progress'?'bg-blue-50 text-blue-700 border-blue-200':selected.status==='completed'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-gray-50 text-gray-500 border-gray-200'}`}>
            {selected.status==='in_progress'?'En curso':selected.status==='completed'?'Completado':selected.status}
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Comensales</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.guest_count}</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Mesas sugeridas</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.tables_suggested}</p><p className="text-[10px] text-[#9CA3AF] mt-0.5">(8 pax/mesa)</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Camareros</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{selected.waiters_suggested}</p><p className="text-[10px] text-[#9CA3AF] mt-0.5">(1/12 pax)</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Precio</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{money(selected.confirmed_price)}</p></div>
        </div>
        {selected.status === 'in_progress' && (
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white border border-[#E5E7EB]">
            <div><label className="text-[11px] text-[#6B7280] font-medium">Mesas confirmadas</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={tablesManual} onChange={e=>setTablesManual(+e.target.value)} className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0}/>
                <span className="text-xs text-[#9CA3AF]">sugerido: {selected.tables_suggested}</span>
                <button onClick={()=>updateOrder(selected.id,{tables_confirmed:tablesManual})} className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">Guardar</button>
              </div></div>
            <div><label className="text-[11px] text-[#6B7280] font-medium">Camareros confirmados</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="number" value={waitersManual} onChange={e=>setWaitersManual(+e.target.value)} className="w-20 text-sm border border-[#E5E7EB] rounded-lg px-3 py-1.5" min={0}/>
                <span className="text-xs text-[#9CA3AF]">sugerido: {selected.waiters_suggested}</span>
                <button onClick={()=>updateOrder(selected.id,{waiters_confirmed:waitersManual})} className="ml-auto text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] transition-colors">Guardar</button>
              </div></div>
          </div>
        )}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A1A2E]">📋 Lista de Necesidades (Escandallo)</h3>
          {(!selected.shopping_list||selected.shopping_list.length===0) ? (
            <div className="text-center py-8 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-xl border border-dashed border-[#E5E7EB]">No hay datos de escandallo disponibles.</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#E5E7EB] bg-white">
              <table className="w-full"><thead><tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
                <th className="text-left text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Ingrediente</th>
                <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Gramos</th>
                <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">Unidades</th>
                <th className="text-right text-[10px] font-semibold text-[#6B7280] uppercase tracking-wide px-3 py-2.5">ML</th>
              </tr></thead><tbody>
                {selected.shopping_list.map((item:ShoppingItem,i:number) => (
                  <tr key={i} className="border-b border-[#F3F4F6]">
                    <td className="px-3 py-2.5 text-sm text-[#1A1A2E] font-medium">{item.ingredient_name}</td>
                    <td className="px-3 py-2.5 text-right text-sm text-[#6B7280]">{item.total_grams>0?`${Math.round(item.total_grams)}g`:'—'}</td>
                    <td className="px-3 py-2.5 text-right text-sm text-[#6B7280]">{item.total_units>0?`${Math.round(item.total_units)} ud`:'—'}</td>
                    <td className="px-3 py-2.5 text-right text-sm text-[#6B7280]">{item.total_ml>0?`${Math.round(item.total_ml)}ml`:'—'}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
        </div>
        {canComplete && (
          <div className="p-4 rounded-xl bg-white border border-[#E5E7EB] space-y-4">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">➕ Consumos Extra</h3>
            {extraItems.map((item,i) => (
              <div key={i} className="flex items-center gap-3">
                <input type="text" value={item.desc} placeholder="Descripción" onChange={e=>{const c=[...extraItems];c[i]={...c[i],desc:e.target.value};setExtraItems(c);}} className="flex-1 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2"/>
                <input type="number" value={item.amount||''} placeholder="Importe €" onChange={e=>{const c=[...extraItems];c[i]={...c[i],amount:+e.target.value};setExtraItems(c);}} className="w-28 text-sm border border-[#E5E7EB] rounded-lg px-3 py-2"/>
                <button onClick={()=>{if(extraItems.length>1) setExtraItems(extraItems.filter((_,idx)=>idx!==i));}} className="w-8 h-8 flex items-center justify-center rounded-lg border border-red-200 text-red-400 hover:bg-red-50">×</button>
              </div>
            ))}
            <button onClick={()=>setExtraItems([...extraItems,{desc:'',amount:0}])} className="text-[11px] font-medium text-[#2563EB] hover:text-[#1D4ED8] transition-colors">+ Añadir extra</button>
            <div className="pt-2"><button onClick={()=>setShowComplete(true)} className="w-full text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">✅ Marcar Evento como Completado</button></div>
          </div>
        )}
        {selected.selected_items && selected.selected_items.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[#1A1A2E]">🍽 Menú seleccionado</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {selected.selected_items.map((item:any,i:number) => (
                <div key={i} className="p-2.5 rounded-lg bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-xs text-[#1A1A2E] font-medium">{item.name||item.item_id}</p><p className="text-[10px] text-[#9CA3AF]">{item.category} · {item.quantity} ud</p></div>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence>
          {showComplete && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={e=>{if(e.target===e.currentTarget) setShowComplete(false);}}>
              <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="bg-white rounded-2xl p-6 shadow-xl max-w-md w-full mx-4 space-y-4">
                <h3 className="text-lg font-bold text-[#1A1A2E]">Finalizar Evento</h3>
                <p className="text-sm text-[#6B7280]">Al marcar como completado, el evento pasará a estado finalizado.
                  {extraItems.filter(e=>e.desc&&e.amount>0).length>0 && <span className="block mt-2 font-medium text-[#1A1A2E]">Se añadirán {money(extraItems.filter(e=>e.desc&&e.amount>0).reduce((s,e)=>s+e.amount,0))} en consumos extra.</span>}
                </p>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleComplete} className="flex-1 text-sm font-medium py-2.5 rounded-xl bg-[#15803D] text-white hover:bg-[#166534] transition-colors">✅ Finalizar Evento</button>
                  <button onClick={()=>setShowComplete(false)} className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">Cancelar</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  // ── Map View ─────────────────────────────────────────────────
  const renderMap = () => {
    const showBudgetInfo = selected && selected.guest_count > 0;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1A1A2E]">{selected ? `Mapa — ${selected.client_name}` : 'Mapa de Mesas'}</h1>
            <p className="text-xs text-[#6B7280]">{selected ? `${selected.event_type} · ${selected.guest_count} pax` : 'Selecciona un evento'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setViewTab('list')} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">Volver</button>
            {selected && <button onClick={saveLayout} disabled={saving} className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-[#1A1A2E] text-white hover:bg-[#2D2D44] disabled:opacity-60">{saving?'Guardando...':saved?'✓ Guardado':'Guardar'}</button>}
          </div>
        </div>
        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex-1">
            <div ref={containerRef} className="bg-white rounded-2xl border border-[#ECECF1] shadow overflow-hidden" style={{height:'calc(100vh - 260px)',minHeight:500}}>
              {!selected ? (
                <div className="flex items-center justify-center h-full text-sm text-[#6B7280]">Selecciona un evento de la lista para ver su mapa de mesas</div>
              ) : loadingDist ? (
                <div className="flex items-center justify-center h-full text-sm text-[#C9A84C]"><div className="w-6 h-6 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mr-3"/>Generando distribución de mesas...</div>
              ) : (
                <div ref={hallRef} className="relative bg-[#FAFAFC] border-2 border-dashed border-[#E0D3A8] m-4" style={{width:HALL_WIDTH,height:HALL_HEIGHT,transform:`scale(${scale})`,transformOrigin:'top left'}} onClick={()=>setSelectedId(null)} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
                    {Array.from({length:HALL_WIDTH/GRID_SIZE}).map((_,i)=><line key={`v${i}`} x1={i*GRID_SIZE} y1={0} x2={i*GRID_SIZE} y2={HALL_HEIGHT} stroke="#000" strokeWidth={0.5}/>)}
                    {Array.from({length:HALL_HEIGHT/GRID_SIZE}).map((_,i)=><line key={`h${i}`} x1={0} y1={i*GRID_SIZE} x2={HALL_WIDTH} y2={i*GRID_SIZE} stroke="#000" strokeWidth={0.5}/>)}
                  </svg>
                  {tables.map(table => {
                    const wObj = waiters.find(w => w.name === table.waiter);
                    return (
                      <div key={table.id} onMouseDown={e=>handleMouseDown(e,table.id)}
                        className={`absolute cursor-move select-none group transition-shadow ${selectedId===table.id?'ring-2 ring-[#C9A84C] ring-offset-1 z-10':'hover:shadow-lg'}`}
                        style={{left:table.x,top:table.y,width:table.width,height:table.height,transform:`rotate(${table.rotation}deg)`}}>
                        <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden" style={{backgroundColor:table.color,borderRadius:table.shape==='round'?'50%':table.shape==='long'?'8px':'6px'}}>
                          <div className="text-center"><div>{table.name}</div><div className="text-[9px] opacity-75">{table.capacity} pax</div>{wObj && <div className="text-[8px] opacity-90 mt-0.5" style={{color:'#FFF8DC'}}>{wObj.name}</div>}</div>
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white border-2 border-[#C9A84C] rounded-full cursor-se-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity" onMouseDown={e=>handleResizeStart(e,table.id)}/>
                        {selectedId===table.id && <>
                          <button onClick={e=>{e.stopPropagation();rotateTable(table.id);}} className="absolute -top-2 -left-2 w-5 h-5 bg-white border border-[#C9A84C] rounded-full text-[10px] flex items-center justify-center shadow-sm hover:bg-[#FBF6E9] z-20">↻</button>
                          <button onClick={e=>{e.stopPropagation();deleteTable(table.id);}} className="absolute -top-2 -right-2 w-5 h-5 bg-[#FEF2F2] border border-[#DC2626] rounded-full text-[10px] flex items-center justify-center shadow-sm hover:bg-[#FCE3E3] z-20">✕</button>
                        </>}
                      </div>
                    );
                  })}
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-[#9CA3AF] bg-[#FAFAFC] px-2">← Entrada →</div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-[#9CA3AF] bg-[#FAFAFC] px-2">Escenario / DJ</div>
                </div>
              )}
            </div>
          </div>
          <div className="w-full lg:w-72 space-y-4">
            {selectedTable ? (
              <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow">
                <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Propiedades</h3>
                <div className="space-y-3">
                  <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Nombre</label>
                    <input type="text" value={selectedTable.name} onChange={e=>setTables(prev=>prev.map(t=>t.id===selectedTable.id?{...t,name:e.target.value}:t))} className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"/></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Capacidad</label>
                      <input type="number" value={selectedTable.capacity} onChange={e=>setTables(prev=>prev.map(t=>t.id===selectedTable.id?{...t,capacity:parseInt(e.target.value)||0}:t))} className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"/></div>
                    <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Forma</label>
                      <select value={selectedTable.shape} onChange={e=>setTables(prev=>prev.map(t=>t.id===selectedTable.id?{...t,shape:e.target.value as any}:t))} className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]">
                        <option value="round">Redonda</option><option value="rect">Rectangular</option><option value="long">Alargada</option></select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Ancho</label>
                      <input type="number" value={selectedTable.width} onChange={e=>setTables(prev=>prev.map(t=>t.id===selectedTable.id?{...t,width:parseInt(e.target.value)||40}:t))} className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"/></div>
                    <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Alto</label>
                      <input type="number" value={selectedTable.height} onChange={e=>setTables(prev=>prev.map(t=>t.id===selectedTable.id?{...t,height:parseInt(e.target.value)||30}:t))} className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"/></div>
                  </div>
                  <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1"><Icon name="user" className="w-3 h-3 inline mr-1"/> Camarero</label>
                    <select value={selectedTable.waiter||''} onChange={e=>setTables(prev=>prev.map(t=>t.id===selectedTable.id?{...t,waiter:e.target.value}:t))} className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]">
                      <option value="">Sin asignar</option>{waiters.map(w=><option key={w.id} value={w.name}>{w.name} ({w.role})</option>)}</select></div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={()=>rotateTable(selectedTable.id)} className="flex-1 text-xs font-medium py-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F5F5F8] transition-colors flex items-center justify-center gap-1"><Icon name="rotateCw" className="w-3 h-3"/> Rotar</button>
                    <button onClick={()=>deleteTable(selectedTable.id)} className="flex-1 text-xs font-medium py-2 rounded-lg bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FCE3E3] transition-colors flex items-center justify-center gap-1"><Icon name="trash" className="w-3 h-3"/> Eliminar</button>
                  </div>
                </div>
              </div>
            ) : <div className="bg-white rounded-2xl border border-[#ECECF1] p-6 shadow"><p className="text-sm text-[#9CA3AF] text-center">Selecciona una mesa para editar</p></div>}

            {showBudgetInfo && (
              <div className="bg-[#FBF6E9] rounded-2xl border border-[#E0D3A8] p-4 shadow">
                <h3 className="font-semibold text-sm text-[#1A1A1A] mb-2 flex items-center gap-2"><Icon name="clipboard" className="w-4 h-4"/> Distribución sugerida</h3>
                <div className="text-xs text-[#6B7280] space-y-1">
                  <p className="font-medium text-[#1A1A1A]">{selected!.guest_count} invitados</p>
                  <p>Mesa principal: <strong>10 pax</strong></p>
                  <p>Mesas redondas: <strong>{Math.max(0,(selected!.tables_suggested)-1)} × 8 pax</strong></p>
                  {selected!.kids_count>0 && <p>Infantiles: <strong>{Math.ceil(selected!.kids_count/8)} × 8 pax</strong></p>}
                  <p className="mt-1 text-[#C9A84C]">Arrastra mesas para ajustar la disposición</p>
                </div>
              </div>
            )}
            {waiters.length > 0 && (
              <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow">
                <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3 flex items-center gap-2"><Icon name="user" className="w-4 h-4"/> Camareros ({waiters.length})</h3>
                <div className="space-y-1.5">
                  {waiters.map(w => { const assigned = tables.filter(t=>t.waiter===w.name);
                    return (<div key={w.id} className="flex items-center justify-between text-sm"><div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#C9A84C]"/><span className="text-[#1A1A1A]">{w.name}</span><span className="text-[11px] text-[#9CA3AF]">({w.role})</span></div>
                    <span className="text-[11px] font-medium text-[#6B7280]">{assigned.length>0?`${assigned.length} mesa${assigned.length>1?'s':''}`:'—'}</span></div>);
                  })}
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow">
              <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Resumen</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-[#6B7280]">Mesas totales</span><span className="font-semibold">{tables.length}</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Capacidad total</span><span className="font-semibold">{totalCapacity} pax</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Media por mesa</span><span className="font-semibold">{tables.length?Math.round(totalCapacity/tables.length):0} pax</span></div>
                <div className="flex justify-between"><span className="text-[#6B7280]">Mesas con camarero</span><span className="font-semibold text-[#C9A84C]">{tablesWithWtr} / {tables.length}</span></div>
              </div>
            </div>
            <div className="bg-[#FAF8F5] rounded-2xl border border-[#E0D3A8] p-4">
              <h3 className="font-semibold text-sm text-[#1A1A1A] mb-2">Cómo usar</h3>
              <ul className="text-xs text-[#6B7280] space-y-1">
                <li>• <strong>Arrastra</strong> una mesa para moverla</li>
                <li>• <strong>Selecciona</strong> para ver opciones</li>
                <li>• <strong>↻</strong> para rotar 90°</li>
                <li>• <strong>Esquina inf-der.</strong> para redimensionar</li>
                <li>• <strong>✕</strong> para eliminar</li>
                <li>• <strong>Camarero</strong> se edita en propiedades</li>
              </ul>
            </div>
          </div>
        </div>
        <AnimatePresence>
          {showAdd && (
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e=>{if(e.target===e.currentTarget) setShowAdd(false);}}>
              <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"/>
              <motion.div initial={{scale:0.95,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={e=>e.stopPropagation()}>
                <h3 className="font-serif text-lg text-[#1A1A1A]">Añadir mesa</h3>
                <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-2">Forma</label>
                  <div className="flex gap-2">{(['round','rect','long'] as const).map(s => (
                    <button key={s} onClick={()=>setNewShape(s)} className={`flex-1 text-[12px] py-2 rounded-xl border transition-all ${newShape===s?'text-white border-transparent':'bg-white text-[#6B7280] border-[#ECECF1]'}`} style={newShape===s?{background:'#C9A84C'}:{}}>{s==='round'?'Redonda':s==='rect'?'Rectangular':'Alargada'}</button>
                  ))}</div></div>
                <div><label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Capacidad</label>
                  <input type="number" value={newCapacity} onChange={e=>setNewCapacity(parseInt(e.target.value)||8)} className="w-full text-sm border border-[#ECECF1] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]" min="1"/></div>
                <div className="flex gap-3 pt-1">
                  <button onClick={()=>setShowAdd(false)} className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">Cancelar</button>
                  <button onClick={addTable} className="flex-1 text-sm font-medium text-white py-2.5 rounded-xl shadow-sm" style={{background:'linear-gradient(135deg, #C9A84C, #A88A3A)'}}>Añadir</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // ── List View ────────────────────────────────────────────────
  const renderList = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-[#1A1A2E]">Operaciones</h1><p className="text-xs text-[#6B7280]">Eventos activos, escandallos y logística</p></div>
        <div className="flex items-center gap-2">
          <button onClick={()=>setViewTab('list')} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">Lista</button>
          <button onClick={()=>setViewTab('map')} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">Mapa</button>
          <button onClick={fetchOrders} className="text-[11px] font-medium px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">↻</button>
        </div>
      </div>
      {orders.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-[#EFF4FF] border border-[#BFDBFE]"><p className="text-[10px] text-[#2563EB] uppercase tracking-wide font-semibold">En curso</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{orders.filter(o=>o.status==='in_progress').length}</p></div>
          <div className="p-4 rounded-xl bg-[#EFFAF2] border border-[#A7F3D0]"><p className="text-[10px] text-[#15803D] uppercase tracking-wide font-semibold">Completados</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{orders.filter(o=>o.status==='completed').length}</p></div>
          <div className="p-4 rounded-xl bg-[#FAF8F5] border border-[#E5E7EB]"><p className="text-[10px] text-[#6B7280] uppercase tracking-wide font-semibold">Total pax</p><p className="text-2xl font-bold text-[#1A1A2E] mt-1">{orders.reduce((s,o)=>s+(o.guest_count||0),0)}</p></div>
        </div>
      )}
      {loading ? <div className="text-center py-12 text-sm text-[#6B7280]">Cargando...</div> :
       orders.length === 0 ? <div className="text-center py-12 text-sm text-[#6B7280] bg-[#FAF8F5] rounded-2xl border border-dashed border-[#E5E7EB]">No hay órdenes de evento activas. Cuando un lead acepte un presupuesto, aparecerá aquí.</div> :
       <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
         <table className="w-full"><thead><tr className="border-b border-[#E5E7EB] bg-[#FAF8F5]">
           <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Cliente</th>
           <th className="text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Evento</th>
           <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Pax</th>
           <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Mesas</th>
           <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Camareros</th>
           <th className="text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Total</th>
           <th className="text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wide px-4 py-3">Estado</th>
         </tr></thead><tbody>
           {orders.map(o => (
             <tr key={o.id} onClick={()=>handleSelectOrder(o)} className="border-b border-[#F3F4F6] hover:bg-[#FAF8F5] cursor-pointer transition-colors">
               <td className="px-4 py-3.5"><p className="text-sm font-medium text-[#1A1A2E]">{o.client_name}</p><p className="text-[11px] text-[#9CA3AF]">{o.client_email}</p></td>
               <td className="px-4 py-3.5"><p className="text-sm text-[#1A1A2E]">{o.event_type}</p><p className="text-[11px] text-[#9CA3AF]">{fmtDate(o.event_date)}</p></td>
               <td className="px-4 py-3.5 text-center text-sm text-[#1A1A2E] font-medium">{o.guest_count}</td>
               <td className="px-4 py-3.5 text-center"><span className="text-sm font-medium text-[#1A1A2E]">{o.tables_confirmed||o.tables_suggested}</span><span className="text-[10px] text-[#9CA3AF] ml-1">/ {o.tables_suggested}</span></td>
               <td className="px-4 py-3.5 text-center"><span className="text-sm font-medium text-[#1A1A2E]">{o.waiters_confirmed||o.waiters_suggested}</span><span className="text-[10px] text-[#9CA3AF] ml-1">/ {o.waiters_suggested}</span></td>
               <td className="px-4 py-3.5 text-right text-sm font-medium text-[#1A1A2E]">{money(o.confirmed_price)}</td>
               <td className="px-4 py-3.5 text-center"><span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${o.status==='in_progress'?'bg-blue-50 text-blue-700 border-blue-200':o.status==='completed'?'bg-emerald-50 text-emerald-700 border-emerald-200':'bg-gray-50 text-gray-500 border-gray-200'}`}>{o.status==='in_progress'?'En curso':o.status==='completed'?'✅':o.status}</span></td>
             </tr>
           ))}
         </tbody></table>
       </div>
      }
    </div>
  );

  // ── Main Render ──────────────────────────────────────────────
  if (selected && viewTab !== 'map') return renderDetail();
  if (viewTab === 'map') return renderMap();
  return renderList();
}
