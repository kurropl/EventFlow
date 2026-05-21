'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// -------- TYPES --------

interface TableGuest {
  name: string;
  allergies?: string;
}

interface TableItem {
  id: string;
  kind: 'table';
  shape: 'round' | 'rect';
  seats: number;
  rotation: number;
  isHead: boolean;
  name: string;
  guests: TableGuest[];
  x: number;
  y: number;
  diameter?: number;
  width?: number;
  height?: number;
}

interface ElementItem {
  id: string;
  kind: 'element';
  type: string;
  label: string;
  rotation: number;
  width: number;
  height: number;
  x: number;
  y: number;
}

type CanvasItem = TableItem | ElementItem;

interface TemplateDef {
  id: string;
  label: string;
  detail: string;
  seats?: number;
  shape?: 'round' | 'rect';
  diameter?: number;
  width?: number;
  height?: number;
  isHead?: boolean;
  type?: string;
}

// -------- TEMPLATES --------

const TABLE_TEMPLATES: TemplateDef[] = [
  { id: 'r8',  shape: 'round', seats: 8,  label: 'Redonda 8',  detail: 'Ø 150 cm · 8 pax', diameter: 130 },
  { id: 'r10', shape: 'round', seats: 10, label: 'Redonda 10', detail: 'Ø 165 cm · 10 pax', diameter: 150 },
  { id: 'r11', shape: 'round', seats: 11, label: 'Redonda 11', detail: 'Ø 175 cm · 11 pax', diameter: 160 },
  { id: 'r12', shape: 'round', seats: 12, label: 'Redonda 12', detail: 'Ø 180 cm · 12 pax', diameter: 170 },
  { id: 'r13', shape: 'round', seats: 13, label: 'Redonda 13', detail: 'Ø 190 cm · 13 pax', diameter: 180 },
  { id: 're8',  shape: 'rect', seats: 8,  label: 'Rectangular 8',  detail: '200×90 cm · 8 pax',  width: 180, height: 80 },
  { id: 're10', shape: 'rect', seats: 10, label: 'Rectangular 10', detail: '240×90 cm · 10 pax', width: 220, height: 80 },
  { id: 're12', shape: 'rect', seats: 12, label: 'Rectangular 12', detail: '280×90 cm · 12 pax', width: 260, height: 80 },
  { id: 'pres', shape: 'rect', seats: 10, label: 'Presidencial',   detail: 'Mesa de honor · 10 pax', width: 280, height: 80, isHead: true },
];

const ELEMENTS: TemplateDef[] = [
  { id: 'dance',  type: 'dancefloor', label: 'Pista de baile',  detail: '5 × 5 m',  width: 200, height: 200 },
  { id: 'dj',     type: 'dj',         label: 'DJ / Música',     detail: '2 × 1 m',  width: 100, height: 50 },
  { id: 'bar',    type: 'bar',        label: 'Barra',           detail: '3 × 1 m',  width: 150, height: 50 },
  { id: 'cake',   type: 'cake',       label: 'Mesa tarta',      detail: '1.2 × 1.2 m', width: 70, height: 70 },
  { id: 'gift',   type: 'gift',       label: 'Mesa regalos',    detail: '1.5 × 0.8 m', width: 80, height: 50 },
  { id: 'candy',  type: 'candy',      label: 'Mesa de chuches', detail: '2 × 1 m', width: 100, height: 50 },
  { id: 'aux',    type: 'aux',        label: 'Mesa auxiliar',   detail: '1.5 × 0.8 m', width: 80, height: 50 },
];

const CANVAS_W = 2400;
const CANVAS_H = 1800;

function uid() { return 't_' + Math.random().toString(36).slice(2, 9); }

function nextTableNumber(tables: TableItem[]) {
  const used = new Set(tables.filter(t => !t.isHead).map(t => parseInt(t.name)).filter(n => !isNaN(n)));
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

// -------- SVG HELPERS --------

function RoundTableSvg({ diameter, isHead, seats, guests }: { diameter: number; isHead?: boolean; seats: number; guests: TableGuest[] }) {
  const r = diameter / 2;
  const seatPositions = Array.from({ length: seats }, (_, i) => {
    const a = (i / seats) * Math.PI * 2 - Math.PI / 2;
    return { x: r + Math.cos(a) * (r + 10), y: r + Math.sin(a) * (r + 10) };
  });
  return (
    <svg width={diameter + 30} height={diameter + 30} viewBox={`-15 -15 ${diameter + 30} ${diameter + 30}`} className="absolute top-[-15px] left-[-15px] pointer-events-none z-10">
      <circle cx={diameter / 2} cy={diameter / 2} r={diameter / 2}
        fill={isHead ? '#f5e8d0' : '#fffdf8'} stroke="#b08a3e" strokeWidth={2} className="pointer-events-auto" />
      {seatPositions.map((sp, i) => (
        <circle key={i} cx={sp.x} cy={sp.y} r={5}
          fill={guests[i]?.name ? '#b08a3e' : '#efe7d6'}
          stroke={guests[i]?.allergies ? '#6b2737' : '#8a6a28'}
          strokeWidth={guests[i]?.allergies ? 2 : 0.7} />
      ))}
    </svg>
  );
}

function RectTableSvg({ width, height, isHead, seats, guests }: { width: number; height: number; isHead?: boolean; seats: number; guests: TableGuest[] }) {
  const heads = seats >= 8 ? 2 : 0;
  const sides = seats - heads;
  const top = Math.floor(sides / 2);
  const bottom = sides - top;
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < top; i++) positions.push({ x: (width * (i + 1)) / (top + 1), y: -10 });
  for (let i = 0; i < bottom; i++) positions.push({ x: (width * (i + 1)) / (bottom + 1), y: height + 10 });
  if (heads >= 1) positions.push({ x: -10, y: height / 2 });
  if (heads >= 2) positions.push({ x: width + 10, y: height / 2 });

  return (
    <svg width={width + 40} height={height + 40} viewBox={`-20 -20 ${width + 40} ${height + 40}`}
      className="absolute top-[-20px] left-[-20px] pointer-events-none z-10">
      <rect x={0} y={0} width={width} height={height} rx={6}
        fill={isHead ? '#f5e8d0' : '#fffdf8'} stroke="#b08a3e" strokeWidth={2} className="pointer-events-auto" />
      {positions.map((sp, i) => (
        <circle key={i} cx={sp.x} cy={sp.y} r={5}
          fill={guests[i]?.name ? '#b08a3e' : '#efe7d6'}
          stroke={guests[i]?.allergies ? '#6b2737' : '#8a6a28'}
          strokeWidth={guests[i]?.allergies ? 2 : 0.7} />
      ))}
    </svg>
  );
}

function ElementSvg({ type, label, width, height, selected }: { type: string; label: string; width: number; height: number; selected: boolean }) {
  const colors: Record<string, { fill: string; stroke: string; dashed: boolean }> = {
    dancefloor: { fill: '#f5e8d0', stroke: '#b08a3e', dashed: true },
    dj: { fill: '#efe0e3', stroke: '#6b2737', dashed: false },
    bar: { fill: '#efe0e3', stroke: '#6b2737', dashed: false },
    cake: { fill: '#fff5e6', stroke: '#b08a3e', dashed: false },
    gift: { fill: '#fff5e6', stroke: '#b08a3e', dashed: false },
    candy: { fill: '#ffe5f1', stroke: '#c34a78', dashed: false },
    aux: { fill: '#f0e8d8', stroke: '#8a6a28', dashed: false },
  };
  const c = colors[type] || colors.bar;
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0 pointer-events-none z-10">
      <rect x={2} y={2} width={width - 4} height={height - 4} rx={6}
        fill={c.fill} stroke={c.stroke} strokeWidth={selected ? 3 : 2}
        strokeDasharray={c.dashed ? '8,5' : undefined} />
    </svg>
  );
}

// -------- MAIN COMPONENT --------

interface TableMapEditorProps {
  eventName?: string;
  eventId?: string;
  initialTables?: TableItem[];
  initialElements?: ElementItem[];
  onSave?: (data: { tables: TableItem[]; elements: ElementItem[] }) => void;
}

export default function TableMapEditor({ eventName: initialEventName = 'Evento sin título', eventId, initialTables = [], initialElements = [], onSave }: TableMapEditorProps) {
  const [tables, setTables] = useState<TableItem[]>(initialTables);
  const [elements, setElements] = useState<ElementItem[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 100, y: 100 });
  const [panMode, setPanMode] = useState(false);
  const [eventName, setEventName] = useState(initialEventName);
  const [activeSidebar, setActiveSidebar] = useState<'left' | 'right' | null>(null);
  const [budget, setBudget] = useState({
    adults: 0, kids: 0, priceAdult: 0, priceKid: 0,
    barPrice: 0, discountPct: 0, ivaPct: 10, complements: [] as { id: string; label: string; price: number }[]
  });

  // Undo history
  const [history, setHistory] = useState<{ tables: TableItem[]; elements: ElementItem[] }[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);

  const canvasRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isPanning = useRef(false);
  const isDragging = useRef(false);
  const dragItemId = useRef<string | null>(null);
  const dragStart = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const spaceDown = useRef(false);
  const [draggingNew, setDraggingNew] = useState<string | null>(null);
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const touchDragData = useRef<{ id: string; startX: number; startY: number; started: boolean }>({ id: '', startX: 0, startY: 0, started: false });

  const pushHistory = useCallback(() => {
    setHistory(prev => {
      const newH = prev.slice(0, historyIdx + 1);
      newH.push({ tables: JSON.parse(JSON.stringify(tables)), elements: JSON.parse(JSON.stringify(elements)) });
      if (newH.length > 50) newH.shift();
      return newH;
    });
    setHistoryIdx(prev => Math.min(prev + 1, 49));
  }, [tables, elements, historyIdx]);

  const undo = useCallback(() => {
    if (historyIdx < 0) return;
    const snap = history[historyIdx];
    setTables(snap.tables);
    setElements(snap.elements);
    setHistoryIdx(prev => prev - 1);
  }, [history, historyIdx]);

  const redo = useCallback(() => {
    if (historyIdx + 2 > history.length) return;
    const snap = history[historyIdx + 2];
    if (!snap) return;
    setTables(snap.tables);
    setElements(snap.elements);
    setHistoryIdx(prev => prev + 1);
  }, [history, historyIdx]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); spaceDown.current = true; }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedId) {
          setTables(prev => prev.filter(t => t.id !== selectedId));
          setElements(prev => prev.filter(e => e.id !== selectedId));
          setSelectedId(null);
        }
      }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    };
    const handlerUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', handlerUp);
    return () => { window.removeEventListener('keydown', handler); window.removeEventListener('keyup', handlerUp); };
  }, [selectedId, undo, redo]);

  // Apply zoom/pan transform
  const applyTransform = useCallback(() => {
    if (canvasRef.current) {
      canvasRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    }
  }, [pan, zoom]);

  useEffect(() => { applyTransform(); }, [applyTransform]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(0.2, Math.min(3, zoom * factor));
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const wx = (px - pan.x) / zoom;
        const wy = (py - pan.y) / zoom;
        setZoom(newZoom);
        setPan({ x: px - wx * newZoom, y: py - wy * newZoom });
      }
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [zoom, pan]);

  // Mouse down on canvas
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.table-item') || target.closest('.element-item')) return;
    if (spaceDown.current || panMode) {
      // Start pan
      isPanning.current = true;
      const startPan = { ...pan };
      const startX = e.clientX, startY = e.clientY;
      const move = (ev: MouseEvent) => {
        setPan({ x: startPan.x + (ev.clientX - startX), y: startPan.y + (ev.clientY - startY) });
      };
      const up = () => {
        isPanning.current = false;
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    } else {
      setSelectedId(null);
    }
  }, [pan, panMode]);

  // Drag start on item
  const handleItemMouseDown = useCallback((e: React.MouseEvent, item: CanvasItem) => {
    if (e.button !== 0 || spaceDown.current || panMode) return;
    e.stopPropagation();
    setSelectedId(item.id);
    isDragging.current = true;
    dragItemId.current = item.id;
    dragStart.current = { x: e.clientX, y: e.clientY, tx: item.x, ty: item.y };

    const move = (ev: MouseEvent) => {
      if (!dragStart.current || !dragItemId.current) return;
      const dx = (ev.clientX - dragStart.current.x) / zoom;
      const dy = (ev.clientY - dragStart.current.y) / zoom;
      let nx = dragStart.current.tx + dx;
      let ny = dragStart.current.ty + dy;
      if (ev.shiftKey) { nx = Math.round(nx / 20) * 20; ny = Math.round(ny / 20) * 20; }
      nx = Math.max(0, Math.min(CANVAS_W, nx));
      ny = Math.max(0, Math.min(CANVAS_H, ny));

      // Update in place for performance
      const item_ = findItem(dragItemId.current);
      if (item_) { item_.x = nx; item_.y = ny; }
      // Force re-render via setState
      setTables(prev => prev.map(t => t.id === dragItemId.current ? { ...t, x: nx, y: ny } as TableItem : t));
      setElements(prev => prev.map(e => e.id === dragItemId.current ? { ...e, x: nx, y: ny } as ElementItem : e));
    };

    const up = () => {
      isDragging.current = false;
      if (dragStart.current) {
        const dx = Math.abs(dragStart.current.x - e.clientX);
        const dy = Math.abs(dragStart.current.y - e.clientY);
        if (dx > 2 || dy > 2) pushHistory();
      }
      dragItemId.current = null;
      dragStart.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [zoom, panMode, pushHistory]);

  // Rotate
  const handleRotateStart = useCallback((e: React.MouseEvent, item: CanvasItem) => {
    e.stopPropagation();
    e.preventDefault();
    const el = document.querySelector(`[data-item-id="${item.id}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
    const startRotation = item.rotation;

    const move = (ev: MouseEvent) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI + 90;
      let r = startRotation + (a - startAngle);
      if (ev.shiftKey) r = Math.round(r / 15) * 15;
      const newR = ((r % 360) + 360) % 360;
      const found = findItem(item.id);
      if (found) found.rotation = newR;
      if (item.kind === 'table') setTables(prev => prev.map(t => t.id === item.id ? { ...t, rotation: newR } as TableItem : t));
      else setElements(prev => prev.map(e => e.id === item.id ? { ...e, rotation: newR } as ElementItem : e));
    };

    const up = () => {
      pushHistory();
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [pushHistory]);

  // Template drag/drop to canvas
  const handleTemplateDragStart = useCallback((e: React.DragEvent, templateId: string, isElement: boolean) => {
    const id = isElement ? 'el:' + templateId : templateId;
    setDraggingNew(id);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', id);
  }, []);

  const handleCanvasDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleCanvasDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const id = draggingNew || e.dataTransfer.getData('text/plain');
    if (!id) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;
    addItemFromTemplate(id, x, y);
    setDraggingNew(null);
  }, [draggingNew, zoom, pan]);

  const addItemFromTemplate = useCallback((id: string, x: number, y: number) => {
    if (id.startsWith('el:')) {
      const elId = id.slice(3);
      const tpl = ELEMENTS.find(e => e.id === elId);
      if (!tpl) return;
      const newEl: ElementItem = {
        id: uid(), kind: 'element', type: tpl.type || 'aux', label: tpl.label,
        rotation: 0, width: tpl.width!, height: tpl.height!, x, y,
      };
      setElements(prev => [...prev, newEl]);
      setSelectedId(newEl.id);
      pushHistory();
    } else {
      const tpl = TABLE_TEMPLATES.find(t => t.id === id);
      if (!tpl) return;
      const newTable: TableItem = {
        id: uid(), kind: 'table', shape: tpl.shape || 'round', seats: tpl.seats || 8,
        rotation: 0, isHead: !!tpl.isHead,
        name: tpl.isHead ? 'Presidencial' : String(nextTableNumber(tables)),
        guests: Array(tpl.seats || 8).fill({ name: '', allergies: '' }),
        x, y, diameter: tpl.diameter, width: tpl.width, height: tpl.height,
      };
      setTables(prev => [...prev, newTable]);
      setSelectedId(newTable.id);
      setBudget(b => ({ ...b, adults: b.adults + (tpl.seats || 8) }));
      pushHistory();
    }
  }, [tables, pushHistory]);

  // Touch drag for templates (mobile)
  const handleTemplateTouchStart = useCallback((e: React.TouchEvent, templateId: string, isElement: boolean) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const id = isElement ? 'el:' + templateId : templateId;
    touchDragData.current = { id, startX: t.clientX, startY: t.clientY, started: false };
  }, []);

  const handleTemplateTouchMove = useCallback((e: React.TouchEvent, cardEl: HTMLDivElement | null) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    const d = touchDragData.current;
    if (!d.id) return;
    const dx = t.clientX - d.startX;
    const dy = t.clientY - d.startY;
    if (!d.started) {
      if (Math.hypot(dx, dy) < 8) return;
      d.started = true;
      if (cardEl) {
        const ghost = cardEl.cloneNode(true) as HTMLDivElement;
        ghost.style.position = 'fixed';
        ghost.style.zIndex = '9999';
        ghost.style.pointerEvents = 'none';
        ghost.style.opacity = '0.85';
        ghost.style.width = cardEl.offsetWidth + 'px';
        ghost.style.boxShadow = '0 6px 20px rgba(0,0,0,0.3)';
        ghost.style.transform = 'rotate(-2deg) scale(1.02)';
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
        setActiveSidebar(null);
      }
    }
    if (ghostRef.current) {
      ghostRef.current.style.left = (t.clientX - 60) + 'px';
      ghostRef.current.style.top = (t.clientY - 30) + 'px';
      e.preventDefault();
    }
  }, []);

  const handleTemplateTouchEnd = useCallback((e: React.TouchEvent) => {
    const d = touchDragData.current;
    if (!d.started) { d.id = ''; return; }
    if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
    const t = e.changedTouches?.[0];
    if (!t) { d.id = ''; d.started = false; return; }
    const elBelow = document.elementFromPoint(t.clientX, t.clientY);
    if (elBelow && (elBelow.closest('[data-canvas-wrapper]') || elBelow.closest('[data-canvas-area]'))) {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const x = (t.clientX - rect.left - pan.x) / zoom;
        const y = (t.clientY - rect.top - pan.y) / zoom;
        addItemFromTemplate(d.id, x, y);
      }
    } else {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = (rect.width / 2 - pan.x) / zoom;
        const cy = (rect.height / 2 - pan.y) / zoom;
        addItemFromTemplate(d.id, Math.max(100, Math.min(CANVAS_W - 100, cx)), Math.max(100, Math.min(CANVAS_H - 100, cy)));
      }
    }
    d.id = '';
    d.started = false;
  }, [zoom, pan, addItemFromTemplate]);

  // Fit to view
  const fitToView = useCallback(() => {
    const items = [...tables, ...elements];
    if (items.length === 0) { setZoom(1); setPan({ x: 100, y: 100 }); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    items.forEach(t => {
      const w = t.kind === 'table' && t.shape === 'round' ? (t as TableItem).diameter || 130 : (t as TableItem).width || (t as ElementItem).width || 180;
      const h = t.kind === 'table' && t.shape === 'round' ? (t as TableItem).diameter || 130 : (t as TableItem).height || (t as ElementItem).height || 80;
      minX = Math.min(minX, t.x - w / 2);
      minY = Math.min(minY, t.y - h / 2);
      maxX = Math.max(maxX, t.x + w / 2);
      maxY = Math.max(maxY, t.y + h / 2);
    });
    const pad = 80;
    const w = maxX - minX + pad * 2;
    const h = maxY - minY + pad * 2;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const z = Math.min(wrapper.clientWidth / w, wrapper.clientHeight / h, 1.5);
    setZoom(z);
    setPan({ x: -(minX - pad) * z + (wrapper.clientWidth - w * z) / 2, y: -(minY - pad) * z + (wrapper.clientHeight - h * z) / 2 });
  }, [tables, elements]);

  // ---- Save plan to API ----
  const handleSavePlan = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          name: eventName || 'Plano principal',
          tables_data: tables,
          elements_data: elements,
          budget_data: budget,
          zoom,
          pan_x: pan.x,
          pan_y: pan.y,
        }),
      });
      if (res.ok) {
        alert('Plano guardado correctamente');
      } else {
        const data = await res.json();
        alert('Error al guardar: ' + (data.error || 'Desconocido'));
      }
    } catch (err) {
      alert('Error de conexión al guardar el plano');
    }
  }, [eventId, eventName, tables, elements, budget, zoom, pan]);

  // ---- Load plan from API ----
  const handleLoadPlan = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/plans?event_id=${eventId}`);
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        const plan = data.data[0];
        if (plan.tables_data) setTables(plan.tables_data);
        if (plan.elements_data) setElements(plan.elements_data);
        if (plan.budget_data) setBudget(plan.budget_data);
        if (plan.zoom) setZoom(plan.zoom);
        if (plan.pan_x != null && plan.pan_y != null) setPan({ x: plan.pan_x, y: plan.pan_y });
        if (plan.name) setEventName(plan.name);
        saveHistory();
        alert('Plano cargado correctamente');
      } else {
        alert('No hay plano guardado para este evento');
      }
    } catch (err) {
      alert('Error de conexión al cargar el plano');
    }
  }, [eventId, setTables, setElements]);

  // ---- Export PDF ----
  const handleExportPDF = useCallback(async () => {
    try {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');
      const canvas = await html2canvas(wrapper, {
        backgroundColor: '#f5f0e6',
        scale: 2,
        logging: false,
        useCORS: true,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfW = 297;
      const pdfH = 210;
      const margin = 10;
      const imgW = pdfW - margin * 2;
      const imgH = (canvas.height / canvas.width) * imgW;
      pdf.setFillColor(245, 240, 230);
      pdf.rect(0, 0, pdfW, pdfH, 'F');
      // Title
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.setTextColor(45, 45, 45);
      pdf.text(eventName || 'Plano del Evento', pdfW / 2, 12, { align: 'center' });
      // Image
      pdf.addImage(imgData, 'PNG', margin, 16, imgW, Math.min(imgH, pdfH - 26));
      pdf.save(`${(eventName || 'plano-evento').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Error al exportar PDF');
    }
  }, [eventName]);

  const findItem = useCallback((id: string): CanvasItem | undefined => {
    return [...tables, ...elements].find(t => t.id === id);
  }, [tables, elements]);

  const selectedItem = selectedId ? findItem(selectedId) : null;

  // Update guest name in table
  const updateGuest = useCallback((tableId: string, seatIdx: number, name: string, allergies?: string) => {
    setTables(prev => prev.map(t => {
      if (t.id !== tableId) return t;
      const newGuests = [...t.guests];
      newGuests[seatIdx] = { ...newGuests[seatIdx], name, allergies: allergies || '' };
      return { ...t, guests: newGuests };
    }));
  }, []);

  // Stats
  const totalSeats = tables.reduce((s, t) => s + t.seats, 0);
  const assignedSeats = tables.reduce((s, t) => s + t.guests.filter(g => g.name?.trim()).length, 0);
  const freeSeats = totalSeats - assignedSeats;
  const totalElements = elements.length;

  // Budget calculations
  const budgetAdults = budget.adults;
  const budgetKids = budget.kids;
  const subTotal = (budgetAdults * budget.priceAdult) + (budgetKids * budget.priceKid);
  const barTotal = budget.barPrice * budgetAdults;
  const complementsTotal = budget.complements.reduce((s: number, c: { price: number }) => s + c.price, 0);
  const discount = subTotal * (budget.discountPct / 100);
  const iva = (subTotal - discount + barTotal + complementsTotal) * (budget.ivaPct / 100);
  const total = subTotal - discount + barTotal + complementsTotal + iva;
  const perPax = (budgetAdults + budgetKids) > 0 ? total / (budgetAdults + budgetKids) : 0;

  return (
    <div className="flex flex-col h-full bg-[#f5f0e6] text-[#1a1a1a] overflow-hidden font-sans select-none" data-canvas-area>
      {/* ===== HEADER ===== */}
      <header className="flex items-center justify-between px-4 py-2 bg-[#faf8f3] border-b border-[#b08a3e]/20 shrink-0" style={{ height: 52 }}>
        <div className="flex items-center gap-3">
          <div className="text-[#b08a3e] font-serif italic text-xl font-bold" style={{ fontFamily: "'Georgia', serif" }}>EF</div>
          <div className="text-xs leading-tight">
            <div className="text-[#1a1a1a] font-semibold text-sm" style={{ fontFamily: "'Georgia', serif" }}>Mapa de Mesas</div>
            <div className="text-[#b08a3e]/60 text-[10px]">by EventFlow · Salón de Celebraciones</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="text" value={eventName} onChange={e => setEventName(e.target.value)}
            className="bg-[#f5f0e6] border border-[#b08a3e]/30 rounded px-3 py-1.5 text-xs w-36 outline-none focus:border-[#b08a3e]"
            placeholder="Nombre del evento..." />
          <button onClick={fitToView}
            className="px-2.5 py-1.5 text-xs bg-[#b08a3e] text-[#faf8f3] rounded hover:bg-[#9a7a35] transition-colors font-medium">
            Ajustar
          </button>
          {/* Save to API */}
          {eventId && (
            <button onClick={handleSavePlan}
              className="px-2.5 py-1.5 text-xs bg-[#6b2737] text-[#faf8f3] rounded hover:bg-[#5a1f2e] transition-colors font-medium">
              Guardar
            </button>
          )}
          {/* Load from API */}
          {eventId && (
            <button onClick={handleLoadPlan}
              className="px-2.5 py-1.5 text-xs bg-[#faf8f3] text-[#1a1a1a] border border-[#b08a3e]/30 rounded hover:bg-[#f5f0e6] transition-colors font-medium">
              Cargar
            </button>
          )}
          {/* PDF Export */}
          <button onClick={handleExportPDF}
            className="px-2.5 py-1.5 text-xs bg-white text-[#1a1a1a] border border-[#b08a3e]/30 rounded hover:bg-[#f5f0e6] transition-colors font-medium flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            PDF
          </button>
        </div>
      </header>

      {/* ===== MAIN LAYOUT ===== */}
      <div className="flex flex-1 overflow-hidden">
        {/* ===== LEFT SIDEBAR ===== */}
        <aside className={`w-72 bg-[#faf8f3] border-r border-[#b08a3e]/20 overflow-y-auto shrink-0 transition-all ${activeSidebar === 'left' || activeSidebar === null ? 'block' : 'hidden'} md:block`}>
          {/* Budget */}
          <div className="px-4 py-3 border-b border-[#b08a3e]/10">
            <div className="text-xs font-semibold text-[#b08a3e] uppercase tracking-wider mb-1">Presupuesto</div>
            <div className="text-[10px] text-[#1a1a1a]/40 mb-2">Datos del evento</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-[#1a1a1a]/50">Comensales adultos</label>
                <input type="number" min={0} value={budget.adults} onChange={e => setBudget(b => ({ ...b, adults: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-[#1a1a1a]/50">Niños / infantil</label>
                <input type="number" min={0} value={budget.kids} onChange={e => setBudget(b => ({ ...b, kids: Math.max(0, parseInt(e.target.value) || 0) }))}
                  className="w-full bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-[#1a1a1a]/50">Precio menú adulto</label>
                <input type="number" min={0} step={0.5} value={budget.priceAdult} onChange={e => setBudget(b => ({ ...b, priceAdult: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs" />
              </div>
              <div>
                <label className="text-[10px] text-[#1a1a1a]/50">Precio menú infantil</label>
                <input type="number" min={0} step={0.5} value={budget.priceKid} onChange={e => setBudget(b => ({ ...b, priceKid: parseFloat(e.target.value) || 0 }))}
                  className="w-full bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs" />
              </div>
            </div>
          </div>

          {/* Budget Summary */}
          <div className="px-4 py-3 border-b border-[#b08a3e]/10 text-xs space-y-1">
            <div className="flex justify-between text-[#1a1a1a]/60"><span>Adultos</span><span>{budget.adults} × {budget.priceAdult}€</span></div>
            <div className="flex justify-between text-[#1a1a1a]/60"><span>Infantil</span><span>{budget.kids} × {budget.priceKid}€</span></div>
            {budget.barPrice > 0 && (
              <div className="flex justify-between text-[#1a1a1a]/60"><span>Barra libre</span><span>{barTotal.toFixed(2)}€</span></div>
            )}
            {budget.discountPct > 0 && (
              <div className="flex justify-between text-[#1a1a1a]/60"><span>Descuento</span><span>-{discount.toFixed(2)}€</span></div>
            )}
            <div className="flex justify-between text-[#1a1a1a]/60"><span>IVA ({budget.ivaPct}%)</span><span>{iva.toFixed(2)}€</span></div>
            <div className="flex justify-between font-bold text-[#6b2737] pt-1 border-t border-[#b08a3e]/20">
              <span>Total</span><span>{total.toFixed(2)}€</span>
            </div>
            <div className="flex justify-between text-[10px] text-[#1a1a1a]/40">
              <span>Coste por comensal</span><span>{perPax.toFixed(2)}€</span>
            </div>
          </div>

          {/* Adjustments */}
          <div className="px-4 py-3 border-b border-[#b08a3e]/10 text-xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#1a1a1a]/50 flex-1">Barra libre / adulto</span>
              <input type="number" min={0} step={0.5} value={budget.barPrice} onChange={e => setBudget(b => ({ ...b, barPrice: parseFloat(e.target.value) || 0 }))}
                className="w-20 bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs text-right" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#1a1a1a]/50 flex-1">Descuento %</span>
              <input type="number" min={0} max={100} step={0.5} value={budget.discountPct} onChange={e => setBudget(b => ({ ...b, discountPct: parseFloat(e.target.value) || 0 }))}
                className="w-20 bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs text-right" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#1a1a1a]/50 flex-1">IVA %</span>
              <input type="number" min={0} max={100} step={0.5} value={budget.ivaPct} onChange={e => setBudget(b => ({ ...b, ivaPct: parseFloat(e.target.value) || 0 }))}
                className="w-20 bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs text-right" />
            </div>
          </div>

          {/* Stats */}
          <div className="px-4 py-3 border-b border-[#b08a3e]/10">
            <div className="text-xs font-semibold text-[#b08a3e] uppercase tracking-wider mb-2">Aforo del Plano</div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div className="bg-[#f5f0e6] rounded p-2"><div className="text-lg font-bold text-[#1a1a1a]">{tables.length}</div><div className="text-[9px] text-[#1a1a1a]/50">Mesas</div></div>
              <div className="bg-[#f5f0e6] rounded p-2"><div className="text-lg font-bold text-[#1a1a1a]">{totalSeats}</div><div className="text-[9px] text-[#1a1a1a]/50">Plazas</div></div>
              <div className="bg-[#f5f0e6] rounded p-2"><div className="text-lg font-bold text-[#b08a3e]">{assignedSeats}</div><div className="text-[9px] text-[#1a1a1a]/50">Asignadas</div></div>
              <div className="bg-[#f5f0e6] rounded p-2"><div className="text-lg font-bold text-[#6b2737]">{freeSeats}</div><div className="text-[9px] text-[#1a1a1a]/50">Libres</div></div>
            </div>
          </div>

          {/* Templates: Tables */}
          <div className="px-4 py-3 border-b border-[#b08a3e]/10">
            <div className="text-xs font-semibold text-[#b08a3e] uppercase tracking-wider mb-1">Mesas</div>
            <div className="text-[10px] text-[#1a1a1a]/40 mb-2">Arrastra al plano</div>
            <div className="grid grid-cols-2 gap-2">
              {TABLE_TEMPLATES.map(tpl => (
                <div key={tpl.id}
                  ref={el => { /* store ref for touch*/ }}
                  draggable
                  onDragStart={e => handleTemplateDragStart(e, tpl.id, false)}
                  onTouchStart={e => handleTemplateTouchStart(e, tpl.id, false)}
                  onTouchMove={e => handleTemplateTouchMove(e, (e.currentTarget as HTMLDivElement))}
                  onTouchEnd={handleTemplateTouchEnd}
                  className="bg-white border border-[#b08a3e]/20 rounded p-2 cursor-grab hover:border-[#b08a3e] hover:shadow-sm transition-all active:cursor-grabbing text-xs">
                  <div className="flex justify-center mb-1">
                    {tpl.shape === 'round' ? (
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <circle cx="20" cy="20" r="12" fill="#fffdf8" stroke="#b08a3e" strokeWidth="1.5" />
                        {Array.from({ length: tpl.seats || 8 }, (_, i) => {
                          const a = (i / (tpl.seats || 8)) * Math.PI * 2 - Math.PI / 2;
                          return <circle key={i} cx={20 + Math.cos(a) * 16} cy={20 + Math.sin(a) * 16} r="2.5" fill="#efe7d6" stroke="#8a6a28" strokeWidth="0.7" />;
                        })}
                      </svg>
                    ) : (
                      <svg width="40" height="40" viewBox="0 0 40 40">
                        <rect x="6" y="14" width="28" height="12" rx="2" fill={tpl.isHead ? '#f5e8d0' : '#fffdf8'} stroke="#b08a3e" strokeWidth="1.5" />
                        {Array.from({ length: tpl.seats || 8 }, (_, i) => {
                          const heads = (tpl.seats || 8) >= 8 ? 2 : 0;
                          const sides = (tpl.seats || 8) - heads;
                          const top = Math.floor(sides / 2);
                          const bottom = sides - top;
                          let x = 0, y = 0;
                          if (i < top) { x = 7 + (28 * (i + 1)) / (top + 1); y = 11; }
                          else if (i < top + bottom) { const j = i - top; x = 7 + (28 * (j + 1)) / (bottom + 1); y = 27; }
                          else if (heads >= 1 && i === top + bottom) { x = 4; y = 20; }
                          else { x = 36; y = 20; }
                          return <circle key={i} cx={x} cy={y} r="2.5" fill="#efe7d6" stroke="#8a6a28" strokeWidth="0.7" />;
                        })}
                      </svg>
                    )}
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-[11px] text-[#1a1a1a]">{tpl.label}</div>
                    <div className="text-[9px] text-[#1a1a1a]/50">{tpl.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Templates: Elements */}
          <div className="px-4 py-3">
            <div className="text-xs font-semibold text-[#b08a3e] uppercase tracking-wider mb-1">Elementos</div>
            <div className="text-[10px] text-[#1a1a1a]/40 mb-2">Estructura del salón</div>
            <div className="grid grid-cols-2 gap-2">
              {ELEMENTS.map(el => (
                <div key={el.id}
                  draggable
                  onDragStart={e => handleTemplateDragStart(e, el.id, true)}
                  onTouchStart={e => handleTemplateTouchStart(e, el.id, true)}
                  onTouchMove={e => handleTemplateTouchMove(e, (e.currentTarget as HTMLDivElement))}
                  onTouchEnd={handleTemplateTouchEnd}
                  className="bg-white border border-[#b08a3e]/20 rounded p-2 cursor-grab hover:border-[#b08a3e] hover:shadow-sm transition-all active:cursor-grabbing text-xs">
                  <div className="flex justify-center mb-1">
                    <svg width="40" height="40" viewBox="0 0 40 40">
                      <rect x="6" y="12" width="28" height="16" rx="2"
                        fill={el.type === 'dancefloor' ? '#f5e8d0' : el.type === 'candy' ? '#ffe5f1' : '#efe0e3'}
                        stroke={el.type === 'dancefloor' ? '#b08a3e' : '#6b2737'} strokeWidth="1.5"
                        strokeDasharray={el.type === 'dancefloor' ? '3,2' : '0'} />
                    </svg>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-[11px] text-[#1a1a1a]">{el.label}</div>
                    <div className="text-[9px] text-[#1a1a1a]/50">{el.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ===== CANVAS ===== */}
        <section className="flex-1 relative overflow-hidden bg-[#f5f0e6]"
          style={{
            backgroundImage: 'radial-gradient(circle at 10% 0%, rgba(176, 138, 62, 0.06) 0%, transparent 50%), radial-gradient(circle at 90% 100%, rgba(107, 39, 55, 0.04) 0%, transparent 50%)'
          }}
          data-canvas-wrapper ref={wrapperRef}
          onWheel={handleWheel}
          onDragOver={handleCanvasDragOver}
          onDrop={handleCanvasDrop}
          onMouseDown={handleCanvasMouseDown}>

          {/* Toolbar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg shadow-md border border-[#b08a3e]/20 px-2 py-1.5">
            <button onClick={() => { setPanMode(p => !p); }}
              className={`p-1.5 rounded ${panMode ? 'bg-[#b08a3e] text-white' : 'text-[#1a1a1a]/60 hover:bg-[#b08a3e]/10'} transition-colors`} title="Mover plano (Espacio)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
            </button>
            <div className="w-px h-5 bg-[#b08a3e]/20" />
            <button onClick={() => setZoom(z => Math.max(0.2, z / 1.2))}
              className="p-1.5 rounded text-[#1a1a1a]/60 hover:bg-[#b08a3e]/10 transition-colors" title="Alejar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
            </button>
            <span className="text-xs font-mono text-[#1a1a1a]/60 min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(3, z * 1.2))}
              className="p-1.5 rounded text-[#1a1a1a]/60 hover:bg-[#b08a3e]/10 transition-colors" title="Acercar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
            </button>
            <button onClick={fitToView}
              className="p-1.5 rounded text-[#1a1a1a]/60 hover:bg-[#b08a3e]/10 transition-colors" title="Ajustar">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V3h4M21 7V3h-4M3 17v4h4M21 17v4h-4"/></svg>
            </button>
            <div className="w-px h-5 bg-[#b08a3e]/20" />
            <button onClick={undo}
              className="p-1.5 rounded text-[#1a1a1a]/60 hover:bg-[#b08a3e]/10 transition-colors disabled:opacity-30" title="Deshacer (Ctrl+Z)" disabled={historyIdx < 0}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
            </button>
            <button onClick={redo}
              className="p-1.5 rounded text-[#1a1a1a]/60 hover:bg-[#b08a3e]/10 transition-colors disabled:opacity-30" title="Rehacer (Ctrl+Y)" disabled={historyIdx + 2 > history.length}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 7v6h-6M3 17a9 9 0 0 1 15-6.7L21 13"/></svg>
            </button>
          </div>

          {/* Canvas inner */}
          <div ref={canvasRef} className="absolute" style={{ transformOrigin: '0 0', top: 0, left: 0 }}>
            <div style={{ width: CANVAS_W, height: CANVAS_H, position: 'relative', backgroundImage: 'radial-gradient(circle, #b08a3e20 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
              {/* Head marker */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[#b08a3e]/30 text-[11px] tracking-[3px] uppercase font-serif italic pointer-events-none" style={{ fontFamily: "'Georgia', serif" }}>
                Mesa Presidencial · Entrada
              </div>

              {/* Render tables */}
              {tables.map(t => {
                const w = t.shape === 'round' ? t.diameter || 130 : t.width || 180;
                const h = t.shape === 'round' ? t.diameter || 130 : t.height || 80;
                return (
                  <div key={t.id} data-item-id={t.id}
                    className={`table-item absolute ${selectedId === t.id ? 'ring-2 ring-[#b08a3e]' : ''} ${t.isHead ? 'z-20' : 'z-10'} cursor-grab active:cursor-grabbing`}
                    style={{
                      left: t.x - w / 2, top: t.y - h / 2,
                      width: w, height: h,
                      transform: `rotate(${t.rotation}deg)`,
                    }}
                    onMouseDown={e => handleItemMouseDown(e, t)}>
                    {t.shape === 'round' ? (
                      <RoundTableSvg diameter={t.diameter || 130} isHead={t.isHead} seats={t.seats} guests={t.guests} />
                    ) : (
                      <RectTableSvg width={t.width || 180} height={t.height || 80} isHead={t.isHead} seats={t.seats} guests={t.guests} />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-20">
                      <div className="text-[#1a1a1a] font-semibold text-xs" style={{ fontFamily: "'Georgia', serif" }}>
                        {t.isHead ? 'Presidencial' : `Mesa ${t.name}`}
                      </div>
                      <div className="text-[#1a1a1a]/60 text-[10px]">
                        {t.guests.filter(g => g.name?.trim()).length}/{t.seats}
                        {t.guests.some(g => g.allergies?.trim()) ? (
                          <span className="text-[#6b2737] font-bold ml-1" title="Comensales con alergias">⚠</span>
                        ) : null}
                      </div>
                    </div>
                    {/* Rotate handle */}
                    {selectedId === t.id && (
                      <div className="absolute w-3 h-3 bg-[#b08a3e] rounded-full cursor-grab active:cursor-grabbing z-30 shadow-sm border border-white"
                        style={{ left: '50%', marginLeft: -6, top: -18 }}
                        onMouseDown={e => handleRotateStart(e, t)}
                        title="Girar" />
                    )}
                  </div>
                );
              })}

              {/* Render elements */}
              {elements.map(el => (
                <div key={el.id} data-item-id={el.id}
                  className={`element-item absolute ${selectedId === el.id ? 'ring-2 ring-[#b08a3e]' : ''} cursor-grab active:cursor-grabbing z-5`}
                  style={{
                    left: el.x - el.width / 2, top: el.y - el.height / 2,
                    width: el.width, height: el.height,
                    transform: `rotate(${el.rotation}deg)`,
                  }}
                  onMouseDown={e => handleItemMouseDown(e, el)}>
                  <ElementSvg type={el.type} label={el.label} width={el.width} height={el.height} selected={selectedId === el.id} />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                    <div className="text-[#1a1a1a] text-[11px] font-medium" style={{ fontFamily: "'Georgia', serif" }}>{el.label}</div>
                  </div>
                  {selectedId === el.id && (
                    <div className="absolute w-3 h-3 bg-[#b08a3e] rounded-full cursor-grab active:cursor-grabbing z-30 shadow-sm border border-white"
                      style={{ left: '50%', marginLeft: -6, top: -18 }}
                      onMouseDown={e => handleRotateStart(e, el)}
                      title="Girar" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Minimap */}
          <div className="absolute bottom-4 right-4 w-28 h-20 bg-white/90 backdrop-blur rounded border border-[#b08a3e]/20 shadow-md overflow-hidden z-20">
            <div className="w-full h-full relative">
              <div className="absolute inset-0" style={{
                transform: `scale(${Math.min(112 / CANVAS_W, 80 / CANVAS_H)})`,
                transformOrigin: '0 0',
              }}>
                {/* Minimap items */}
                {tables.map(t => {
                  const w = t.shape === 'round' ? t.diameter || 130 : t.width || 180;
                  const h = t.shape === 'round' ? t.diameter || 130 : t.height || 80;
                  return <div key={t.id} className="absolute bg-[#b08a3e]/60 rounded-sm" style={{ left: t.x - w/2, top: t.y - h/2, width: w, height: h }} />;
                })}
                {elements.map(el => (
                  <div key={el.id} className="absolute bg-[#6b2737]/50 rounded-sm" style={{ left: el.x - el.width/2, top: el.y - el.height/2, width: el.width, height: el.height }} />
                ))}
              </div>
              {/* Viewport indicator */}
              <div className="absolute border-2 border-[#b08a3e]/60 bg-transparent pointer-events-none"
                style={{
                  left: (-pan.x / zoom) * (112 / CANVAS_W),
                  top: (-pan.y / zoom) * (80 / CANVAS_H),
                  width: (wrapperRef.current?.clientWidth || 600) / zoom * (112 / CANVAS_W),
                  height: (wrapperRef.current?.clientHeight || 400) / zoom * (80 / CANVAS_H),
                }} />
            </div>
          </div>

          {/* Empty state */}
          {tables.length === 0 && elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-5">
              <div className="text-center">
                <svg className="mx-auto mb-3 w-16 h-16 text-[#b08a3e]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
                </svg>
                <p className="text-[#1a1a1a]/40 text-sm font-serif italic" style={{ fontFamily: "'Georgia', serif" }}>
                  Arrastra mesas desde la barra lateral<br />para empezar a diseñar el plano
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ===== RIGHT SIDEBAR ===== */}
        <aside className={`w-72 bg-[#faf8f3] border-l border-[#b08a3e]/20 overflow-y-auto shrink-0 transition-all ${activeSidebar === 'right' ? 'block' : 'hidden'} md:block`}>
          <div className="px-4 py-4" id="properties-panel">
            {!selectedItem ? (
              <div className="text-center py-12">
                <svg className="mx-auto mb-3 w-12 h-12 text-[#b08a3e]/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>
                </svg>
                <p className="text-[#1a1a1a]/40 text-xs">
                  Selecciona una mesa<br />para editar sus detalles<br />y comensales
                </p>
              </div>
            ) : selectedItem.kind === 'element' ? (
              <div>
                <div className="text-sm font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Georgia', serif" }}>
                  {(selectedItem as ElementItem).label}
                </div>
                <div className="text-[10px] text-[#b08a3e] uppercase tracking-wider mb-4">Elemento del salón</div>
                <div className="text-xs text-[#1a1a1a]/60 space-y-1">
                  <p><strong>Ancho:</strong> {(selectedItem as ElementItem).width} cm</p>
                  <p><strong>Alto:</strong> {(selectedItem as ElementItem).height} cm</p>
                  <p><strong>Rotación:</strong> {(selectedItem as ElementItem).rotation}°</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-sm font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Georgia', serif" }}>
                  {(selectedItem as TableItem).isHead ? 'Presidencial' : `Mesa ${(selectedItem as TableItem).name}`}
                </div>
                <div className="text-[10px] text-[#b08a3e] uppercase tracking-wider mb-2">
                  {(selectedItem as TableItem).shape === 'round' ? 'Redonda' : 'Rectangular'} · {(selectedItem as TableItem).seats} plazas
                </div>

                {/* Guest list */}
                <div className="mb-3">
                  <div className="text-[10px] text-[#1a1a1a]/50 uppercase tracking-wider mb-1 font-medium">
                    Comensales
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {(selectedItem as TableItem).guests.map((guest, i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <span className="text-[10px] text-[#1a1a1a]/40 w-4 shrink-0">{i + 1}</span>
                        <input
                          value={guest.name || ''}
                          onChange={e => updateGuest((selectedItem as TableItem).id, i, e.target.value, guest.allergies)}
                          placeholder="Nombre del comensal..."
                          className="flex-1 bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs outline-none focus:border-[#b08a3e]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Allergies */}
                <div>
                  <div className="text-[10px] text-[#1a1a1a]/50 uppercase tracking-wider mb-1 font-medium">
                    Alergias / Intolerancias
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {(selectedItem as TableItem).guests.map((guest, i) => (
                      <div key={i} className="flex gap-1 items-center">
                        <span className="text-[10px] text-[#1a1a1a]/40 w-4 shrink-0">{i + 1}</span>
                        {guest.name ? (
                          <>
                            <span className="text-[10px] text-[#1a1a1a]/60 w-16 truncate">{guest.name}</span>
                            <input
                              value={guest.allergies || ''}
                              onChange={e => updateGuest((selectedItem as TableItem).id, i, guest.name, e.target.value)}
                              placeholder="Alergias..."
                              className="flex-1 bg-[#f5f0e6] border border-[#b08a3e]/20 rounded px-2 py-1 text-xs outline-none focus:border-[#b08a3e]"
                            />
                          </>
                        ) : (
                          <span className="text-[10px] text-[#1a1a1a]/30 italic">Asiento vacío</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => {
                    setTables(prev => prev.filter(t => t.id !== selectedItem.id));
                    setSelectedId(null);
                    pushHistory();
                  }}
                  className="mt-4 w-full py-1.5 text-xs text-[#6b2737] border border-[#6b2737]/30 rounded hover:bg-[#6b2737]/5 transition-colors">
                  Eliminar mesa
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between px-4 py-1.5 bg-[#faf8f3] border-t border-[#b08a3e]/20 shrink-0" style={{ height: 28 }}>
        <span className="text-[10px] text-[#1a1a1a]/40">
          {tables.length > 0 || elements.length > 0
            ? `${tables.length} mesas · ${totalSeats} plazas (${assignedSeats} asignadas, ${freeSeats} libres)`
            : 'Sin mesas en el plano'}
        </span>
        <span className="text-[10px] text-[#1a1a1a]/30">
          Arrastra · Doble clic para girar · Supr para eliminar · Ctrl+Z deshacer
        </span>
      </footer>
    </div>
  );
}