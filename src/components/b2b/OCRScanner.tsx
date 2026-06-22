"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { 
  Camera, 
  ScanLine, 
  Barcode, 
  Receipt, 
  FileText, 
  Image, 
  Upload,
  X,
  Check,
  Loader2,
  AlertTriangle
} from "lucide-react";

type ScanMode = "barcode" | "receipt" | "label" | "document";

interface OCRScannerProps {
  eventId?: string;
  onResult?: (data: ScanResult) => void;
}

interface ScanResult {
  type: "barcode" | "receipt" | "label" | "document";
  text: string;
  image?: string;
  confidence: number;
  items?: {
    name: string;
    quantity: number;
    unit: string;
    cost: number;
  }[];
  timestamp: string;
}

export default function OCRScanner({ eventId, onResult }: OCRScannerProps) {
  const [mode, setMode] = useState<ScanMode>("barcode");
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
      }
      setIsActive(true);
    } catch (err) {
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

  // Capture frame -> canvas -> Tesseract OCR
  const captureFrame = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setProcessing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Convert to blob for processing
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append("image", blob);
      formData.append("mode", mode);

      try {
        const res = await fetch("/api/ocr/process", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();

        if (data.success && data.data) {
          setLastResult(data.data as ScanResult);
          if (onResult) onResult(data.data);
        }
      } catch (err) {
        console.error("OCR Error:", err);
      } finally {
        setProcessing(false);
      }
    }, "image/jpeg", 0.8);
  }, [mode, onResult]);

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <div className="flex gap-2">
        {[
          { id: "barcode" as const, label: "Barras", icon: Barcode },
          { id: "receipt" as const, label: "Ticket", icon: Receipt },
          { id: "label" as const, label: "Etiqueta", icon: ScanLine },
          { id: "document" as const, label: "Doc", icon: FileText },
        ].map((opt) => (
          <button
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all
              ${mode === opt.id ? "bg-amber-600 text-white" : "bg-stone-100 text-stone-600"}
            `}
          >
            <opt.icon className="w-4 h-4 inline mr-1" />
            {opt.label}
          </button>
        ))}
      </div>

      {/* Camera view */}
      <div className="relative rounded-xl overflow-hidden bg-black/90 aspect-video">
        {!isActive ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={startCamera}
              className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 transition-colors"
            >
              <Camera className="w-10 h-10" />
              <span className="text-sm font-medium">Abrir cámara</span>
            </button>
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

            {/* Scanner overlay */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4 border-2 border-dashed border-amber-400/40 rounded-lg" />
            </div>

            {/* Controls overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex gap-3 justify-center">
              <button
                onClick={captureFrame}
                disabled={processing}
                className="px-6 py-2.5 rounded-lg bg-amber-600 text-white font-medium text-sm
                  hover:bg-amber-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Image className="w-4 h-4" />
                )}
                Capturar
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2.5 rounded-lg bg-stone-700 text-stone-300 text-sm hover:bg-stone-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      {/* Result */}
      {lastResult && (
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-xs text-stone-400 uppercase tracking-wide">
                {mode === "barcode" ? "Código de barras" : mode === "receipt" ? "Ticket" : "Etiqueta"}
              </span>
              <p className="text-sm text-stone-600 mt-1">
                Confianza: {(lastResult.confidence * 100).toFixed(0)}%
              </p>
            </div>
            <button
              onClick={() => setLastResult(null)}
              className="p-1 rounded hover:bg-stone-200"
            >
              <X className="w-4 h-4 text-stone-400" />
            </button>
          </div>
          
          {lastResult.items && lastResult.items.length > 0 && (
            <div className="space-y-2">
              {lastResult.items.map((item, i) => (
                <div key={i} className="flex justify-between text-sm py-2 border-b border-stone-100">
                  <span className="text-stone-700">{item.name}</span>
                  <span className="text-stone-500">
                    {item.quantity} {item.unit} — {item.cost.toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          )}

          {lastResult.text && (
            <p className="text-sm text-stone-500 mt-2 whitespace-pre-wrap">
              {lastResult.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}