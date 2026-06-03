/**
 * J.Benitez — Mapa de Mesas Interactivo (Drag & Drop)
 * 
 * - Cargar/guardar mapa por operación (evento)
 * - Drag & drop, resize, rotate mesas
 * - Asignar camarero a cada mesa
 * - Visualización de camareros en el mapa
 */
'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../shared/Icon';

// ── Types ──────────────────────────────────────────────────────
interface TablePos {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  capacity: number;
  shape: 'round' | 'rect' | 'long';
  color: string;
  waiter: string;
}

interface Waiter {
  id: string;
  name: string;
  role: string;
}

interface DragState {
  tableId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
}

// ── Props ──────────────────────────────────────────────────────
interface MapaMesasProps {
  operationId?: string;
  eventId?: string;
  operationName?: string;
}

// ── Constants ──────────────────────────────────────────────────
const HALL_WIDTH = 800;
const HALL_HEIGHT = 600;
const GRID_SIZE = 10;

const TABLE_COLORS = [
  '#C9A84C', '#A88A3A', '#8B7355', '#D4A574', '#B8860B',
  '#6B8E23', '#4682B4', '#9370DB', '#CD5C5C', '#20B2AA',
];

const DEFAULT_TABLES: TablePos[] = [
  { id: 't1', name: 'Mesa Principal', x: 350, y: 250, width: 100, height: 60, rotation: 0, capacity: 10, shape: 'rect', color: '#C9A84C', waiter: '' },
  { id: 't2', name: 'Mesa 1', x: 100, y: 100, width: 60, height: 60, rotation: 0, capacity: 8, shape: 'round', color: '#4682B4', waiter: '' },
  { id: 't3', name: 'Mesa 2', x: 300, y: 80, width: 60, height: 60, rotation: 0, capacity: 8, shape: 'round', color: '#6B8E23', waiter: '' },
  { id: 't4', name: 'Mesa 3', x: 550, y: 100, width: 60, height: 60, rotation: 0, capacity: 8, shape: 'round', color: '#9370DB', waiter: '' },
  { id: 't5', name: 'Mesa 4', x: 150, y: 350, width: 60, height: 60, rotation: 0, capacity: 8, shape: 'round', color: '#CD5C5C', waiter: '' },
  { id: 't6', name: 'Mesa 5', x: 550, y: 350, width: 60, height: 60, rotation: 0, capacity: 8, shape: 'round', color: '#20B2AA', waiter: '' },
  { id: 't7', name: 'Mesa 6', x: 350, y: 450, width: 100, height: 40, rotation: 0, capacity: 12, shape: 'long', color: '#A88A3A', waiter: '' },
];

const INITIALS = 'Mesa';

// ── Helpers ────────────────────────────────────────────────────
function snap(val: number, grid: number): number {
  return Math.round(val / grid) * grid;
}

function nextId(tables: TablePos[]): string {
  let max = 0;
  tables.forEach((t) => {
    const num = parseInt(t.id.replace(/\D/g, ''), 10);
    if (num > max) max = num;
  });
  return `t${max + 1}`;
}

function nextName(tables: TablePos[]): string {
  let max = 0;
  tables.forEach((t) => {
    const match = t.name.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > max) max = num;
    }
  });
  return `${INITIALS} ${max + 1}`;
}

// ── Component ──────────────────────────────────────────────────
export default function MapaMesas({ operationId, eventId, operationName }: MapaMesasProps) {
  const [tables, setTables] = useState<TablePos[]>(DEFAULT_TABLES);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newShape, setNewShape] = useState<'round' | 'rect' | 'long'>('round');
  const [newCapacity, setNewCapacity] = useState(8);
  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [scale, setScale] = useState(1);
  const hallRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = tables.find((t) => t.id === selectedId) || null;
  const isEventMode = !!(operationId || eventId);
  const title = isEventMode ? `Mapa — ${operationName || 'Evento'}` : 'Mapa de Mesas';

  // ── Scale ────────────────────────────────────────────────────
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = (rect.width - 32) / HALL_WIDTH;
      const scaleY = (rect.height - 32) / HALL_HEIGHT;
      setScale(Math.min(scaleX, scaleY, 1.2));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);

  // ── Load layout + waiters ────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (eventId) params.set('event_id', eventId);
        const res = await fetch(`/api/floor-plan?${params}`);
        const data = await res.json();
        if (data.success && data.data) {
          // Ensure waiter field exists on loaded tables
          const tablesWithWaiters = (data.data as TablePos[]).map(t => ({
            ...t,
            waiter: t.waiter || '',
          }));
          setTables(tablesWithWaiters);
        }
      } catch { /* use defaults */ }
    };
    load();
  }, [eventId]);

  // ── Load waiters from event orders ───────────────────────────
  useEffect(() => {
    if (!operationId) return;
    const loadWaiters = async () => {
      try {
        const res = await fetch(`/api/event-orders/${operationId}/waiters`);
        const data = await res.json();
        if (data.success) {
          setWaiters(data.waiters || []);
        }
      } catch { /* no waiters */ }
    };
    loadWaiters();
  }, [operationId]);

  // ── Drag handlers ────────────────────────────────────────────
  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    setSelectedId(tableId);
    setDrag({
      tableId,
      startX: e.clientX,
      startY: e.clientY,
      origX: table.x,
      origY: table.y,
    });
  }, [tables]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return;
    const dx = (e.clientX - drag.startX) / scale;
    const dy = (e.clientY - drag.startY) / scale;
    setTables((prev) =>
      prev.map((t) =>
        t.id === drag.tableId
          ? { ...t, x: snap(drag.origX + dx, GRID_SIZE), y: snap(drag.origY + dy, GRID_SIZE) }
          : t
      )
    );
  }, [drag, scale]);

  const handleMouseUp = useCallback(() => setDrag(null), []);

  // ── Resize ───────────────────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent, tableId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = table.width;
    const origH = table.height;

    const handleMove = (me: MouseEvent) => {
      const dx = (me.clientX - startX) / scale;
      const dy = (me.clientY - startY) / scale;
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? { ...t, width: Math.max(40, snap(origW + dx, GRID_SIZE)), height: Math.max(30, snap(origH + dy, GRID_SIZE)) }
            : t
        )
      );
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  }, [tables, scale]);

  // ── Rotate ───────────────────────────────────────────────────
  const rotateTable = useCallback((tableId: string) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, width: t.height, height: t.width, rotation: (t.rotation + 90) % 360 }
          : t
      )
    );
  }, []);

  // ── Delete ───────────────────────────────────────────────────
  const deleteTable = useCallback((tableId: string) => {
    setTables((prev) => prev.filter((t) => t.id !== tableId));
    setSelectedId(null);
  }, []);

  // ── Add table ────────────────────────────────────────────────
  const addTable = useCallback(() => {
    const hall = hallRef.current;
    if (!hall) return;
    const rect = hall.getBoundingClientRect();
    const cx = (rect.width / 2 - 30) / scale;
    const cy = (rect.height / 2 - 30) / scale;
    const id = nextId(tables);
    const shape = newShape;
    const dims = shape === 'round' ? { width: 60, height: 60 }
      : shape === 'rect' ? { width: 80, height: 50 }
      : { width: 120, height: 40 };
    setTables((prev) => [
      ...prev,
      {
        id,
        name: nextName(prev),
        x: snap(cx, GRID_SIZE),
        y: snap(cy, GRID_SIZE),
        ...dims,
        rotation: 0,
        capacity: newCapacity,
        shape,
        color: TABLE_COLORS[prev.length % TABLE_COLORS.length],
        waiter: '',
      },
    ]);
    setShowAdd(false);
  }, [tables, newShape, newCapacity, scale]);

  // ── Save ─────────────────────────────────────────────────────
  const saveLayout = useCallback(async () => {
    setSaving(true);
    try {
      const params = new URLSearchParams();
      if (eventId) params.set('event_id', eventId);
      const res = await fetch(`/api/floor-plan?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      console.error('Failed to save floor plan:', e);
    } finally {
      setSaving(false);
    }
  }, [tables, eventId]);

  // ── Total capacity ───────────────────────────────────────────
  const totalCapacity = useMemo(() => tables.reduce((s, t) => s + t.capacity, 0), [tables]);
  const tablesWithWaiters = tables.filter(t => t.waiter && t.waiter.trim()).length;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {title}
          </h1>
          <p className="text-sm text-[#6B7280]">
            Arrastra las mesas para reorganizar el salón · {tables.length} mesas · {totalCapacity} comensales
            {isEventMode && <span className="ml-2 text-[#C9A84C] font-medium">· Evento activo</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="text-sm font-medium px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F5F5F8] transition-colors flex items-center gap-2"
          >
            <Icon name="plus" className="w-4 h-4" />
            Añadir mesa
          </button>
          <button
            onClick={saveLayout}
            disabled={saving}
            className="text-sm font-medium text-white px-4 py-2.5 rounded-xl shadow-sm disabled:opacity-60 flex items-center gap-2"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Floor plan */}
        <div className="flex-1">
          <div ref={containerRef} className="bg-white rounded-2xl border border-[#ECECF1] shadow-[0_1px_2px_rgba(16,24,40,0.04)] overflow-hidden">
            {/* Hall border */}
            <div
              ref={hallRef}
              className="relative bg-[#FAFAFC] border-2 border-dashed border-[#E0D3A8] m-4"
              style={{ width: HALL_WIDTH, height: HALL_HEIGHT, transform: `scale(${scale})`, transformOrigin: 'top left' }}
              onClick={() => setSelectedId(null)}
            >
              {/* Grid */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
                {Array.from({ length: HALL_WIDTH / GRID_SIZE }).map((_, i) => (
                  <line key={`v${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={HALL_HEIGHT} stroke="#000" strokeWidth={0.5} />
                ))}
                {Array.from({ length: HALL_HEIGHT / GRID_SIZE }).map((_, i) => (
                  <line key={`h${i}`} x1={0} y1={i * GRID_SIZE} x2={HALL_WIDTH} y2={i * GRID_SIZE} stroke="#000" strokeWidth={0.5} />
                ))}
              </svg>

              {/* Tables */}
              {tables.map((table) => {
                const waiterName = waiters.find(w => w.name === table.waiter)?.name || table.waiter;
                const waiterObj = waiters.find(w => w.name === table.waiter);
                return (
                  <div
                    key={table.id}
                    onMouseDown={(e) => handleMouseDown(e, table.id)}
                    className={`absolute cursor-move select-none group transition-shadow ${
                      selectedId === table.id ? 'ring-2 ring-[#C9A84C] ring-offset-1 z-10' : 'hover:shadow-lg'
                    }`}
                    style={{
                      left: table.x,
                      top: table.y,
                      width: table.width,
                      height: table.height,
                      transform: `rotate(${table.rotation}deg)`,
                    }}
                  >
                    {/* Table body */}
                    <div
                      className="w-full h-full flex items-center justify-center text-white text-[10px] font-semibold overflow-hidden"
                      style={{
                        backgroundColor: table.color,
                        borderRadius: table.shape === 'round' ? '50%' : table.shape === 'long' ? '8px' : '6px',
                      }}
                    >
                      <div className="text-center">
                        <div>{table.name}</div>
                        <div className="text-[9px] opacity-75">{table.capacity} pax</div>
                        {waiterObj && (
                          <div className="text-[8px] opacity-90 mt-0.5" style={{ color: '#FFF8DC' }}>
                            <Icon name="user" className="w-2.5 h-2.5 inline" /> {waiterObj.name}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resize handle */}
                    <div
                      className="absolute -bottom-1 -right-1 w-4 h-4 bg-white border-2 border-[#C9A84C] rounded-full cursor-se-resize z-20 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={(e) => handleResizeStart(e, table.id)}
                    />

                    {/* Delete button (on selected) */}
                    {selectedId === table.id && (
                      <>
                        <button
                          onClick={(e) => { e.stopPropagation(); rotateTable(table.id); }}
                          className="absolute -top-2 -left-2 w-5 h-5 bg-white border border-[#C9A84C] rounded-full text-[10px] flex items-center justify-center shadow-sm hover:bg-[#FBF6E9] z-20"
                          title="Rotar"
                        >
                          ↻
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTable(table.id); }}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-[#FEF2F2] border border-[#DC2626] rounded-full text-[10px] flex items-center justify-center shadow-sm hover:bg-[#FCE3E3] z-20"
                          title="Eliminar"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Entrance marker */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-[#9CA3AF] bg-[#FAFAFC] px-2">
                ← Entrada →
              </div>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[10px] text-[#9CA3AF] bg-[#FAFAFC] px-2">
                Escenario / DJ
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-72 space-y-4">
          {/* Selected table */}
          {selected ? (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Propiedades</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Nombre</label>
                  <input
                    type="text"
                    value={selected.name}
                    onChange={(e) => setTables((prev) => prev.map((t) => t.id === selected.id ? { ...t, name: e.target.value } : t))}
                    className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Capacidad</label>
                    <input
                      type="number"
                      value={selected.capacity}
                      onChange={(e) => setTables((prev) => prev.map((t) => t.id === selected.id ? { ...t, capacity: parseInt(e.target.value) || 0 } : t))}
                      className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Forma</label>
                    <select
                      value={selected.shape}
                      onChange={(e) => setTables((prev) => prev.map((t) => t.id === selected.id ? { ...t, shape: e.target.value as any } : t))}
                      className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                    >
                      <option value="round">Redonda</option>
                      <option value="rect">Rectangular</option>
                      <option value="long">Alargada</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Ancho</label>
                    <input
                      type="number"
                      value={selected.width}
                      onChange={(e) => setTables((prev) => prev.map((t) => t.id === selected.id ? { ...t, width: parseInt(e.target.value) || 40 } : t))}
                      className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Alto</label>
                    <input
                      type="number"
                      value={selected.height}
                      onChange={(e) => setTables((prev) => prev.map((t) => t.id === selected.id ? { ...t, height: parseInt(e.target.value) || 30 } : t))}
                      className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                    />
                  </div>
                </div>
                {/* Waiter assignment */}
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">
                    <Icon name="user" className="w-3 h-3 inline mr-1" />
                    Camarero asignado
                  </label>
                  <select
                    value={selected.waiter || ''}
                    onChange={(e) => setTables((prev) => prev.map((t) => t.id === selected.id ? { ...t, waiter: e.target.value } : t))}
                    className="w-full text-sm border border-[#ECECF1] rounded-xl px-3 py-2 focus:outline-none focus:border-[#C9A84C]"
                  >
                    <option value="">Sin asignar</option>
                    {waiters.map(w => (
                      <option key={w.id} value={w.name}>{w.name} ({w.role})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => rotateTable(selected.id)}
                    className="flex-1 text-xs font-medium py-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F5F5F8] transition-colors flex items-center justify-center gap-1"
                  >
                    <Icon name="rotateCw" className="w-3 h-3" /> Rotar
                  </button>
                  <button
                    onClick={() => deleteTable(selected.id)}
                    className="flex-1 text-xs font-medium py-2 rounded-lg bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FCE3E3] transition-colors flex items-center justify-center gap-1"
                  >
                    <Icon name="trash" className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <p className="text-sm text-[#9CA3AF] text-center">Selecciona una mesa para editar sus propiedades</p>
            </div>
          )}

          {/* Waiter legend */}
          {waiters.length > 0 && (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3 flex items-center gap-2">
                <Icon name="user" className="w-4 h-4" />
                Camareros ({waiters.length})
              </h3>
              <div className="space-y-1.5">
                {waiters.map(w => {
                  const assignedTables = tables.filter(t => t.waiter === w.name);
                  return (
                    <div key={w.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-[#C9A84C]" />
                        <span className="text-[#1A1A1A]">{w.name}</span>
                        <span className="text-[11px] text-[#9CA3AF]">({w.role})</span>
                      </div>
                      <span className="text-[11px] font-medium text-[#6B7280]">
                        {assignedTables.length > 0 ? `${assignedTables.length} mesa${assignedTables.length > 1 ? 's' : ''}` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <h3 className="font-semibold text-sm text-[#1A1A1A] mb-3">Resumen</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Mesas totales</span>
                <span className="font-semibold text-[#1A1A1A]">{tables.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Capacidad total</span>
                <span className="font-semibold text-[#1A1A1A]">{totalCapacity} pax</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Media por mesa</span>
                <span className="font-semibold text-[#1A1A1A]">{tables.length ? Math.round(totalCapacity / tables.length) : 0} pax</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7280]">Mesas con camarero</span>
                <span className="font-semibold text-[#C9A84C]">{tablesWithWaiters} / {tables.length}</span>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-[#FAF8F5] rounded-2xl border border-[#E0D3A8] p-4">
            <h3 className="font-semibold text-sm text-[#1A1A1A] mb-2">Cómo usar</h3>
            <ul className="text-xs text-[#6B7280] space-y-1">
              <li>• <strong>Arrastra</strong> una mesa para moverla</li>
              <li>• <strong>Selecciona</strong> una mesa para ver opciones</li>
              <li>• <strong>↻</strong> para rotar 90°</li>
              <li>• <strong>Esquina inf.-der.</strong> para redimensionar</li>
              <li>• <strong>✕</strong> para eliminar</li>
              <li>• <strong>Cam. asignado</strong> se edita en propiedades</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add table modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAdd(false); }}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-serif text-lg text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                Añadir mesa
              </h3>
              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-2">Forma</label>
                <div className="flex gap-2">
                  {(['round', 'rect', 'long'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setNewShape(s)}
                      className={`flex-1 text-[12px] py-2 rounded-xl border transition-all ${
                        newShape === s ? 'text-white border-transparent' : 'bg-white text-[#6B7280] border-[#ECECF1]'
                      }`}
                      style={newShape === s ? { background: '#C9A84C' } : {}}
                    >
                      {s === 'round' ? 'Redonda' : s === 'rect' ? 'Rectangular' : 'Alargada'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] uppercase tracking-wide mb-1">Capacidad</label>
                <input
                  type="number"
                  value={newCapacity}
                  onChange={(e) => setNewCapacity(parseInt(e.target.value) || 8)}
                  className="w-full text-sm border border-[#ECECF1] rounded-xl px-4 py-2.5 focus:outline-none focus:border-[#C9A84C]"
                  min="1"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowAdd(false)}
                  className="text-sm font-medium px-5 py-2.5 rounded-xl border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={addTable}
                  className="flex-1 text-sm font-medium text-white py-2.5 rounded-xl shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
                >
                  Añadir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}