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
      <div className="rounded-xl border border-gold/10 bg-ink-900/40 p-6">
        <h2 className="text-cream text-xl font-serif mb-1">Integración de Webhooks</h2>
        <p className="text-cream/40 text-sm">
          Conecta J.Benitez con tu automatización favorita (n8n, Make, Zapier). Cada cambio
          relevante en un evento se envía como un <span className="text-gold">POST</span> JSON
          firmado con la cabecera <span className="text-gold">X-EventFlow-Source</span>.
        </p>
      </div>

      {/* Config status */}
      <div className="rounded-xl border border-gold/10 bg-ink-900/40 p-6">
        <h3 className="text-cream font-medium text-sm mb-3">Endpoint configurado</h3>
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <code className="text-cream/60 text-xs bg-ink-950/60 px-3 py-1.5 rounded-lg border border-gold/10 flex-1">
            NEXT_PUBLIC_WEBHOOK_URL
          </code>
        </div>
        <p className="text-cream/30 text-xs mt-3">
          Define la variable de entorno <span className="text-gold/70">NEXT_PUBLIC_WEBHOOK_URL</span> con
          la URL de tu flujo. Si no está configurada, los eventos se registran localmente en
          la tabla <span className="text-gold/70">webhook_logs</span>.
        </p>
      </div>

      {/* Topics */}
      <div className="rounded-xl border border-gold/10 bg-ink-900/40 p-6">
        <h3 className="text-cream font-medium text-sm mb-4">Eventos disponibles</h3>
        <div className="space-y-3">
          {TOPICS.map((t) => (
            <div key={t.topic} className="flex items-start gap-3">
              <span className="text-[10px] font-mono bg-gold/10 text-gold px-2 py-1 rounded mt-0.5 whitespace-nowrap">
                {t.topic}
              </span>
              <div>
                <div className="text-cream text-sm">{t.label}</div>
                <div className="text-cream/40 text-xs">{t.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Test */}
      <div className="rounded-xl border border-gold/10 bg-ink-900/40 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-cream font-medium text-sm">Enviar webhook de prueba</h3>
            <p className="text-cream/40 text-xs">Emite un evento <span className="text-gold/70">BUDGET_CREATED</span> de ejemplo.</p>
          </div>
          <button
            onClick={sendTest}
            disabled={testing}
            className="bg-gold text-ink px-4 py-2 rounded-lg text-sm font-medium hover:bg-gold-light transition-colors disabled:opacity-60"
          >
            {testing ? 'Enviando...' : 'Enviar prueba'}
          </button>
        </div>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 text-sm rounded-lg px-4 py-3 border ${
              result.ok
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {result.msg}
          </motion.div>
        )}
      </div>
    </div>
  );
}
