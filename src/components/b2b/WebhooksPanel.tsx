'use client';
/**
 * J.Benitez — Webhooks Panel (B2B)
 *
 * Enhanced with automation rules tab. Manages webhook integration
 * (n8n / Make / Zapier), available events, test delivery, and
 * automation rules that trigger on webhook events.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import AutomationRules from '@/components/b2b/AutomationRules';

const TOPICS: { topic: string; label: string; desc: string }[] = [
  { topic: 'BUDGET_CREATED', label: 'Presupuesto creado', desc: 'Se dispara cuando un cliente envía una propuesta desde el configurador.' },
  { topic: 'STATUS_CHANGED', label: 'Cambio de estado', desc: 'Se dispara al mover un evento entre columnas del pipeline.' },
  { topic: 'BUDGET_CONFIRMED', label: 'Presupuesto confirmado', desc: 'Se dispara cuando un evento pasa a estado confirmado.' },
  { topic: 'BUDGET_CANCELLED', label: 'Presupuesto cancelado', desc: 'Se dispara cuando un evento se cancela.' },
];

type Tab = 'webhooks' | 'automation_rules';

export default function WebhooksPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('webhooks');
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
    <div className="space-y-6 max-w-4xl">
      {/* Tabs */}
      <div className="flex items-center border-b border-[#ECECF1] gap-0">
        <button
          onClick={() => setActiveTab('webhooks')}
          className={`relative px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === 'webhooks'
              ? 'text-[#1A1A1A]'
              : 'text-[#6B7280] hover:text-[#1A1A1A]'
          }`}
        >
          Webhooks
          {activeTab === 'webhooks' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C]"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('automation_rules')}
          className={`relative px-5 py-3 text-sm font-medium transition-colors ${
            activeTab === 'automation_rules'
              ? 'text-[#1A1A1A]'
              : 'text-[#6B7280] hover:text-[#1A1A1A]'
          }`}
        >
          Reglas de automatización
          {activeTab === 'automation_rules' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C9A84C]"
            />
          )}
        </button>
      </div>

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <motion.div
          key="webhooks"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
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
        </motion.div>
      )}

      {/* Automation Rules Tab */}
      {activeTab === 'automation_rules' && (
        <motion.div
          key="automation"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Intro card */}
          <div className="rounded-2xl border border-[#ECECF1] bg-white p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04)] mb-6">
            <h2 className="text-[#1A1A1A] text-xl font-serif mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              Automatización
            </h2>
            <p className="text-[#6B7280] text-sm">
              Define reglas condicionales que se ejecutan automáticamente cuando ocurren eventos.
              Las reglas se evalúan después del envío del webhook y pueden cambiar estados,
              enviar notificaciones o reenviar eventos a otros sistemas.
            </p>
          </div>

          <AutomationRules />
        </motion.div>
      )}
    </div>
  );
}