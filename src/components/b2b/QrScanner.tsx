'use client';

/**
 * QrScanner — Componente de escaneo QR usando html5-qrcode
 * Abre la cámara, detecta códigos QR y ejecuta onScan.
 * Se auto-destruye al desmontar.
 */

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/shared/Icon';

interface QrScannerProps {
  onScan: (decodedText: string) => void;
  onClose?: () => void;
}

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<any>(null);
  const [status, setStatus] = useState<'initializing' | 'scanning' | 'error'>('initializing');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function initScanner() {
      try {
        // Dynamic import because html5-qrcode is ESM
        const { Html5Qrcode } = await import('html5-qrcode');

        if (cancelled) return;

        const scanner = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText: string) => {
            // Éxito: detener escáner y devolver resultado
            scanner.stop().catch(() => {});
            if (!cancelled) {
              setStatus('scanning');
              onScan(decodedText);
            }
          },
          () => {
            // Progreso de escaneo — no hacer nada
          }
        );

        if (!cancelled) {
          setStatus('scanning');
        }
      } catch (err: any) {
        if (cancelled) return;
        setStatus('error');
        setErrorMsg(err?.message || 'Error al iniciar la cámara');
      }
    }

    initScanner();

    return () => {
      cancelled = true;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current.clear().catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-stone-900 border border-stone-700">
      {/* Contenedor del escáner */}
      <div
        id="qr-scanner-container"
        ref={videoRef}
        className="w-full aspect-square max-w-sm mx-auto relative"
      >
        {/* Overlay de estado */}
        {status === 'initializing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white z-10">
            <Icon name="spinner" className="w-8 h-8 animate-spin mb-2" />
            <p className="text-sm">Iniciando cámara...</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white z-10 p-4">
            <Icon name="alertCircle" className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-red-300 text-center mb-2">
              {errorMsg || 'No se pudo acceder a la cámara'}
            </p>
            <p className="text-xs text-stone-400 text-center">
              Asegúrate de permitir el acceso a la cámara en tu navegador.
            </p>
          </div>
        )}
        {status === 'scanning' && (
          <div className="absolute inset-0 pointer-events-none z-10">
            {/* Cuadro guía QR */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] border-2 border-[#C9A84C]/60 rounded-lg">
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-[#C9A84C]" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-[#C9A84C]" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-[#C9A84C]" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-[#C9A84C]" />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-800">
        <span className="text-xs text-stone-400">
          {status === 'scanning'
            ? 'Enfoca el código QR en el recuadro'
            : status === 'initializing'
            ? 'Inicializando...'
            : 'Error de cámara'}
        </span>
        {onClose && (
          <button
            onClick={onClose}
            className="text-xs px-3 py-1 rounded-lg bg-stone-700 text-stone-300 hover:bg-stone-600 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>
    </div>
  );
}