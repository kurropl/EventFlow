'use client';
/**
 * EventFlow — Wizard Step 5: Resumen y Envío
 * 
 * Resumen elegante del evento. Formulario de datos de contacto.
 * Sin precios en ningún lado.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', cumpleanos: 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', comunion: 'Comunión', otro: 'Otro',
};

export default function WizardStep5() {
  const { step1, step2, step3, step4, clientInfo, submit, setClientInfo, prevStep, reset } = useWizardStore();

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setError('');
    setSubmitting(true);
    const result = await submit();
    setSubmitting(false);
    if (result.success) {
      setSubmitted(true);
    } else {
      setError('Error al enviar. Por favor, inténtalo de nuevo.');
    }
  };

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-16"
      >
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="font-serif text-3xl text-ink mb-4">¡Propuesta Enviada!</h2>
        <p className="text-ink-soft/60 text-lg mb-8 max-w-md mx-auto">
          Hemos recibido tu propuesta. Nuestro equipo la revisará y te contactará pronto para confirmar los detalles.
        </p>
        <button
          onClick={reset}
          className="bg-gold text-ink font-semibold px-8 py-4 rounded-xl hover:bg-amber-400 transition-all shadow-lg"
        >
          Diseñar otro evento
        </button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-ink mb-2">Resumen de tu Evento</h2>
        <p className="text-ink-soft/60">Revisa los detalles antes de enviar</p>
      </div>

      {/* Summary card */}
      <div className="bg-paper rounded-2xl border border-gold/20 overflow-hidden">
        {/* Event details */}
        <div className="p-6 border-b border-gold/10">
          <h3 className="font-serif text-lg text-ink mb-3">📋 Detalles del Evento</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-ink-soft/50">Tipo:</span>
              <span className="ml-2 font-medium">{EVENT_TYPE_LABELS[step1?.event_type || ''] || step1?.event_type}</span>
            </div>
            <div>
              <span className="text-ink-soft/50">Fecha:</span>
              <span className="ml-2 font-medium">{step1?.event_date}</span>
            </div>
            <div>
              <span className="text-ink-soft/50">Adultos:</span>
              <span className="ml-2 font-medium">{step1?.guest_count}</span>
            </div>
            <div>
              <span className="text-ink-soft/50">Niños:</span>
              <span className="ml-2 font-medium">{step1?.kids_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Selected menu */}
        {step2?.menu_id && (
          <div className="p-6 border-b border-gold/10">
            <h3 className="font-serif text-lg text-ink mb-3">🍽️ Menú Base</h3>
            <p className="text-sm font-medium">
              {step2.menu_id === 'menu1' ? 'Menú 1 — Esencial' :
               step2.menu_id === 'menu2' ? 'Menú 2 — Recomendado' :
               step2.menu_id === 'menu3' ? 'Menú 3 — Completo' :
               step2.menu_id === 'menu4' ? 'Menú 4 — Premium' :
               step2.menu_id === 'menu5' ? 'Menú 5 — Premium +' :
               step2.menu_id === 'menu6' ? 'Menú 6 — Gran Selección' :
               step2.menu_id === 'kid1' ? 'Menú Niño 1 — Infantil' :
               step2.menu_id === 'kid2' ? 'Menú Niño 2 — Infantil +' : step2.menu_id}
            </p>
          </div>
        )}

        {/* Selected dishes */}
        {step3?.selectedItems && step3.selectedItems.length > 0 && (
          <div className="p-6 border-b border-gold/10">
            <h3 className="font-serif text-lg text-ink mb-3">🥘 Platos Seleccionados</h3>
            <div className="space-y-1">
              {step3.selectedItems.map((item: { name: string; category: string }, i: number) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <span className="text-gold">•</span>
                  <span className="text-ink/80">{item.name}</span>
                  <span className="text-ink-soft/40 text-xs ml-auto">({item.category})</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {step4?.selected_suggestions && step4.selected_suggestions.length > 0 && (
          <div className="p-6 border-b border-gold/10">
            <h3 className="font-serif text-lg text-ink mb-3">✨ Extras</h3>
            <div className="flex flex-wrap gap-2">
              {step4.selected_suggestions.map((s: string) => (
                <span key={s} className="text-sm bg-gold/10 text-gold px-3 py-1 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Client info form */}
      <div className="bg-paper rounded-2xl border border-gold/20 p-6">
        <h3 className="font-serif text-lg text-ink mb-4">👤 Tus Datos de Contacto</h3>
        <div className="grid gap-4">
          <input
            type="text"
            placeholder="Nombre completo *"
            value={clientInfo.name}
            onChange={(e) => setClientInfo({ name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-gold/10 bg-cream focus:border-gold focus:outline-none transition-colors"
          />
          <input
            type="email"
            placeholder="Email *"
            value={clientInfo.email}
            onChange={(e) => setClientInfo({ email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-gold/10 bg-cream focus:border-gold focus:outline-none transition-colors"
          />
          <input
            type="tel"
            placeholder="Teléfono"
            value={clientInfo.phone}
            onChange={(e) => setClientInfo({ phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-gold/10 bg-cream focus:border-gold focus:outline-none transition-colors"
          />
          <textarea
            placeholder="Notas adicionales (alergias, preferencias...)"
            value={clientInfo.notes}
            onChange={(e) => setClientInfo({ notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border-2 border-gold/10 bg-cream focus:border-gold focus:outline-none transition-colors resize-none"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={prevStep} className="px-6 py-4 rounded-xl border-2 border-gold/20 text-ink/60 hover:border-gold/50 hover:text-ink transition-all">← Atrás</button>
        <button
          onClick={handleSend}
          disabled={submitting || !clientInfo.name || !clientInfo.email}
          className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all duration-300
            ${submitting || !clientInfo.name || !clientInfo.email
              ? 'bg-ink/10 text-ink/30 cursor-not-allowed'
              : 'bg-gold text-ink hover:bg-amber-400 shadow-lg shadow-gold/20 hover:shadow-gold/40'
            }`}
        >
          {submitting ? 'Enviando...' : 'Enviar Presupuesto'}
        </button>
      </div>
    </motion.div>
  );
}
