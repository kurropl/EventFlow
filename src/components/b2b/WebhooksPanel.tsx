'use client';
/**
 * J.Benitez — Webhooks Panel (B2B)
 *
 * Permite revisar la integración de webhooks (n8n / Make / Zapier),
 * los eventos disponibles y lanzar un envío de prueba.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';

const TOPICS: { topic: string; label: string; desc: string }[] = [
  { topic: 'BUDGET_CREATED', label: 'Presupuesto creado', desc: 'Se dispara cuando un cliente envía una propuesta desde el configurador.' },
  { topic: 'STATUS_CHANGED', label: 'Cambio de estado', desc: 'Se dispara al mover un evento entre columnas del pipeline.' },
  { topic: 'BUDGET_CONFIRMED', label: 'Presupuesto confirmado', desc: 'Se dispara cuando un evento pasa a estado confirmado.' },
  { topic: 'BUDGET_CANCELLED', label: 'Presupuesto cancelado', desc: 'Se dispara cuando un evento se cancela.' },
];

export default function WebhooksPanel() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const sendTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch('/api/webhooks/test');
      const data = await res.json();
      setResult({
        ok: res.ok && data.success,
        msg: data.message || data.error || (res.ok ? 'Webhook de prueba emitido' : 'Error al emitir el webhook'),
      });
    } catch (e) {
      setResult({ ok: false, msg: e instanceof Error ? e.message : 'Error de conexión' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Intro */}
      <div className="rounded-2xl border border-[#ECECF1] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h2 className="text-[#1A1A1A] text-xl font-serif mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Integración de webhooks</h2>
        <p className="text-[#6B7280] text-sm">
          Conecta J.Benitez con tu automatización favorita (n8n, Make, Zapier). Cada cambio
          relevante en un evento se envía como un <span className="text-[#A88A3A] font-medium">POST</span> JSON
          firmado con la cabecera <span className="text-[#A88A3A] font-medium">X-EventFlow-Source</span>.
        </p>
      </div>

      {/* Config status */}
      <div className="rounded-2xl border border-[#ECECF1] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h3 className="text-[#1A1A1A] font-semibold text-sm mb-3">Endpoint configurado</h3>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-[#D9920B]" />
          <code className="text-[#6B7280] text-xs bg-[#FAFAFC] px-3 py-1.5 rounded-lg border border-[#ECECF1] flex-1">
            NEXT_PUBLIC_WEBHOOK_URL
          </code>
        </div>
        <p className="text-[#9CA3AF] text-xs mt-3">
          Define la variable de entorno <span className="text-[#A88A3A]">NEXT_PUBLIC_WEBHOOK_URL</span> con
          la URL de tu flujo. Si no está configurada, los eventos se registran localmente en
          la tabla <span className="text-[#A88A3A]">webhook_logs</span>.
        </p>
      </div>

      {/* Topics */}
      <div className="rounded-2xl border border-[#ECECF1] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <h3 className="text-[#1A1A1A] font-semibold text-sm mb-4">Eventos disponibles</h3>
        <div className="space-y-3">
          {TOPICS.map((t) => (
            <div key={t.topic} className="flex items-start gap-3 p-3 rounded-xl bg-[#FAFAFC] border border-[#F2F2F5]">
              <span className="text-[10px] font-mono bg-[#FBF6E9] text-[#A88A3A] px-2 py-1 rounded mt-0.5 whitespace-nowrap">
                {t.topic}
              </span>
              <div>
                <div className="text-[#1A1A1A] text-sm font-medium">{t.label}</div>
                <div className="text-[#6B7280] text-xs">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test */}
      <div className="rounded-2xl border border-[#ECECF1] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-[#1A1A1A] font-semibold text-sm">Enviar webhook de prueba</h3>
            <p className="text-[#6B7280] text-xs">Emite un evento <span className="text-[#A88A3A]">BUDGET_CREATED</span> de ejemplo.</p>
          </div>
          <button
            onClick={sendTest}
            disabled={testing}
            className="text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm hover:shadow transition-all disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {testing ? 'Enviando...' : 'Enviar prueba'}
          </button>
        </div>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 text-sm rounded-xl px-4 py-3 border ${
              result.ok
                ? 'bg-[#EFFAF2] border-[#CDEBD6] text-[#16A34A]'
                : 'bg-[#FEF3F3] border-[#F6D6D6] text-[#DC2626]'
            }`}
          >
            {result.msg}
          </motion.div>
        )}
      </div>
    </div>
  );
}
