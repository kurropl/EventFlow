'use client';
/**
 * J.Benitez — Mapa de Mesas Premium (SVG-based)
 *
 * Diseño inspirado en el HTML adjunto: oscuro/dorado, SVG con sillas,
 * grid canvas, pan/zoom, sidebar con plantillas y propiedades.
 *
 * Persiste en /api/mapa-mesas/[eventId].
 * Soporta auto-asignación de invitados a mesas.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────
interface TableData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'round' | 'rect' | 'long' | 'square';
  seats: number;
  label: string;
  rotation: number;
  occupied: number;
  assigned: string[];
  notes: string;
  color: string;
}

interface FloorPlanData {
  id: string;
  eventId?: string;
  name: string;
  tables: TableData[];
  elements: { type: string; x: number; y: number; label: string; }[];
}

// ─── Constants ──────────────────────────────────────────────────────
const TABLE_COLORS = [
  '#C9A84C', '#8B7332', '#6B7B8B', '#7B8B7B', '#8B7B8B', '#8B8B7B',
  '#5B8B8B', '#8B5B8B', '#8B8B5B', '#5B5B8B', '#8B5B5B', '#5B8B5B'
];

const TEMPLATES = [
  { type: 'round' as const, label: 'Mesa Redonda', seats: 8, detail: '8 comensales', w: 70, h: 70 },
  { type: 'square' as const, label: 'Mesa Cuadrada', seats: 4, detail: '4 comensales', w: 60, h: 60 },
  { type: 'rect' as const, label: 'Mesa Rectangular', seats: 6, detail: '6 comensales', w: 100, h: 50 },
  { type: 'long' as const, label: 'Mesa Larga', seats: 10, detail: '10 comensales', w: 140, h: 45 },
];

const GRID_SIZE = 40;
const CANVAS_W = 2400;
const CANVAS_H = 1800;

// ─── Seat SVG helper ────────────────────────────────────────────────
function SeatIcon({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${angle})`}>
      <rect x="-6" y="-8" width="12" height="14" rx="3"
        fill="#F8F3E6" stroke="#C9A84C" strokeWidth="1.5" />
    </g>
  );
}

// ─── Table SVG Component ────────────────────────────────────────────
function TableSVG({ table, selected, onSelect }: {
  table: TableData;
  selected: boolean;
  onSelect: () => void;
}) {
  const cx = table.width / 2;
  const cy = table.height / 2;
  const fill = selected ? '#6B2737' : (table.color || '#C9A84C');
  const stroke = selected ? '#8B3A4A' : fill;
  const textColor = selected ? '#F8F3E6' : '#2A2118';

  const renderShape = () => {
    if (table.type === 'round') {
      return <circle cx={cx} cy={cy} r={cx} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 1.5} />;
    }
    if (table.type === 'long') {
      return (
        <rect x={2} y={2} width={table.width - 4} height={table.height - 4} rx={12}
          fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 1.5} />
      );
    }
    return (
      <rect x={2} y={2} width={table.width - 4} height={table.height - 4} rx={8}
        fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 1.5} />
    );
  };

  // Position seats around the table
  const renderSeats = () => {
    const seats: JSX.Element[] = [];
    const n = table.seats;
    const r = table.type === 'round' ? cx + 8 : Math.max(cx, cy) + 8;

    for (let i = 0; i < n; i++) {
      const angle = (360 / n) * i - 90;
      const rad = (angle * Math.PI) / 180;
      const sx = cx + r * Math.cos(rad);
      const sy = cy + r * Math.sin(rad);
      seats.push(<SeatIcon key={i} x={sx} y={sy} angle={angle + 90} />);
    }
    return seats;
  };

  return (
    <g
      className="cursor-grab active:cursor-grabbing"
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      style={{ transition: 'filter 0.15s' }}
    >
      {renderShape()}
      {renderSeats()}

      {/* Table label */}
      <text
        x={cx} y={cy - 6}
        textAnchor="middle"
        className={`font-serif text-xs font-semibold`}
        fill={textColor}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
      >
        {table.label}
      </text>
      <text
        x={cx} y={cy + 8}
        textAnchor="middle"
        className="text-[10px]"
        fill={textColor}
        opacity={0.7}
      >
        {table.seats} comensales
      </text>

      {/* Resize handles when selected */}
      {selected && (
        <>
          <circle cx={2} cy={2} r={5} fill="#6B2737" stroke="#F8F3E6" strokeWidth={2}
            className="cursor-nw-resize" />
          <circle cx={table.width - 2} cy={2} r={5} fill="#6B2737" stroke="#F8F3E6" strokeWidth={2}
            className="cursor-ne-resize" />
          <circle cx={table.width - 2} cy={table.height - 2} r={5} fill="#6B2737" stroke="#F8F3E6" strokeWidth={2}
            className="cursor-se-resize" />
          <circle cx={2} cy={table.height - 2} r={5} fill="#6B2737" stroke="#F8F3E6" strokeWidth={2}
            className="cursor-sw-resize" />
          {/* Rotation handle */}
          <circle cx={cx} cy={-16} r={5} fill="#C9A84C" stroke="#F8F3E6" strokeWidth={2}
            className="cursor-alias" />
        </>
      )}

      {/* Seat count badge */}
      <rect x={cx - 10} y={-cy - 12} width={20} height={12} rx={6}
        fill={selected ? '#C9A84C' : '#F8F3E6'} opacity={0.9} />
      <text x={cx} y={-cy - 3}
        textAnchor="middle" className="text-[8px] font-bold"
        fill={selected ? '#1A1208' : '#6B2737'}>
        {table.seats}
      </text>
    </g>
  );
}

// ─── Main Component ─────────────────────────────────────────────
interface MapEditorProps {
  eventId?: string;
  eventName?: string;
  readOnly?: boolean;
  onSave?: (data: { tables: TableData[]; elements: any[] }) => void;
}

export default function PremiumTableMapEditor({ eventId, eventName, readOnly, onSave }: MapEditorProps) {
  const [tables, setTables] = useState<TableData[]>([]);
  const [elements, setElements] = useState<{ type: string; x: number; y: number; label: string }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [zoom, setZoom] = useState(0.65);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showTemplates, setShowTemplates] = useState(true);
  const [name, setName] = useState(eventName || 'Salón de Celebraciones');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const selectedTable = tables.find(t => t.id === selectedId);

  // ── Add table from template ──
  const addTable = (type: TableData['type'], seats: number, w: number, h: number) => {
    const newTable: TableData = {
      id: `table-${Date.now()}`,
      x: 200 + Math.random() * 400,
      y: 200 + Math.random() * 300,
      width: w, height: h,
      type,
      seats,
      label: `${type === 'round' ? 'R' : type === 'long' ? 'L' : 'M'}${tables.length + 1}`,
      rotation: 0,
      occupied: 0,
      assigned: [],
      notes: '',
      color: TABLE_COLORS[tables.length % TABLE_COLORS.length],
    };
    setTables(prev => [...prev, newTable]);
    setSelectedId(newTable.id);
  };

  // ── Drag table ──
  const handleTableMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    if (readOnly) return;
    e.stopPropagation();
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    setDragging(tableId);
    setSelectedId(tableId);
    setDragStart({ x: e.clientX - table.x, y: e.clientY - table.y });
  }, [tables, readOnly]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging && !readOnly) {
      const x = (e.clientX - dragStart.x) / zoom;
      const y = (e.clientY - dragStart.y) / zoom;
      setTables(prev => prev.map(t =>
        t.id === dragging ? { ...t, x: Math.max(0, x), y: Math.max(0, y) } : t
      ));
    }
    if (isPanning) {
      setPan(prev => ({
        x: prev.x + e.movementX,
        y: prev.y + e.movementY,
      }));
    }
  }, [dragging, dragStart, zoom, isPanning, readOnly]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
  }, []);

  // ── Update table ──
  const updateTable = (id: string, updates: Partial<TableData>) => {
    setTables(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setTables(prev => prev.filter(t => t.id !== selectedId));
    setSelectedId(null);
  };

  // ── Canvas click to deselect ──
  const handleCanvasClick = () => {
    setSelectedId(null);
  };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId && !readOnly && !(e.target instanceof HTMLInputElement)) {
          deleteSelected();
        }
      }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedId, readOnly]);

  // ── Save to API ──
  const handleSave = async () => {
    if (!eventId) {
      if (onSave) onSave({ tables, elements });
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch(`/api/mapa-mesas/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, tables, elements }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage('Guardado');
        setTimeout(() => setSaveMessage(null), 2000);
      } else {
        setSaveMessage('Error al guardar');
      }
    } catch {
      setSaveMessage('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // ── Auto-asignar invitados ──
  const handleAutoAssign = async () => {
    if (!eventId) return;
    setAutoAssigning(true);
    try {
      const res = await fetch(`/api/mapa-mesas/${eventId}/assignments/auto`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        // Recargar contadores de ocupados
        const mapRes = await fetch(`/api/mapa-mesas/${eventId}`);
        const mapData = await mapRes.json();
        if (mapData.success && mapData.data) {
          setTables(mapData.data.tables || []);
        }
        setSaveMessage(`${data.assigned} invitados asignados`);
        setTimeout(() => setSaveMessage(null), 3000);
      }
    } catch {
      setSaveMessage('Error al auto-asignar');
    } finally {
      setAutoAssigning(false);
    }
  };

  // ── Load from API ──
  useEffect(() => {
    if (!eventId) return;
    setLoading(true);
    fetch(`/api/mapa-mesas/${eventId}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          setTables(data.data.tables || []);
          setElements(data.data.elements || []);
          setName(data.data.name || eventName || '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Cargar invitados confirmados
    fetch(`/api/guests?eventId=${eventId}&status=confirmed&limit=1`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.total !== undefined) {
          setGuestCount(data.total);
        }
      })
      .catch(() => {});
  }, [eventId, eventName]);

  // Stats
  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);
  const totalOccupied = tables.reduce((s, t) => s + t.occupied, 0);

  return (
    <div className="h-full flex flex-col bg-[#F6F1E7]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Print stylesheet ── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
          }
          header, footer, aside, .no-print {
            display: none !important;
          }
          svg {
            max-width: 100%;
            height: auto;
          }
          @page {
            margin: 1cm;
            size: A4 landscape;
          }
        }
      `}</style>
      {/* ── Header ── */}
      <header className="bg-[#0D0A06] border-b-2 border-[#D4A548] px-6 py-3 flex items-center justify-between z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-[#D4A548] flex items-center justify-center
            font-serif italic text-lg text-[#D4A548] font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
            J
          </div>
          <div>
            <h1 className="font-serif text-lg text-[#D4A548] font-semibold" style={{ fontFamily: "'Playfair Display', serif" }}>
              Mapa de Mesas
            </h1>
            <p className="text-[10px] text-[#D4A548] opacity-60 tracking-widest uppercase">
              {name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {saveMessage && (
            <span className="text-[#D4A548] text-xs font-medium bg-[#D4A548]/10 px-3 py-1 rounded-lg">
              {saveMessage}
            </span>
          )}
          {guestCount > 0 && (
            <span className="text-[#D4A548]/60 text-xs hidden sm:inline">
              {guestCount} invitados
            </span>
          )}
          {loading && <span className="text-[#D4A548]/40 text-xs">Cargando...</span>}
          {!readOnly && (
            <>
              {eventId && tables.length > 0 && (
                <button onClick={handleAutoAssign} disabled={autoAssigning}
                  className="px-3 py-1.5 rounded border border-[#D4A548]/40 text-[#D4A548] text-[10px] uppercase tracking-wider
                    hover:bg-[#D4A548]/15 disabled:opacity-50 transition-colors">
                  {autoAssigning ? 'Asignando...' : 'Auto-asignar'}
                </button>
              )}
              <button onClick={() => window.print()}
                className="px-3 py-1.5 rounded border border-stone-500/30 text-stone-400 text-[10px] uppercase tracking-wider
                  hover:bg-stone-800 transition-colors hidden md:inline-flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
                </svg>
                PDF
              </button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 rounded bg-[#D4A548] text-[#1A1208] text-xs font-bold uppercase tracking-wider
                  hover:bg-[#F0C060] disabled:opacity-50 transition-colors">
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 grid grid-cols-[280px_1fr_280px] overflow-hidden">
        {/* ── Left sidebar: Templates & Stats ── */}
        <aside className="bg-[#FBF8F1] border-r border-[#C9A84C]/20 p-5 overflow-y-auto">
          <h2 className="font-serif text-base text-[#6B2737] font-semibold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
            Mobiliario
          </h2>
          <p className="text-[10px] text-[#5A4A38] uppercase tracking-wider mb-4 pb-3 border-b border-[#C9A84C]/30">
            Arrastra al plano
          </p>

          <div className="space-y-2.5">
            {TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                onClick={() => addTable(tpl.type, tpl.seats, tpl.w, tpl.h)}
                disabled={readOnly}
                className="w-full flex items-center gap-3 p-3 rounded-md border border-[#C9A84C]/30 bg-[#FBF8F1]
                  hover:border-[#C9A84C] hover:bg-[#EFE7D6] transition-all cursor-grab active:cursor-grabbing
                  disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                  <svg width="32" height="32" viewBox="0 0 40 40">
                    {tpl.type === 'round' ? (
                      <circle cx="20" cy="20" r="15" fill="#C9A84C" fillOpacity="0.3" stroke="#C9A84C" strokeWidth="2" />
                    ) : tpl.type === 'long' ? (
                      <rect x="2" y="12" width="36" height="16" rx="4" fill="#C9A84C" fillOpacity="0.3" stroke="#C9A84C" strokeWidth="2" />
                    ) : tpl.type === 'square' ? (
                      <rect x="6" y="6" width="28" height="28" rx="4" fill="#C9A84C" fillOpacity="0.3" stroke="#C9A84C" strokeWidth="2" />
                    ) : (
                      <rect x="4" y="10" width="32" height="20" rx="4" fill="#C9A84C" fillOpacity="0.3" stroke="#C9A84C" strokeWidth="2" />
                    )}
                  </svg>
                </div>
                <div className="text-left flex-1">
                  <div className="font-semibold text-[13px] text-[#2A2118]">{tpl.label}</div>
                  <div className="text-[11px] text-[#5A4A38]">{tpl.detail}</div>
                </div>
              </button>
            ))}
          </div>

          {/* ── Stats ── */}
          <div className="mt-8 pt-6 border-t border-[#C9A84C]/20">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#EFE7D6] p-2.5 rounded border-l-[3px] border-[#C9A84C]">
                <div className="font-serif text-xl text-[#6B2737] font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {tables.length}
                </div>
                <div className="text-[10px] text-[#5A4A38] uppercase tracking-wide">Mesas</div>
              </div>
              <div className="bg-[#EFE7D6] p-2.5 rounded border-l-[3px] border-[#C9A84C]">
                <div className="font-serif text-xl text-[#6B2737] font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {totalSeats}
                </div>
                <div className="text-[10px] text-[#5A4A38] uppercase tracking-wide">Comensales</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Canvas ── */}
        <div
          ref={canvasRef}
          className="relative overflow-hidden print-area"
          style={{ background: '#F6F1E7' }}
          onMouseDown={() => {}}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          {/* Toolbar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1
            bg-[#FBF8F1] border border-[#C9A84C]/30 rounded-md px-1 py-1 shadow-lg">
            <button
              onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#EFE7D6] text-[#5A4A38] text-sm font-medium"
            >
              +
            </button>
            <span className="px-2 text-xs text-[#5A4A38] font-medium min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#EFE7D6] text-[#5A4A38] text-sm font-medium"
            >
              −
            </button>
            <div className="w-px h-5 bg-[#C9A84C]/30 mx-1" />
            <button
              onClick={() => setZoom(0.65)}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#EFE7D6] text-[#5A4A38] text-xs"
              title="Ajustar"
            >
              ⊞
            </button>
            <div className="w-px h-5 bg-[#C9A84C]/30 mx-1" />
            <button
              onClick={() => setIsPanning(!isPanning)}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs transition-colors
                ${isPanning ? 'bg-[#6B2737] text-[#F6F1E7]' : 'hover:bg-[#EFE7D6] text-[#5A4A38]'}`}
              title="Mano"
            >
              ✋
            </button>
          </div>

          {/* Head table marker */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-5 text-[#8A6A28] font-serif italic text-xs
            tracking-widest uppercase opacity-40 pointer-events-none"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            <span className="inline-block w-8 h-px bg-[#8A6A28] align-middle mr-3" />
            mesa principal
            <span className="inline-block w-8 h-px bg-[#8A6A28] align-middle ml-3" />
          </div>

          {/* Transform wrapper */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: CANVAS_W,
              height: CANVAS_H,
              position: 'absolute',
              top: 0, left: 0,
            }}
          >
            {/* Grid SVG */}
            <svg
              ref={svgRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ 
                background: '#FBF8F1',
                backgroundImage: `
                  linear-gradient(rgba(176, 138, 62, 0.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(176, 138, 62, 0.06) 1px, transparent 1px)
                `,
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                boxShadow: '0 0 0 1px rgba(176, 138, 62, 0.2), 0 8px 40px rgba(60, 40, 20, 0.12)',
              }}
            >
              {tables.map((table) => (
                <g
                  key={table.id}
                  transform={`translate(${table.x}, ${table.y})`}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleTableMouseDown(e as any, table.id);
                  }}
                >
                  <TableSVG table={table} selected={table.id === selectedId} onSelect={() => setSelectedId(table.id)} />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* ── Right sidebar: Properties ── */}
        <aside className="bg-[#FBF8F1] border-l border-[#C9A84C]/20 p-5 overflow-y-auto">
          {selectedTable ? (
            <>
              <h2 className="font-serif text-base text-[#6B2737] font-semibold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                {selectedTable.label}
              </h2>
              <p className="text-[10px] text-[#5A4A38] uppercase tracking-wider mb-4 pb-3 border-b border-[#C9A84C]/30">
                Propiedades de la mesa
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-[#5A4A38] block mb-1.5">Etiqueta</label>
                  <input
                    type="text"
                    value={selectedTable.label}
                    onChange={(e) => updateTable(selectedTable.id, { label: e.target.value })}
                    disabled={readOnly}
                    className="w-full px-3 py-2 rounded border border-[#C9A84C]/30 bg-white text-sm text-[#2A2118]
                      focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#5A4A38] block mb-1.5">Comensales</label>
                  <input
                    type="number"
                    value={selectedTable.seats}
                    onChange={(e) => updateTable(selectedTable.id, { seats: Math.max(1, parseInt(e.target.value) || 1) })}
                    disabled={readOnly}
                    className="w-full px-3 py-2 rounded border border-[#C9A84C]/30 bg-white text-sm text-[#2A2118]
                      focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C]"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[#5A4A38] block mb-1.5">Color</label>
                  <div className="flex flex-wrap gap-2">
                    {TABLE_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => updateTable(selectedTable.id, { color })}
                        disabled={readOnly}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${
                          selectedTable.color === color ? 'border-[#2A2118] scale-110' : 'border-[#C9A84C]/20'
                        }`}
                        style={{ background: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-[#5A4A38] block mb-1.5">Notas</label>
                  <textarea
                    value={selectedTable.notes}
                    onChange={(e) => updateTable(selectedTable.id, { notes: e.target.value })}
                    disabled={readOnly}
                    rows={2}
                    className="w-full px-3 py-2 rounded border border-[#C9A84C]/30 bg-white text-sm text-[#2A2118]
                      focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] resize-none"
                  />
                </div>

                {!readOnly && (
                  <div className="pt-4 border-t border-[#C9A84C]/20">
                    <button
                      onClick={deleteSelected}
                      className="w-full px-4 py-2 rounded bg-red-600 text-white text-xs font-medium
                        hover:bg-red-700 transition-colors uppercase tracking-wider"
                    >
                      Eliminar Mesa
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <div className="w-12 h-12 rounded-full bg-[#EFE7D6] flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
              </div>
              <p className="text-sm text-[#5A4A38] max-w-[180px]">
                Selecciona una mesa para editar sus propiedades
              </p>
            </div>
          )}
        </aside>
      </main>

      {/* ── Footer ── */}
      <footer className="px-6 py-2.5 bg-[#FBF8F1] border-t border-[#C9A84C]/20 flex items-center justify-between text-xs text-[#5A4A38]">
        <span>{tables.length} mesas | {totalSeats} plazas</span>
        <span className="opacity-60">{totalOccupied} ocupados | {totalSeats - totalOccupied} libres
          {guestCount > 0 && <span className="ml-3">| {guestCount} invitados confirmados</span>}
        </span>
      </footer>
    </div>
  );
}