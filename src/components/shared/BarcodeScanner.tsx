'use client';

import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let active = true;

    // Intentar cargar html5-qrcode dinámicamente (no está en dependencias)
    const startCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (!active) { s.getTracks().forEach(t => t.stop()); return; }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
        }
      } catch (err: any) {
        if (active) setError('No se pudo acceder a la cámara: ' + (err.message || ''));
      }
    };

    startCamera();
    return () => { active = false; if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    // Simular OCR: mostrar la imagen capturada y pedir confirmación
    const img = document.createElement('img');
    img.src = dataUrl;
    img.className = 'max-w-full h-auto rounded-lg';
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-xl p-4 max-w-md w-full space-y-3">
        <h3 class="text-sm font-medium text-ink">Captura realizada</h3>
        <p class="text-xs text-ink-soft">Introduce el código de barras manualmente (OCR no disponible sin librería externa)</p>
        <input id="scan-code-input" type="text" class="w-full px-3 py-2 rounded-lg border border-divider text-xs" placeholder="Código de barras..." autofocus />
        <div class="flex gap-2 justify-end">
          <button id="scan-cancel" class="px-3 py-1.5 rounded-lg border border-divider text-xs text-ink-soft hover:bg-cream">Cancelar</button>
          <button id="scan-confirm" class="px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-medium">Aceptar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('scan-confirm')?.addEventListener('click', () => {
      const code = (document.getElementById('scan-code-input') as HTMLInputElement)?.value?.trim();
      if (code) onScan(code);
      overlay.remove();
    });
    document.getElementById('scan-cancel')?.addEventListener('click', () => {
      overlay.remove();
    });
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl p-4 max-w-md w-full space-y-3">
          <p className="text-xs text-danger">{error}</p>
          <p className="text-xs text-ink-soft">Puedes escribir el código manualmente en el campo de texto.</p>
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-ink text-white text-xs font-medium">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-4 max-w-md w-full space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-ink">Escanear código</h3>
          <button onClick={() => { if (stream) stream.getTracks().forEach(t => t.stop()); onClose(); }}
            className="p-1 rounded hover:bg-cream transition-colors">
            <svg className="w-5 h-5 text-ink-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <div className="absolute inset-0 border-2 border-gold/50 rounded-lg" style={{ clipPath: 'inset(20%)' }} />
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/60 bg-black/50 px-2 py-0.5 rounded">
            Enfoca el código de barras
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCapture}
            className="flex-1 px-4 py-2 rounded-lg bg-ink text-white text-xs font-medium hover:bg-ink-light transition-colors">
            Capturar y escribir código
          </button>
          <button onClick={() => { if (stream) stream.getTracks().forEach(t => t.stop()); onClose(); }}
            className="px-4 py-2 rounded-lg border border-divider text-xs text-ink-soft hover:bg-cream transition-colors">
            Cancelar
          </button>
        </div>
        <p className="text-[10px] text-ink-soft text-center">
          ⚠️ Sin librería OCR instalada. Tras capturar, escribe el código manualmente.
          Para OCR automático, instalar: <code className="bg-cream px-1 rounded">npm install html5-qrcode</code>
        </p>
      </div>
    </div>
  );
}