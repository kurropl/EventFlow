"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, ScanLine, Barcode, Receipt, FileText, Image, X, Check, Loader2, AlertTriangle, ArrowRight, Package } from "lucide-react";

type ScanMode = "ticket_proveedor" | "etiqueta_ingrediente" | "albaran" | "codigo_barras";

interface ParsedItem {
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  supplier?: string;
  lot?: string;
  expiry?: string;
  barcode?: string;
}

interface MatchedIngredient {
  id: string;
  name: string;
  current_price: number | null;
}

interface ScanResult {
  mode: ScanMode;
  text: string;
  confidence: number;
  items: ParsedItem[];
  matchedIngredients: MatchedIngredient[];
}

interface ApplyResult {
  name: string;
  status: string;
  stockId?: string;
  ingredientId?: string;
}

interface OCRScannerProps {
  eventId?: string;
  onResult?: (data: ScanResult) => void;
}

const MODES: { id: ScanMode; label: string; icon: any; desc: string }[] = [
  { id: "ticket_proveedor", label: "Ticket", icon: Receipt, desc: "Factura/ticket de compra" },
  { id: "etiqueta_ingrediente", label: "Etiqueta", icon: ScanLine, desc: "Etiqueta de ingrediente con lote" },
  { id: "albaran", label: "Albarán", icon: FileText, desc: "Albarán de entrada" },
  { id: "codigo_barras", label: "Barras", icon: Barcode, desc: "Código de barras o QR" },
];

export default function OCRScanner({ eventId, onResult }: OCRScannerProps) {
  const [mode, setMode] = useState<ScanMode>("ticket_proveedor");
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyResults, setApplyResults] = useState<ApplyResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setIsActive(true);
    } catch (err) {
      setError("No se pudo acceder a la cámara");
      console.error("Camera error:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setIsActive(false);
  }, [stream]);

  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setProcessing(true);
    setError(null);
    setApplyResults(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append("image", blob, "capture.jpg");
      formData.append("mode", mode);

      try {
        const res = await fetch("/api/ocr/process", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.success && data.data) {
          setLastResult(data.data);
          if (onResult) onResult(data.data);
        } else {
          setError(data.error || "Error al procesar imagen");
        }
      } catch (err) {
        setError("Error de conexión al procesar OCR");
        console.error("OCR Error:", err);
      } finally {
        setProcessing(false);
      }
    }, "image/jpeg", 0.85);
  }, [mode, onResult]);

  const handleApply = async () => {
    if (!lastResult || !lastResult.items || lastResult.items.length === 0) return;
    setApplying(true);
    setError(null);

    try {
      const res = await fetch("/api/ocr/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: lastResult.mode,
          items: lastResult.items,
          eventId: eventId || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setApplyResults(data.results);
      } else {
        setError(data.error || "Error al aplicar datos");
      }
    } catch {
      setError("Error de conexión al aplicar datos");
    } finally {
      setApplying(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setError(null);
    setApplyResults(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("mode", mode);

    try {
      const res = await fetch("/api/ocr/process", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.data) {
        setLastResult(data.data);
        if (onResult) onResult(data.data);
      } else {
        setError(data.error || "Error al procesar imagen");
      }
    } catch {
      setError("Error al procesar archivo");
    } finally {
      setProcessing(false);
    }
  };

  const resetAll = () => {
    setLastResult(null);
    setApplyResults(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2 flex-wrap">
        {MODES.map((opt) => (
          <button
            key={opt.id}
            onClick={() => { setMode(opt.id); resetAll(); }}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5
              ${mode === opt.id ? "bg-amber-700 text-white shadow" : "bg-stone-100 text-stone-600 hover:bg-stone-200"}
            `}
          >
            <opt.icon className="w-3.5 h-3.5" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Camera view */}
      <div className="relative rounded-xl overflow-hidden bg-black/90 aspect-video">
        {!isActive ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex gap-3">
              <button
                onClick={startCamera}
                className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 transition-colors"
              >
                <Camera className="w-8 h-8" />
                <span className="text-sm font-medium">Cámara</span>
              </button>
              <label className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 transition-colors cursor-pointer">
                <Image className="w-8 h-8" />
                <span className="text-sm font-medium">Subir</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-dashed border-amber-400/40 rounded-lg" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 flex gap-3 justify-center">
              <button
                onClick={captureFrame}
                disabled={processing}
                className="px-6 py-2.5 rounded-lg bg-amber-600 text-white font-medium text-sm hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                {processing ? "Procesando..." : "Capturar"}
              </button>
              <button onClick={stopCamera} className="px-4 py-2.5 rounded-lg bg-stone-700 text-stone-300 text-sm hover:bg-stone-600">
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Result */}
      {lastResult && (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-stone-50 border-b border-stone-200">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${lastResult.confidence > 0.5 ? 'bg-green-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-stone-500 uppercase tracking-wide">
                {MODES.find(m => m.id === lastResult.mode)?.label || lastResult.mode}
              </span>
              <span className="text-xs text-stone-400">
                Confianza: {(lastResult.confidence * 100).toFixed(0)}%
              </span>
            </div>
            <button onClick={resetAll} className="p-1 rounded hover:bg-stone-200">
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>

          {/* Items parseados */}
          {lastResult.items.length > 0 && (
            <div className="divide-y divide-stone-100">
              {lastResult.items.map((item, i) => {
                const matched = lastResult.matchedIngredients?.find(
                  (m: MatchedIngredient) => m.name.toLowerCase() === item.name.toLowerCase()
                );
                return (
                  <div key={i} className="px-4 py-2.5 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Package className="w-3.5 h-3.5 text-stone-400" />
                      <span className="text-stone-700 capitalize">{item.name}</span>
                      {matched && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                          ✓ en BD
                        </span>
                      )}
                      {item.lot && <span className="text-[10px] text-amber-600">Lote: {item.lot}</span>}
                      {item.expiry && <span className="text-[10px] text-red-500">Cad: {item.expiry}</span>}
                    </div>
                    <span className="text-stone-500 text-xs whitespace-nowrap">
                      {item.quantity} {item.unit} {item.cost > 0 && `— ${item.cost.toFixed(2)}€`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Botón Aplicar */}
          {lastResult.items.length > 0 && !applyResults && (
            <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full py-2 rounded-lg bg-amber-700 text-white text-sm font-medium hover:bg-amber-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {applying ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {applying ? 'Aplicando...' : `Aplicar (${lastResult.items.length} items) — crear stock y precios`}
              </button>
            </div>
          )}

          {/* Resultados de aplicar */}
          {applyResults && (
            <div className="px-4 py-3 bg-green-50 border-t border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">
                  {applyResults.filter(r => r.stockId).length} items aplicados
                </span>
              </div>
              <div className="space-y-1 text-xs text-green-700">
                {applyResults.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span>✓</span>
                    <span className="capitalize">{r.name}</span>
                    <span className="text-green-500">[{r.status === 'stock_created' ? 'stock creado' : 'sin match'}]</span>
                  </div>
                ))}
                {applyResults.length > 5 && (
                  <p className="text-green-500">y {applyResults.length - 5} más...</p>
                )}
              </div>
              <button onClick={resetAll} className="mt-2 text-xs text-stone-500 hover:text-stone-700 underline">
                Nueva captura
              </button>
            </div>
          )}

          {/* Texto OCR raw (colapsado) */}
          {lastResult.text && lastResult.items.length === 0 && (
            <details className="px-4 py-2">
              <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600">Texto extraído</summary>
              <pre className="mt-2 text-xs text-stone-500 whitespace-pre-wrap max-h-32 overflow-y-auto">
                {lastResult.text}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}