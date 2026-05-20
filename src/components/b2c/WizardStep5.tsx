'use client';
/**
 * EventFlow — Wizard Step 5: Resumen y Envío
 * 
 * Resumen limpio del evento. Formulario de contacto.
 * Sin emojis. Sin precios.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';

const EVENT_TYPE_LABELS: Record<string, string> = {
  boda: 'Boda', 'cumpleaños': 'Cumpleaños', corporativo: 'Corporativo',
  bautizo: 'Bautizo', 'comunión': 'Comunión', otro: 'Otro',
};

const MENU_LABELS: Record<string, string> = {
  menu1: 'Esencial', menu2: 'Recomendado', menu3: 'Completo',
  menu4: 'Premium', menu5: 'Premium +', menu6: 'Gran Selección',
  kid1: 'Infantil', kid2: 'Infantil +',
};

const SUGGESTION_LABELS: Record<string, string> = {
  'bar-libre': 'Barra Libre', 'estacion-mariscos': 'Estación de Mariscos',
  'menu-nino': 'Menú Infantil', 'estacion-ahumados': 'Estación de Ahumados',
  'show-cooking': 'Show Cooking', 'mesa-chuches': 'Mesa de Dulces',
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
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-3xl text-stone-800 mb-4">¡Propuesta Enviada!</h2>
        <p className="text-stone-500 text-lg mb-8 max-w-md mx-auto">
          Hemos recibido tu propuesta. Nuestro equipo la revisará y te contactará pronto.
        </p>
        <button
          onClick={reset}
          className="bg-amber-600 text-white font-semibold px-8 py-3 rounded-lg hover:bg-amber-700 transition-all shadow-md"
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
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Resumen de tu Evento
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Revisa los detalles antes de enviar
        </p>
      </div>

      {/* Summary card */}
      <div className="rounded-2xl border-2 border-stone-200 bg-white overflow-hidden">
        {/* Event details */}
        <div className="p-6 border-b border-stone-100">
          <h3 className="font-serif text-lg text-stone-800 mb-4">
            Detalles del Evento
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-stone-400 block text-xs mb-1">Tipo</span>
              <span className="font-medium text-stone-800">
                {EVENT_TYPE_LABELS[step1?.event_type || ''] || step1?.event_type}
              </span>
            </div>
            <div>
              <span className="text-stone-400 block text-xs mb-1">Fecha</span>
              <span className="font-medium text-stone-800">{step1?.event_date}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-xs mb-1">Adultos</span>
              <span className="font-medium text-stone-800">{step1?.guest_count}</span>
            </div>
            <div>
              <span className="text-stone-400 block text-xs mb-1">Niños</span>
              <span className="font-medium text-stone-800">{step1?.kids_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Selected menu */}
        {step2?.menu_id && (
          <div className="p-6 border-b border-stone-100">
            <h3 className="font-serif text-lg text-stone-800 mb-2">
              Menú Base
            </h3>
            <p className="text-sm font-medium text-stone-700">
              {MENU_LABELS[step2.menu_id] || step2.menu_id}
            </p>
          </div>
        )}

        {/* Selected dishes */}
        {(step3 as any)?.selected_items && (step3 as any).selected_items.length > 0 && (
          <div className="p-6 border-b border-stone-100">
            <h3 className="font-serif text-lg text-stone-800 mb-3">
              Platos Seleccionados
            </h3>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {((step3 as any).selected_items).map((item: { name: string; category: string }, i: number) => (
                <div key={i} className="text-sm flex items-center gap-2">
                  <span className="text-amber-600">•</span>
                  <span className="text-stone-700">{item.name}</span>
                  <span className="text-stone-400 text-xs ml-auto">{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {step4?.selected_suggestions && step4.selected_suggestions.length > 0 && (
          <div className="p-6 border-b border-stone-100">
            <h3 className="font-serif text-lg text-stone-800 mb-3">
              Extras
            </h3>
            <div className="flex flex-wrap gap-2">
              {step4.selected_suggestions.map((s: string) => (
                <span key={s} className="text-sm bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-200">
                  {SUGGESTION_LABELS[s] || s}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Client info form */}
      <div className="rounded-2xl border-2 border-stone-200 bg-white p-6">
        <h3 className="font-serif text-lg text-stone-800 mb-4">
          Datos de Contacto
        </h3>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Nombre completo *"
            value={clientInfo.name}
            onChange={(e) => setClientInfo({ name: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors text-stone-800"
          />
          <input
            type="email"
            placeholder="Email *"
            value={clientInfo.email}
            onChange={(e) => setClientInfo({ email: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors text-stone-800"
          />
          <input
            type="tel"
            placeholder="Teléfono"
            value={clientInfo.phone}
            onChange={(e) => setClientInfo({ phone: e.target.value })}
            className="w-full px-4 py-3 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors text-stone-800"
          />
          <textarea
            placeholder="Notas adicionales (alergias, preferencias...)"
            value={clientInfo.notes}
            onChange={(e) => setClientInfo({ notes: e.target.value })}
            rows={3}
            className="w-full px-4 py-3 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors resize-none text-stone-800"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSend}
        disabled={submitting || !clientInfo.name || !clientInfo.email}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-200
          ${submitting || !clientInfo.name || !clientInfo.email
            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
            : 'bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg'
          }`}
      >
        {submitting ? 'Enviando...' : 'Enviar Presupuesto'}
      </button>
    </motion.div>
  );
}
