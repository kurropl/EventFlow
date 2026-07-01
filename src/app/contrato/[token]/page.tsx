'use client';
/**
 * J.Benitez — Contrato público + firma dibujada
 *
 * Página pública donde el cliente lee el contrato generado tras aceptar su
 * presupuesto y lo firma dibujando en una pizarra (canvas) — funciona con
 * ratón y con el dedo (pointer events), pensado para firmarse desde el móvil.
 *
 * Acceso: /contrato/[token] donde token = event.client_token
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';

interface ContractData {
  content_html: string;
  status: 'pending' | 'signed' | 'voided';
  signed_at: string | null;
  event: { client_name: string; event_date: string };
}

export default function PublicContractPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contract, setContract] = useState<ContractData | null>(null);
  const [signedByName, setSignedByName] = useState('');
  const [signedByNif, setSignedByNif] = useState('');
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [justSigned, setJustSigned] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/contract/public/${token}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'No se pudo cargar el contrato');
          return;
        }
        setContract(data.data);
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const getCanvasPoint = (canvas: HTMLCanvasElement, e: React.PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = getCanvasPoint(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { x, y } = getCanvasPoint(canvas, e);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  }, []);

  const handlePointerUp = useCallback(() => {
    drawingRef.current = false;
  }, []);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const submitSignature = async () => {
    setSubmitError('');
    if (!signedByName.trim()) { setSubmitError('Tu nombre es obligatorio'); return; }
    if (!signedByNif.trim()) { setSubmitError('Tu NIF es obligatorio'); return; }
    if (!hasDrawn || !canvasRef.current) { setSubmitError('Firma en la pizarra antes de continuar'); return; }

    setSubmitting(true);
    try {
      const signatureData = canvasRef.current.toDataURL('image/png');
      const res = await fetch(`/api/contract/public/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signed_by_name: signedByName,
          signed_by_nif: signedByNif,
          signature_data: signatureData,
        }),
      });
      const data = await res.json();
      if (!data.success) { setSubmitError(data.error || 'Error al firmar'); return; }
      setJustSigned(true);
    } catch {
      setSubmitError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#9CA3AF]">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            <span className="font-bold text-xl text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
          </div>
          <h1 className="text-xl font-serif text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Enlace no válido</h1>
          <p className="text-sm text-[#9CA3AF] mb-6">{error || 'Este enlace ya no está disponible.'}</p>
          <a href="/" className="text-sm font-medium text-[#C9A84C] hover:underline">Volver al inicio →</a>
        </div>
      </div>
    );
  }

  const alreadySigned = contract.status === 'signed' || justSigned;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#ECECF1]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            <span className="font-bold text-sm text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
          </div>
          <div>
            <h1 className="text-base font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>J. Benitez</h1>
            <p className="text-[11px] text-[#9CA3AF]">Contrato de servicios</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Contrato (HTML generado por el backend — sin riesgo de XSS de terceros) */}
        <div
          className="bg-white rounded-2xl border border-[#ECECF1] p-6 text-sm text-[#1A1A1A] leading-relaxed [&_h1]:font-serif [&_h1]:text-xl [&_h2]:font-serif [&_h2]:text-lg [&_h2]:mt-4 [&_table]:w-full [&_table]:text-xs [&_ol]:pl-5 [&_ol]:space-y-2 [&_li]:list-decimal"
          dangerouslySetInnerHTML={{ __html: contract.content_html }}
        />

        {alreadySigned ? (
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#EFFAF2] flex items-center justify-center mx-auto mb-3">
              <span className="text-xl">✓</span>
            </div>
            <h2 className="font-serif text-lg text-[#1A1A1A] mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Contrato firmado
            </h2>
            <p className="text-sm text-[#9CA3AF]">
              {contract.signed_at
                ? `Firmado el ${new Date(contract.signed_at).toLocaleDateString('es-ES')}`
                : 'Firma recibida correctamente.'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-6 space-y-4">
            <h2 className="font-serif text-lg text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Firma del contrato
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Nombre completo"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
              />
              <input
                type="text"
                placeholder="NIF"
                value={signedByNif}
                onChange={(e) => setSignedByNif(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
              />
            </div>

            <div>
              <p className="text-xs text-[#9CA3AF] mb-1.5">Dibuja tu firma en el recuadro:</p>
              <canvas
                ref={canvasRef}
                width={600}
                height={200}
                className="w-full touch-none rounded-xl border border-[#ECECF1] bg-[#FAFAFA]"
                style={{ aspectRatio: '3 / 1' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
              <button
                type="button"
                onClick={clearSignature}
                className="mt-2 text-xs font-medium text-[#9CA3AF] hover:text-[#1A1A1A]"
              >
                Borrar firma
              </button>
            </div>

            {submitError && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{submitError}</p>
            )}

            <button
              type="button"
              onClick={submitSignature}
              disabled={submitting}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              {submitting ? 'Firmando…' : 'Confirmar y firmar'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
