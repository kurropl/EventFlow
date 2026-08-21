'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/shared/Icon';
import { cn } from '@/lib/utils';

/* ─────────────── Types ─────────────── */
interface Event { id: string; client_name: string; event_date: string; guest_count: number; venue_type?: string; }
interface ControlRecepcion { proveedor: string; producto: string; temp: number | null; embalajeOk: boolean; caducidadOk: boolean; caducidad?: string | null; lote?: string; ok: boolean; }
interface ControlAlmacenamiento { camara: string; tempManana: number | null; tempTarde: number | null; ok: boolean; }
interface ControlElaboracion { plato: string; tempCoccion: number | null; horaCoccion: string; responsable: string; ok: boolean; lote?: string; alergenicos: string[]; }
interface ControlServicio { zona: string; temp: number | null; hora: string; ok: boolean; timeHolding: string; }
interface TareaLimpieza { zona: string; tarea: string; realizada: boolean; responsable: string; verificada: boolean; }
interface Incidencia { descripcion: string; tipo: string; accion: string; responsable: string; resuelta: boolean; hora: string; foto?: string; }
interface ScannedLabel { lote: string; caducidad: string | null; producto: string; proveedor: string; peso: number | null; unidad: string; textoCompleto: string; confianza: number; matched: boolean; ingredientId?: string; }

const CAMARAS = ['Cámara 1 (Refrigerada)', 'Cámara 2 (Congelación)', 'Botellero', 'Expositor frío'];
const ZONAS_LIMPIEZA = [
  { zona: 'Cocina', tareas: ['Encimeras y superficies', 'Suelos', 'Fregaderos', 'Campana extractora'] },
  { zona: 'Cámara refrigerada', tareas: ['Estantes y paredes', 'Suelo', 'Puerta y junta'] },
  { zona: 'Zona de servicio', tareas: ['Buffet / vitrina', 'Barra', 'Utensilios'] },
  { zona: 'Baños y vestuarios', tareas: ['Lavabos e inodoros', 'Suelos', 'Papeleras'] },
];
const TABS = [
  { id: 'recepcion', label: 'Recepción', icon: 'truck' },
  { id: 'almacenamiento', label: 'Almacén', icon: 'package' },
  { id: 'elaboracion', label: 'Elaboración', icon: 'cookingPot' },
  { id: 'servicio', label: 'Servicio', icon: 'wine' },
  { id: 'limpieza', label: 'Limpieza', icon: 'list' },
  { id: 'incidencias', label: 'Incidencias', icon: 'warning' },
  { id: 'aceite', label: 'Aceite', icon: 'beaker' },
];
const ALEGENOS_LIST = ['gluten', 'crustaceos', 'huevo', 'pescado', 'cacahuete', 'soja', 'leche', 'frutos_cascara', 'apio', 'mostaza', 'sésamo', 'sulfitos', 'altramuz', 'moluscos'];

/* ─────────────── Camera/OCR Hook ─────────────── */
function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch { /* camera error */ }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  }, [stream]);

  const capture = useCallback(async (): Promise<string | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    return new Promise(resolve => {
      canvas.toBlob(blob => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        } else resolve(null);
      }, 'image/jpeg', 0.85);
    });
  }, []);

  return { videoRef, canvasRef, stream, capturing, captured, setCaptured, startCamera, stopCamera, capture };
}

/* ─────────────── OCR Scan Modal ─────────────── */
interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResult: (data: ScannedLabel) => void;
}

function ScanModal({ isOpen, onClose, onResult }: ScanModalProps) {
  const { videoRef, canvasRef, stream, captured, setCaptured, startCamera, stopCamera, capture } = useCamera();
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<ScannedLabel | null>(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
      setScanned(null); setCaptured(null); setError(null);
    } else { stopCamera(); }
    return () => stopCamera();
  }, [isOpen]);

  const handleCapture = async () => {
    const img = await capture();
    if (img) {
      setCaptured(img);
      setScanning(true);
      try {
        // Convert base64 to blob and upload
        const base64Data = img.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        const formData = new FormData();
        formData.append('image', blob, 'etiqueta.jpg');

        const res = await fetch('/api/cocina/appcc/scan', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success && (data as any).data) {
          const d = (data as any).data as ScannedLabel;
          setScanned(d);
          onResult(d);
        } else {
          setError(data.error || 'No se pudo leer la etiqueta. Intenta con más luz.');
        }
      } catch { setError('Error de conexión'); }
      setScanning(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch('/api/cocina/appcc/scan', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success && data.data) {
        setScanned(data.data);
        onResult(data.data);
      } else {
        setError(data.error || 'No se pudo leer la imagen');
      }
    } catch { setError('Error de conexión'); }
    setScanning(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl border border-divider shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-3 border-b border-divider flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="camera" className="w-4 h-4 text-gold" />
            <span className="text-[11px] font-bold text-ink">Escáner de Lote</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-cream"><Icon name="x" className="w-4 h-4" /></button>
        </div>

        {/* Camera / Preview */}
        <div className="relative bg-black aspect-video rounded-t-lg overflow-hidden">
          {!captured && stream ? (
            <>
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-4 border-2 border-dashed border-gold/40 rounded-lg" />
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-white/60 text-[9px]">
                  Enmarca la etiqueta del lote
                </div>
              </div>
            </>
          ) : captured ? (
            <img src={captured} alt="Capturada" className="w-full h-full object-contain bg-black" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-white/50">
                <Icon name="camera" className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-[10px]">Abre la cámara</p>
              </div>
            </div>
          )}
          {scanning && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-[11px] font-medium">Procesando OCR...</div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-3 space-y-2">
          {/* Camera buttons */}
          {!captured && (
            <div className="flex gap-2">
              <button onClick={handleCapture} disabled={scanning || !stream} className="flex-1 py-2 rounded-lg bg-gold text-white text-[11px] font-medium flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Icon name="camera" className="w-3.5 h-3.5" /> Capturar foto
              </button>
              <label className="flex-1 py-2 rounded-lg bg-cream text-ink text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-pointer hover:bg-divider/30">
                <Icon name="package" className="w-3.5 h-3.5" /> Subir foto
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          )}

          {/* Apply result */}
          {scanned && (
            <div className="bg-cream rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Icon name={scanned.matched ? 'checkCircle' : 'alertTriangle'} className={cn('w-3.5 h-3.5', scanned.matched ? 'text-success' : 'text-gold')} />
                <span className="text-[10px] font-medium text-ink">
                  {scanned.matched ? 'Ingrediente encontrado en BD' : 'Nuevo producto — rellena manualmente'}
                </span>
              </div>
              {scanned.lote && (
                <div className="flex items-center gap-1.5"><Icon name="hash" className="w-3 h-3 text-ink-soft" /><span className="text-[10px] font-mono">Lote: <strong>{scanned.lote}</strong></span></div>
              )}
              {scanned.caducidad && (
                <div className="flex items-center gap-1.5"><Icon name="calendar" className="w-3 h-3 text-ink-soft" /><span className="text-[10px]">Caducidad: <strong>{scanned.caducidad}</strong></span></div>
              )}
              {scanned.producto && (
                <div className="flex items-center gap-1.5"><Icon name="package" className="w-3 h-3 text-ink-soft" /><span className="text-[10px]">Producto: <strong>{scanned.producto}</strong></span></div>
              )}
              {scanned.proveedor && (
                <div className="flex items-center gap-1.5"><Icon name="truck" className="w-3 h-3 text-ink-soft" /><span className="text-[10px]">Proveedor: <strong>{scanned.proveedor}</strong></span></div>
              )}
              {scanned.peso && (
                <div className="flex items-center gap-1.5"><Icon name="scale" className="w-3 h-3 text-ink-soft" /><span className="text-[10px]">Peso: <strong>{scanned.peso} {scanned.unidad}</strong></span></div>
              )}
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => { onResult(scanned); onClose(); }} className="flex-1 py-1.5 rounded-lg bg-success text-white text-[10px] font-medium flex items-center justify-center gap-1">
                  <Icon name="check" className="w-3 h-3" /> Usar datos
                </button>
                <button onClick={() => { setScanned(null); setCaptured(null); }} className="px-3 py-1.5 rounded-lg border border-divider text-[10px] text-ink-soft hover:bg-cream">
                  Reintentar
                </button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-danger/10 rounded-lg p-2 flex items-center gap-1.5">
              <Icon name="warning" className="w-3.5 h-3.5 text-danger shrink-0" />
              <span className="text-[10px] text-danger">{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── Main Page ─────────────── */
export default function AppccPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [centro, setCentro] = useState('J.Benitez — Cocina Central');
  const [activeTab, setActiveTab] = useState('recepcion');
  const [recepciones, setRecepciones] = useState<ControlRecepcion[]>([{ proveedor: '', producto: '', temp: null, embalajeOk: false, caducidadOk: false, caducidad: null, lote: '', ok: false }]);
  const [almacenamiento, setAlmacenamiento] = useState<ControlAlmacenamiento[]>(CAMARAS.map(c => ({ camara: c, tempManana: null, tempTarde: null, ok: false })));
  const [elaboraciones, setElaboraciones] = useState<ControlElaboracion[]>([]);
  const [servicios, setServicios] = useState<ControlServicio[]>([
    { zona: 'Buffet caliente', temp: null, hora: '', ok: false, timeHolding: '' },
    { zona: 'Buffet frío', temp: null, hora: '', ok: false, timeHolding: '' },
    { zona: 'Barra', temp: null, hora: '', ok: false, timeHolding: '' },
  ]);
  const [limpiezas, setLimpiezas] = useState<TareaLimpieza[]>(ZONAS_LIMPIEZA.flatMap(z => z.tareas.map(t => ({ zona: z.zona, tarea: t, realizada: false, responsable: '', verificada: false }))));
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [nuevaIncidencia, setNuevaIncidencia] = useState({ descripcion: '', tipo: 'averia', accion: '', responsable: '' });
  const [aceite, setAceite] = useState({ compuestosPolares: 0, cambiado: false, historial: [] as { fecha: string; valor: number; cambio: boolean }[] });

  const [showScan, setShowScan] = useState(false);
  const [scanTarget, setScanTarget] = useState<number | null>(null);

  useEffect(() => { fetch('/api/events?limit=50', { credentials: 'include' }).then(r => r.json()).then(d => { if (d.success) setEvents(d.data || []); }).catch(() => {}); }, []);
  useEffect(() => {
    if (!selectedEvent) return;
    fetch(`/api/escandallo/event/${selectedEvent}`, { credentials: 'include' }).then(r => r.json()).then(d => {
      if (d.success) setElaboraciones((d.data.theoretical || []).map((i: any) => ({ plato: i.ingredient_name, tempCoccion: null, horaCoccion: '', responsable: '', ok: false, lote: '', alergenicos: [] as string[] })));
    }).catch(() => {});
  }, [selectedEvent]);

  const addRecepcion = () => setRecepciones(p => [...p, { proveedor: '', producto: '', temp: null, embalajeOk: false, caducidadOk: false, caducidad: null, lote: '', ok: false }]);
  const updateRec = (i: number, f: string, v: any) => setRecepciones(p => p.map((r, idx) => idx === i ? { ...r, [f]: v } : r));

  // OCR scan handler — rellena campos del formulario
  const handleScanResult = useCallback((data: ScannedLabel) => {
    if (scanTarget === null) return;
    setRecepciones(p => p.map((r, idx) => {
      if (idx !== scanTarget) return r;
      return {
        ...r,
        producto: data.producto || r.producto,
        proveedor: data.proveedor || r.proveedor,
        lote: data.lote || r.lote,
        caducidad: data.caducidad || r.caducidad,
        temp: data.peso ? (data.unidad === 'kg' ? data.peso * 1000 : data.peso) : r.temp,
      };
    }));
    setShowScan(false);
    setScanTarget(null);
  }, [scanTarget]);

  // Guardar una recepción APPCC de forma persistente (crea lote + stock + movimiento)
  const [guardando, setGuardando] = useState<number | null>(null);
  const [recError, setRecError] = useState<string | null>(null);
  const guardarRecepcion = async (i: number) => {
    const r = recepciones[i];
    if (!r.producto) return;
    setGuardando(i); setRecError(null);
    try {
      const res = await fetch('/api/cocina/appcc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          ingredient_name: r.producto,
          supplier: r.proveedor,
          temperature: r.temp,
          batch_quantity: 1,
          unit: 'ud',
          expiry_date: r.caducidad ?? null,
          condition_ok: !!r.embalajeOk,
          lot_number: r.lote || `LOT-${Date.now().toString(36).toUpperCase()}`,
          source: r.lote ? 'scan' : 'manual',
        }),
      });
      const data = await res.json();
      if (data.success) updateRec(i, 'ok', true);
      else setRecError(data.error || 'Error al guardar');
    } catch { setRecError('Error de red'); }
    setGuardando(null);
  };

  const updateAlm = (i: number, f: string, v: any) => setAlmacenamiento(p => p.map((a, idx) => idx === i ? { ...a, [f]: v } : a));
  const updateElab = (i: number, f: string, v: any) => setElaboraciones(p => p.map((e, idx) => idx === i ? { ...e, [f]: v } : e));
  const updateServ = (i: number, f: string, v: any) => setServicios(p => p.map((s, idx) => idx === i ? { ...s, [f]: v } : s));
  const updateLimp = (i: number, f: string, v: any) => setLimpiezas(p => p.map((l, idx) => idx === i ? { ...l, [f]: v } : l));

  const addIncidencia = () => { if (!nuevaIncidencia.descripcion) return; setIncidencias(p => [...p, { ...nuevaIncidencia, resuelta: false, hora: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) }]); setNuevaIncidencia({ descripcion: '', tipo: 'averia', accion: '', responsable: '' }); };

  const completados = (arr: any[]) => arr.filter((x: any) => x.ok || x.realizada || x.resuelta).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-white rounded-lg border border-divider/50 p-3 flex items-center gap-3">
        <div className="flex-1">
          <label className="text-[10px] text-ink-soft font-medium block mb-0.5">Centro</label>
          <select value={centro} onChange={e => setCentro(e.target.value)} className="w-full px-2 py-1.5 rounded-lg border border-divider text-[11px] bg-gold/5 border-gold/20 font-medium">
            <option value="Cocina Central">Cocina Central</option>
            <option value="Sala Principal">Sala Principal</option>
            <option value="Truck Externo">Truck Externo</option>
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-ink-soft font-medium block mb-0.5">Fecha</label>
          <input type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-2 py-1.5 rounded-lg border border-divider text-[11px]" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn('inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all', activeTab === tab.id ? 'bg-ink text-white shadow-sm' : 'bg-white text-ink-soft hover:bg-cream border border-divider/50')}>
            <Icon name={tab.icon} className="w-3 h-3" />{tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* RECEPCIÓN — con botón de escáner de lote */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'recepcion' && (
        <div className="space-y-2">
          <div className="bg-gradient-to-r from-gold/10 to-amber-50 rounded-lg border border-gold/20 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="info" className="w-3.5 h-3.5 text-gold" />
              <span className="text-[10px] text-ink font-medium">Recepción APPCC: escanea la etiqueta del lote o introduce datos manualmente</span>
            </div>
          </div>

          {recepciones.map((r, i) => (
            <div key={i} className={cn('bg-white rounded-lg border border-divider/50 overflow-hidden', r.ok && 'opacity-60')}>
              {/* Row 1: Escáner + Proveedor */}
              <div className="p-2.5 border-b border-divider/30 flex items-center gap-2">
                <button onClick={() => { setScanTarget(i); setShowScan(true); }} className="px-2.5 py-1.5 rounded-lg bg-gold text-white text-[10px] font-medium flex items-center gap-1 hover:bg-gold/80 disabled:opacity-50 transition-colors">
                  <Icon name="camera" className="w-3 h-3" /> Escanear lote
                </button>
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <input value={r.proveedor} onChange={e => updateRec(i, 'proveedor', e.target.value)} placeholder="Proveedor" className="px-2 py-1.5 rounded border border-divider text-[11px]" />
                  <input value={r.producto} onChange={e => updateRec(i, 'producto', e.target.value)} placeholder="Producto" className="px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
              </div>

              {/* Row 2: Lote + Caducidad */}
              <div className="px-2.5 py-2 border-b border-divider/30 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Nº Lote</label>
                  <input value={r.lote || ''} onChange={e => updateRec(i, 'lote', e.target.value)} placeholder="Auto-generado" className="w-full px-2 py-1.5 rounded border border-divider text-[11px] font-mono" />
                </div>
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Caducidad</label>
                  <input type="date" value={r.caducidad || ''} onChange={e => updateRec(i, 'caducidad', e.target.value || null)} className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Temp °C</label>
                  <input type="number" step="0.1" value={r.temp ?? ''} onChange={e => updateRec(i, 'temp', e.target.value ? Number(e.target.value) : null)} placeholder="Ref ≤4 / Cong ≤-18" className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
                <div className="flex items-end gap-1">
                  <label onClick={() => updateRec(i, 'embalajeOk', !r.embalajeOk)} className={cn('flex-1 text-[9px] px-1.5 py-1.5 rounded cursor-pointer text-center font-medium transition-colors', r.embalajeOk ? 'bg-success/10 text-success border border-success/20' : 'bg-cream text-ink-soft border border-divider')} title="Embalaje OK">
                    Embalaje
                  </label>
                  <label onClick={() => updateRec(i, 'caducidadOk', !r.caducidadOk)} className={cn('flex-1 text-[9px] px-1.5 py-1.5 rounded cursor-pointer text-center font-medium transition-colors', r.caducidadOk ? 'bg-success/10 text-success border border-success/20' : 'bg-cream text-ink-soft border border-divider')} title="Caducidad OK">
                    Caducidad
                  </label>
                </div>
              </div>

              {/* Row 3: Guardar */}
              <div className="px-2.5 py-2 flex items-center justify-between bg-cream/30">
                <span className="text-[9px] text-ink-soft">
                  {r.lote ? '📷 Lote escaneado' : '✏️ Datos manuales'}
                  {r.ok && ' · ✓ Registrado'}
                </span>
                <button onClick={() => guardarRecepcion(i)} disabled={guardando === i} className={cn('px-3 py-1.5 rounded-lg text-[10px] font-medium flex items-center gap-1 transition-colors', r.ok ? 'bg-success text-white' : 'bg-ink text-white hover:bg-ink-light disabled:opacity-50')}>
                  {guardando === i ? <Icon name="loader" className="w-3 h-3 animate-spin" /> : r.ok ? <Icon name="check" className="w-3 h-3" /> : <Icon name="check" className="w-3 h-3" />}
                  {guardando === i ? 'Guardando...' : r.ok ? '✓ OK' : 'Registrar'}
                </button>
              </div>
              {recError && <p className="px-2.5 pb-2 text-[9px] text-danger">{recError}</p>}
            </div>
          ))}
          <button onClick={addRecepcion} className="px-3 py-1.5 rounded-lg border border-dashed border-divider text-[10px] text-ink-soft hover:bg-cream flex items-center gap-1 transition-colors"><Icon name="plus" className="w-3 h-3" /> Añadir línea</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ALMACÉN — con alertas de temperatura */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'almacenamiento' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-2 flex items-center gap-2">
            <Icon name="thermometer" className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] text-ink-soft">Temperaturas diarias de cámaras. Refrigerada: 0-4°C · Congelación: ≤-18°C</span>
          </div>
          {almacenamiento.map((a, i) => {
            const tempOk = a.tempManana !== null && a.tempTarde !== null && a.tempManana <= 4 && a.tempTarde <= 4;
            const tempCong = a.camara.includes('Congelación') && a.tempManana !== null && a.tempManana <= -18 && a.tempTarde !== null && a.tempTarde <= -18;
            const isOk = a.camara.includes('Congelación') ? tempCong : tempOk;

            return (
              <div key={i} className={cn('bg-white rounded-lg border overflow-hidden', a.ok ? 'border-success/30' : isOk ? 'border-success/50' : 'border-danger/30')}>
                <div className="px-3 py-2 border-b border-divider/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name={a.camara.includes('Congelación') ? 'snowflake' : 'package'} className={cn('w-3.5 h-3.5', isOk ? 'text-success' : 'text-danger')} />
                    <span className="text-[11px] font-medium text-ink">{a.camara}</span>
                    {isOk && <span className="text-[8px] px-1.5 py-0.5 rounded bg-success/10 text-success">OK</span>}
                    {!isOk && a.tempManana !== null && <span className="text-[8px] px-1.5 py-0.5 rounded bg-danger/10 text-danger">Alerta</span>}
                  </div>
                  <button onClick={() => updateAlm(i, 'ok', !a.ok)} className={cn('px-2 py-0.5 rounded text-[9px] font-medium', a.ok ? 'bg-success text-white' : 'bg-ink text-white')}>{a.ok ? '✓' : 'Validar'}</button>
                </div>
                <div className="p-2.5 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-ink-soft block mb-0.5">Mañana °C</label>
                    <input type="number" step="0.1" value={a.tempManana ?? ''} onChange={e => updateAlm(i, 'tempManana', e.target.value ? Number(e.target.value) : null)} className={cn('w-full px-2 py-1.5 rounded border text-[11px]', a.tempManana !== null && (a.tempManana > 4 || a.tempManana < -18) ? 'border-danger' : 'border-divider')} />
                  </div>
                  <div>
                    <label className="text-[9px] text-ink-soft block mb-0.5">Tarde °C</label>
                    <input type="number" step="0.1" value={a.tempTarde ?? ''} onChange={e => updateAlm(i, 'tempTarde', e.target.value ? Number(e.target.value) : null)} className={cn('w-full px-2 py-1.5 rounded border text-[11px]', a.tempTarde !== null && (a.tempTarde > 4 || a.tempTarde < -18) ? 'border-danger' : 'border-divider')} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ELABORACIÓN — con lote y alérgenos */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'elaboracion' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-2 flex items-center gap-2">
            <Icon name="info" className="w-3.5 h-3.5 text-gold" />
            <span className="text-[10px] text-ink-soft">Control de cocción: temp ≥65°C, hora, responsable y nº de lote utilizado</span>
          </div>
          {elaboraciones.length === 0 ? <p className="text-[10px] text-ink-soft">Sin platos — selecciona un evento primero</p> : elaboraciones.map((e, i) => (
            <div key={i} className={cn('bg-white rounded-lg border overflow-hidden', e.ok && 'opacity-60')}>
              <div className="px-3 py-2 border-b border-divider/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name="cookingPot" className="w-3.5 h-3.5 text-gold" />
                  <span className="text-[11px] font-medium text-ink">{e.plato}</span>
                  {e.alergenicos.length > 0 && (
                    <div className="flex gap-0.5">
                      {e.alergenicos.map(a => (
                        <span key={a} className="text-[7px] px-1 py-0.5 rounded bg-danger/10 text-danger font-medium">{a}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={() => updateElab(i, 'ok', !e.ok)} className={cn('px-2 py-0.5 rounded text-[9px] font-medium', e.ok ? 'bg-success text-white' : 'bg-ink text-white')}>{e.ok ? '✓' : 'Validar'}</button>
              </div>
              <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Temp °C ≥65</label>
                  <input type="number" step="0.1" value={e.tempCoccion ?? ''} onChange={val => updateElab(i, 'tempCoccion', val.target.value ? Number(val.target.value) : null)} className={cn('w-full px-2 py-1.5 rounded border text-[11px]', e.tempCoccion !== null && e.tempCoccion < 65 ? 'border-danger' : 'border-divider')} />
                </div>
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Hora</label>
                  <input type="time" value={e.horaCoccion} onChange={val => updateElab(i, 'horaCoccion', val.target.value)} className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Lote utilizado</label>
                  <input value={e.lote || ''} onChange={val => updateElab(i, 'lote', val.target.value)} placeholder="Nº lote ingrediente" className="w-full px-2 py-1.5 rounded border border-divider text-[11px] font-mono" />
                </div>
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Responsable</label>
                  <input value={e.responsable} onChange={val => updateElab(i, 'responsable', val.target.value)} className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
              </div>
              {/* Alergenos */}
              <div className="px-3 pb-2 flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-ink-soft">Alergenos detectados:</span>
                {ALEGENOS_LIST.map(a => {
                  const checked = e.alergenicos.includes(a);
                  return (
                    <label key={a} onClick={() => updateElab(i, 'alergenicos', checked ? e.alergenicos.filter(x => x !== a) : [...e.alergenicos, a])} className={cn('text-[8px] px-1.5 py-0.5 rounded cursor-pointer border transition-colors', checked ? 'bg-danger/10 text-danger border-danger/20' : 'bg-cream text-ink-soft border-divider')}>
                      {a.replace('_', ' ')}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SERVICIO — con food holding */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'servicio' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-2 flex items-center gap-2">
            <Icon name="info" className="w-3.5 h-3.5 text-gold" />
            <span className="text-[10px] text-ink-soft">Control de temperatura en servicio. Caliente ≥63°C · Frío ≤8°C · Holding máx 2h</span>
          </div>
          {servicios.map((s, i) => (
            <div key={i} className={cn('bg-white rounded-lg border overflow-hidden', s.ok && 'opacity-60')}>
              <div className="px-3 py-2 border-b border-divider/30 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink">{s.zona}</span>
                <button onClick={() => updateServ(i, 'ok', !s.ok)} className={cn('px-2 py-0.5 rounded text-[9px] font-medium', s.ok ? 'bg-success text-white' : 'bg-ink text-white')}>{s.ok ? '✓' : 'Validar'}</button>
              </div>
              <div className="p-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Temp °C</label>
                  <input type="number" step="0.1" value={s.temp ?? ''} onChange={e => updateServ(i, 'temp', e.target.value ? Number(e.target.value) : null)} placeholder="°C" className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
                <div>
                  <label className="text-[9px] text-ink-soft block mb-0.5">Hora</label>
                  <input type="time" value={s.hora} onChange={e => updateServ(i, 'hora', e.target.value)} className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
                <div className="col-span-2">
                  <label className="text-[9px] text-ink-soft block mb-0.5">Tiempo en holding</label>
                  <input type="text" value={s.timeHolding} onChange={e => updateServ(i, 'timeHolding', e.target.value)} placeholder="Ej: 1h 30min" className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* LIMPIEZA — con verificación */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'limpieza' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-2 flex items-center gap-2">
            <Icon name="info" className="w-3.5 h-3.5 text-gold" />
            <span className="text-[10px] text-ink-soft">Checklist de limpieza. Cada tarea debe ser realizada y verificada por otra persona.</span>
          </div>
          {ZONAS_LIMPIEZA.map(z => (
            <div key={z.zona} className="bg-white rounded-lg border border-divider/50 overflow-hidden">
              <div className="px-3 py-1.5 bg-cream/50 text-[11px] font-medium text-ink flex items-center justify-between">
                <span>{z.zona}</span>
                <span className="text-[9px] text-ink-soft">
                  {limpiezas.filter(l => l.zona === z.zona && l.realizada).length}/{limpiezas.filter(l => l.zona === z.zona).length} realizadas
                </span>
              </div>
              {limpiezas.filter(l => l.zona === z.zona).map((l, idx) => {
                const ri = limpiezas.findIndex(x => x.zona === l.zona && x.tarea === l.tarea);
                return (
                  <div key={idx} className={cn('flex items-center gap-2 px-3 py-2 border-t border-divider/30', l.realizada && !l.verificada ? 'bg-success/5' : l.verificada ? 'bg-success/10' : '')}>
                    <button onClick={() => updateLimp(ri, 'realizada', !l.realizada)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', l.realizada ? 'bg-success border-success text-white' : 'border-divider')} title="Marcar realizada">
                      {l.realizada && <Icon name="check" className="w-2.5 h-2.5" />}
                    </button>
                    <span className={cn('text-[11px] flex-1', l.realizada && 'line-through text-ink-soft')}>{l.tarea}</span>
                    <input value={l.responsable} onChange={e => updateLimp(ri, 'responsable', e.target.value)} placeholder="Resp." className="w-20 px-1.5 py-1 rounded border border-divider text-[9px]" />
                    <button onClick={() => updateLimp(ri, 'verificada', !l.verificada)} className={cn('w-4 h-4 rounded border-2 flex items-center justify-center shrink-0', l.verificada ? 'bg-gold border-gold text-white' : 'border-divider')} title="Verificar">
                      {l.verificada ? <Icon name="check" className="w-2.5 h-2.5" /> : <Icon name="shield" className="w-2.5 h-2.5 text-ink-soft" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* INCIDENCIAS — con foto */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'incidencias' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-3 space-y-2">
            <input value={nuevaIncidencia.descripcion} onChange={e => setNuevaIncidencia(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción de la incidencia..." className="w-full px-2 py-1.5 rounded border border-divider text-[11px]" />
            <div className="flex gap-2 flex-wrap">
              <select value={nuevaIncidencia.tipo} onChange={e => setNuevaIncidencia(p => ({ ...p, tipo: e.target.value }))} className="px-2 py-1.5 rounded border border-divider text-[10px]">
                <option value="averia">Avería</option>
                <option value="temperatura">Temperatura</option>
                <option value="higiene">Higiene</option>
                <option value="caducado">Producto caducado</option>
              </select>
              <input value={nuevaIncidencia.accion} onChange={e => setNuevaIncidencia(p => ({ ...p, accion: e.target.value }))} placeholder="Medida correctora..." className="flex-1 px-2 py-1.5 rounded border border-divider text-[11px]" />
              <button onClick={addIncidencia} className="px-3 py-1.5 rounded-lg bg-ink text-white text-[10px] font-medium flex items-center gap-1">
                <Icon name="plus" className="w-3 h-3" /> Añadir
              </button>
            </div>
          </div>
          {incidencias.map((inc, i) => (
            <div key={i} className={cn('bg-white rounded-lg border overflow-hidden', inc.resuelta ? 'border-success/30' : 'border-danger/30')}>
              <div className="px-3 py-2 border-b border-divider/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Icon name={inc.tipo === 'temperatura' ? 'thermometer' : inc.tipo === 'higiene' ? 'shield' : inc.tipo === 'caducado' ? 'snowflake' : 'alertTriangle'} className={cn('w-3.5 h-3.5', inc.resuelta ? 'text-success' : 'text-danger')} />
                  <span className="text-[11px] font-medium text-ink">{inc.descripcion}</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-cream text-ink-soft">{inc.tipo}</span>
                  <span className="text-[8px] text-ink-soft">{inc.hora}</span>
                </div>
                <button onClick={() => setIncidencias(p => p.map((x, j) => j === i ? { ...x, resuelta: !x.resuelta } : x))} className={cn('text-[9px] px-2 py-0.5 rounded font-medium', inc.resuelta ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger')}>
                  {inc.resuelta ? '✓ Resuelta' : 'Pendiente'}
                </button>
              </div>
              {inc.accion && <div className="px-3 py-2 text-[10px] text-ink-soft bg-cream/30">Correctiva: {inc.accion}</div>}
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ACEITE — con historial */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'aceite' && (
        <div className="space-y-2">
          <div className="bg-white rounded-lg border border-divider/50 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="info" className="w-3.5 h-3.5 text-gold" />
                <span className="text-[10px] text-ink font-medium">Control de aceite de fritura</span>
              </div>
              <span className={cn('text-[10px] font-medium', aceite.compuestosPolares > 25 ? 'text-danger' : aceite.compuestosPolares > 20 ? 'text-gold' : 'text-success')}>
                {aceite.compuestosPolares > 25 ? '⚠ Supera límite' : aceite.compuestosPolares > 20 ? '⚠ Alerta' : '✓ OK'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input type="number" step="0.1" value={aceite.compuestosPolares || ''} onChange={e => setAceite(p => ({ ...p, compuestosPolares: Number(e.target.value) }))} placeholder="Polares %" className="px-2 py-1.5 rounded border border-divider text-[11px]" />
              <button onClick={() => {
                const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                setAceite(p => ({
                  ...p,
                  cambiado: !p.cambiado,
                  historial: [...p.historial, { fecha: now, valor: p.compuestosPolares, cambio: !p.cambiado }],
                }));
              }} className={cn('px-2 py-1.5 rounded-lg text-[10px] font-medium flex items-center justify-center gap-1', aceite.cambiado ? 'bg-success text-white' : 'bg-ink text-white')}>
                <Icon name={aceite.cambiado ? 'check' : 'refreshCcw'} className="w-3 h-3" />
                {aceite.cambiado ? 'Cambiado ✓' : 'Marcar cambio'}
              </button>
            </div>
            {aceite.compuestosPolares > 25 && <p className="text-[10px] text-danger font-medium">⚠ Supera 25% — NO USAR, cambiar aceite inmediatamente</p>}
            {aceite.compuestosPolares > 20 && aceite.compuestosPolares <= 25 && <p className="text-[10px] text-gold font-medium">⚠ Cerca del límite — planificar cambio</p>}
          </div>

          {/* Historial */}
          {aceite.historial.length > 0 && (
            <div className="bg-white rounded-lg border border-divider/50 overflow-hidden">
              <div className="px-3 py-2 border-b border-divider/30 text-[10px] font-medium text-ink-soft">Historial de mediciones</div>
              {aceite.historial.slice().reverse().slice(0, 10).map((h, idx) => (
                <div key={idx} className="px-3 py-1.5 border-b border-divider/20 flex items-center justify-between text-[10px]">
                  <span className="text-ink-soft">{h.fecha}</span>
                  <span className={cn('font-medium', h.valor > 25 ? 'text-danger' : h.valor > 20 ? 'text-gold' : 'text-success')}>
                    {h.valor}% {h.cambio ? '· Cambio de aceite' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer KPIs */}
      <div className="bg-ink text-white rounded-lg p-3 grid grid-cols-4 gap-3 text-center">
        <div><Icon name="truck" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(recepciones)}/{recepciones.length}</p><p className="text-[8px] text-white/50">Recepción</p></div>
        <div><Icon name="package" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(almacenamiento)}/{almacenamiento.length}</p><p className="text-[8px] text-white/50">Almacén</p></div>
        <div><Icon name="cookingPot" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(elaboraciones)}/{elaboraciones.length}</p><p className="text-[8px] text-white/50">Cocción</p></div>
        <div><Icon name="list" className="w-4 h-4 mx-auto mb-0.5 text-gold" /><p className="text-[11px] font-bold">{completados(limpiezas)}/{limpiezas.length}</p><p className="text-[8px] text-white/50">Limpieza</p></div>
      </div>

      {/* Scan Modal */}
      <ScanModal isOpen={showScan} onClose={() => { setShowScan(false); setScanTarget(null); }} onResult={handleScanResult} />
    </div>
  );
}