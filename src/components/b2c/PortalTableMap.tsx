'use client';
/**
 * EventFlow — PortalTableMap
 *
 * Versión restringida del mapa de mesas para el portal del cliente.
 * - Plano en SOLO LECTURA (no se puede editar/mover mesas)
 * - Se puede asignar/mover invitados entre mesas
 * - Solo invitados confirmados son asignables
 * - Aforo de mesa no superable
 * - Drag & drop de invitados a mesas
 *
 * WP-27: Portal — Distribución de Mesas
 */

import { useState, useRef, useCallback, useEffect } from 'react';

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
  notes: string;
  color: string;
}

interface GuestData {
  id: string;
  name: string;
  groupName: string | null;
  menuType: string;
  dietary: any[];
  notes: string | null;
}

interface AssignmentData {
  id: string;
  tableId: string;
  guestId: string;
  guestName: string;
  seatNumber: number;
  dietaryNotes: string | null;
}

interface PortalTableMapProps {
  tables: TableData[];
  guests: GuestData[];
  assignments: AssignmentData[];
  isFrozen: boolean;
  floorplanName: string;
  onSave: (assignments: { tableId: string; guestId: string; seatNumber?: number }[]) => Promise<void>;
}

// ─── Constants ──────────────────────────────────────────────────────
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

// ─── Table SVG (read-only) ─────────────────────────────────────────
function TableSVGReadOnly({ table, isDropTarget, guestCount }: {
  table: TableData;
  isDropTarget: boolean;
  guestCount: number;
}) {
  const cx = table.width / 2;
  const cy = table.height / 2;
  const isFull = guestCount >= table.seats;
  const fill = isDropTarget ? '#4A7C59' : (isFull ? '#8B7B6B' : (table.color || '#C9A84C'));
  const stroke = isDropTarget ? '#5A9C69' : fill;

  const renderShape = () => {
    if (table.type === 'round') {
      return <circle cx={cx} cy={cy} r={cx} fill={fill} stroke={stroke} strokeWidth={2} />;
    }
    return (
      <rect x={2} y={2} width={table.width - 4} height={table.height - 4}
        rx={table.type === 'long' ? 12 : 8}
        fill={fill} stroke={stroke} strokeWidth={2} />
    );
  };

  const renderSeats = () => {
    const seats: JSX.Element[] = [];
    const n = table.seats;
    const r = table.type === 'round' ? cx + 8 : Math.max(cx, cy) + 8;

    for (let i = 0; i < n; i++) {
      const angle = (360 / n) * i - 90;
      const rad = (angle * Math.PI) / 180;
      seats.push(
        <SeatIcon key={i} x={cx + r * Math.cos(rad)} y={cy + r * Math.sin(rad)} angle={angle + 90} />
      );
    }
    return seats;
  };

  const textColor = '#2A2118';

  return (
    <g>
      {renderShape()}
      {renderSeats()}

      <text x={cx} y={cy - 6} textAnchor="middle"
        className="font-serif text-xs font-semibold" fill={textColor}
        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        {table.label}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle"
        className="text-[10px]" fill={textColor} opacity={0.7}>
        {guestCount}/{table.seats}
      </text>

      {/* Badge de ocupación */}
      <rect x={cx - 10} y={-cy - 12} width={20} height={12} rx={6}
        fill={isFull ? '#8B5B5B' : '#C9A84C'} opacity={0.9} />
      <text x={cx} y={-cy - 3} textAnchor="middle"
        className="text-[8px] font-bold" fill={isFull ? '#F8F3E6' : '#1A1208'}>
        {guestCount}
      </text>
    </g>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
export default function PortalTableMap({
  tables,
  guests,
  assignments,
  isFrozen,
  floorplanName,
  onSave,
}: PortalTableMapProps) {
  const [zoom, setZoom] = useState(0.55);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [draggingGuest, setDraggingGuest] = useState<string | null>(null);
  const [hoveredTable, setHoveredTable] = useState<string | null>(null);
  const [localAssignments, setLocalAssignments] = useState<AssignmentData[]>(assignments);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Sincronizar con props externos
  useEffect(() => {
    setLocalAssignments(assignments);
  }, [assignments]);

  // ── Guests no asignados ──
  const assignedGuestIds = new Set(localAssignments.map(a => a.guestId));
  const unassignedGuests = guests.filter(g => !assignedGuestIds.has(g.id));

  // ── Guests por mesa ──
  const guestsByTable: Record<string, AssignmentData[]> = {};
  for (const a of localAssignments) {
    if (!guestsByTable[a.tableId]) guestsByTable[a.tableId] = [];
    guestsByTable[a.tableId].push(a);
  }

  // ── Mouse handlers para pan ──
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 && !draggingGuest) {
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    }
  }, [draggingGuest, pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── Drag & Drop: start ──
  const handleDragStart = useCallback((guestId: string) => {
    if (isFrozen) return;
    setDraggingGuest(guestId);
  }, [isFrozen]);

  // ── Drag & Drop: drop on table ──
  const handleTableClick = useCallback((tableId: string) => {
    if (isFrozen) return;

    if (draggingGuest) {
      // Asignar guest a esta mesa
      const table = tables.find(t => t.id === tableId);
      if (!table) return;

      const currentCount = (guestsByTable[tableId] || []).length;
      if (currentCount >= table.seats) {
        setSaveMsg('Mesa llena');
        setTimeout(() => setSaveMsg(null), 2000);
        return;
      }

      // Remover de mesa anterior si ya estaba asignado
      const newAssignments = localAssignments.filter(a => a.guestId !== draggingGuest);
      newAssignments.push({
        id: `temp-${Date.now()}`,
        tableId,
        guestId: draggingGuest,
        guestName: guests.find(g => g.id === draggingGuest)?.name || '',
        seatNumber: currentCount + 1,
        dietaryNotes: null,
      });

      setLocalAssignments(newAssignments);
      setDraggingGuest(null);
    } else {
      // Seleccionar mesa para ver detalles
      setSelectedTableId(selectedTableId === tableId ? null : tableId);
    }
  }, [draggingGuest, tables, guestsByTable, localAssignments, guests, isFrozen, selectedTableId]);

  // ── Drag & Drop: drop on unassigned zone (remove from table) ──
  const handleRemoveFromTable = useCallback((guestId: string) => {
    if (isFrozen) return;
    setLocalAssignments(prev => prev.filter(a => a.guestId !== guestId));
  }, [isFrozen]);

  // ── Guardar ──
  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      await onSave(
        localAssignments.map(a => ({
          tableId: a.tableId,
          guestId: a.guestId,
          seatNumber: a.seatNumber,
        }))
      );
      setSaveMsg('Guardado ✓');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch {
      setSaveMsg('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // ── Stats ──
  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);
  const totalAssigned = localAssignments.length;

  // ── Mesa seleccionada ──
  const selectedTable = tables.find(t => t.id === selectedTableId);
  const selectedGuests = selectedTableId ? (guestsByTable[selectedTableId] || []) : [];

  return (
    <div className="h-full flex flex-col bg-[#F6F1E7]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* ── Header ── */}
      <header className="px-6 py-3 bg-[#FBF8F1] border-b border-[#C9A84C]/20 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-lg text-[#6B2737] font-semibold"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Distribución de Mesas
          </h1>
          <p className="text-[11px] text-[#5A4A38]">{floorplanName}</p>
        </div>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className="text-xs font-medium bg-[#C9A84C]/10 px-3 py-1 rounded">
              {saveMsg}
            </span>
          )}
          {!isFrozen && (
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 rounded bg-[#C9A84C] text-[#1A1208] text-xs font-bold uppercase tracking-wider
                hover:bg-[#F0C060] disabled:opacity-50 transition-colors">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          )}
          {isFrozen && (
            <span className="text-xs text-[#8B5B5B] font-medium bg-[#8B5B5B]/10 px-3 py-1 rounded">
              🔒 Congelado — Solo lectura
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar izquierdo: Invitados sin asignar ── */}
        <aside className="w-64 bg-[#FBF8F1] border-r border-[#C9A84C]/20 p-4 overflow-y-auto flex-shrink-0">
          <h2 className="font-serif text-sm text-[#6B2737] font-semibold mb-1"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Invitados
          </h2>
          <p className="text-[10px] text-[#5A4A38] uppercase tracking-wider mb-3 pb-2 border-b border-[#C9A84C]/30">
            {unassignedGuests.length} sin asignar
          </p>

          <div className="space-y-1.5">
            {unassignedGuests.map(guest => (
              <div
                key={guest.id}
                draggable={!isFrozen}
                onDragStart={() => handleDragStart(guest.id)}
                className={`p-2.5 rounded border border-[#C9A84C]/30 bg-white text-sm
                  ${isFrozen
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-grab active:cursor-grabbing hover:border-[#C9A84C] hover:bg-[#EFE7D6] transition-all'
                  }`}
              >
                <div className="font-medium text-[#2A2118] text-xs">{guest.name}</div>
                <div className="text-[10px] text-[#5A4A38] mt-0.5">
                  {guest.menuType === 'nino' ? '👶' : guest.menuType === 'bebe' ? '🍼' : ''}
                  {guest.groupName && <span className="ml-1 opacity-70">· {guest.groupName}</span>}
                </div>
                {guest.dietary && guest.dietary.length > 0 && (
                  <div className="text-[9px] text-[#6B2737] mt-1">
                    ⚠ {Array.isArray(guest.dietary) ? guest.dietary.join(', ') : ''}
                  </div>
                )}
              </div>
            ))}
            {unassignedGuests.length === 0 && (
              <p className="text-xs text-[#5A4A38] italic py-4 text-center">
                Todos los invitados están asignados
              </p>
            )}
          </div>

          {/* ── Stats ── */}
          <div className="mt-6 pt-4 border-t border-[#C9A84C]/20">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#EFE7D6] p-2 rounded border-l-[3px] border-[#C9A84C]">
                <div className="font-serif text-lg text-[#6B2737] font-bold"
                  style={{ fontFamily: "'Playfair Display', serif" }}>
                  {totalAssigned}
                </div>
                <div className="text-[9px] text-[#5A4A38] uppercase">Asignados</div>
              </div>
              <div className="bg-[#EFE7D6] p-2 rounded border-l-[3px] border-[#C9A84C]">
                <div className="font-serif text-lg text-[#6B2737] font-bold"
                  style={{ fontFamily: "'Playfair Display', serif" }}>
                  {totalSeats}
                </div>
                <div className="text-[9px] text-[#5A4A38] uppercase">Plazas</div>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Canvas del plano ── */}
        <div className="flex-1 relative overflow-hidden"
          style={{ background: '#F6F1E7', cursor: isPanning ? 'grabbing' : (draggingGuest ? 'copy' : 'default') }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}>

          {/* Toolbar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1
            bg-[#FBF8F1] border border-[#C9A84C]/30 rounded-md px-1 py-1 shadow-lg">
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#EFE7D6] text-[#5A4A38] text-sm">
              +
            </button>
            <span className="px-2 text-xs text-[#5A4A38] font-medium min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#EFE7D6] text-[#5A4A38] text-sm">
              −
            </button>
            <div className="w-px h-5 bg-[#C9A84C]/30 mx-1" />
            <button onClick={() => { setZoom(0.55); setPan({ x: 0, y: 0 }); }}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-[#EFE7D6] text-[#5A4A38] text-xs"
              title="Ajustar">
              ⊞
            </button>
            <div className="w-px h-5 bg-[#C9A84C]/30 mx-1" />
            <button onClick={() => setIsPanning(!isPanning)}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs transition-colors
                ${isPanning ? 'bg-[#6B2737] text-[#F6F1E7]' : 'hover:bg-[#EFE7D6] text-[#5A4A38]'}`}
              title="Mano">
              ✋
            </button>
          </div>

          {/* Drag indicator */}
          {draggingGuest && (
            <div className="absolute top-3 right-3 z-10 bg-[#4A7C59] text-white text-xs px-3 py-1.5 rounded shadow-lg">
              Arrastrando: {guests.find(g => g.id === draggingGuest)?.name}
              <span className="ml-2 opacity-70">→ clic en una mesa</span>
              <button onClick={() => setDraggingGuest(null)}
                className="ml-2 underline opacity-70 hover:opacity-100">
                cancelar
              </button>
            </div>
          )}

          {/* Transform wrapper */}
          <div style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: CANVAS_W,
            height: CANVAS_H,
            position: 'absolute',
            top: 0, left: 0,
          }}>
            <svg ref={svgRef} width={CANVAS_W} height={CANVAS_H}
              style={{
                background: '#FBF8F1',
                backgroundImage: `
                  linear-gradient(rgba(176, 138, 62, 0.06) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(176, 138, 62, 0.06) 1px, transparent 1px)
                `,
                backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                boxShadow: '0 0 0 1px rgba(176, 138, 62, 0.2), 0 8px 40px rgba(60, 40, 20, 0.12)',
              }}>

              {tables.map(table => (
                <g key={table.id}
                  transform={`translate(${table.x}, ${table.y})`}
                  onClick={() => handleTableClick(table.id)}
                  style={{ cursor: draggingGuest ? 'copy' : 'pointer' }}>
                  <TableSVGReadOnly
                    table={table}
                    isDropTarget={draggingGuest !== null && hoveredTable === table.id}
                    guestCount={(guestsByTable[table.id] || []).length}
                  />
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* ── Sidebar derecho: Detalles de mesa seleccionada ── */}
        {selectedTable && (
          <aside className="w-64 bg-[#FBF8F1] border-l border-[#C9A84C]/20 p-4 overflow-y-auto flex-shrink-0">
            <h2 className="font-serif text-sm text-[#6B2737] font-semibold mb-1"
              style={{ fontFamily: "'Playfair Display', serif" }}>
              {selectedTable.label}
            </h2>
            <p className="text-[10px] text-[#5A4A38] uppercase tracking-wider mb-3 pb-2 border-b border-[#C9A84C]/30">
              {selectedGuests.length} / {selectedTable.seats} comensales
            </p>

            <div className="space-y-1.5">
              {selectedGuests.map(a => {
                const guest = guests.find(g => g.id === a.guestId);
                return (
                  <div key={a.guestId}
                    className="p-2 rounded bg-white border border-[#C9A84C]/20 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[#2A2118]">
                        {a.seatNumber}. {a.guestName}
                      </span>
                      {!isFrozen && (
                        <button onClick={() => handleRemoveFromTable(a.guestId)}
                          className="text-[#8B5B5B] hover:text-red-600 text-[10px]">
                          ✕
                        </button>
                      )}
                    </div>
                    {guest?.dietary && guest.dietary.length > 0 && (
                      <div className="text-[9px] text-[#6B2737] mt-1">
                        ⚠ {Array.isArray(guest.dietary) ? guest.dietary.join(', ') : ''}
                      </div>
                    )}
                  </div>
                );
              })}
              {selectedGuests.length === 0 && (
                <p className="text-xs text-[#5A4A38] italic py-4 text-center">
                  Mesa vacía — arrastra un invitado aquí
                </p>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="px-6 py-2 bg-[#FBF8F1] border-t border-[#C9A84C]/20 flex items-center justify-between text-xs text-[#5A4A38]">
        <span>{tables.length} mesas · {totalSeats} plazas</span>
        <span>{totalAssigned} asignados · {totalSeats - totalAssigned} libres · {unassignedGuests.length} por asignar</span>
      </footer>
    </div>
  );
}
