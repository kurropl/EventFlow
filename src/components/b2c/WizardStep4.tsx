'use client';
/**
 * EventFlow — Wizard Step 4: Extras y Personalización
 * 
 * Sugerencias basadas en reglas estáticas. Sin emojis.
 * Diseño limpio y legible.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';

interface Suggestion {
  id: string;
  label: string;
  desc: string;
  condition: (step1: any) => boolean;
}

const SUGGESTIONS: Suggestion[] = [
  {
    id: 'bar-libre',
    label: 'Barra Libre',
    desc: 'Cócteles, cervezas y vinos a disposición de tus invitados',
    condition: (step1: any) => ['boda', 'comunión', 'bautizo'].includes(step1?.event_type),
  },
  {
    id: 'estacion-mariscos',
    label: 'Estación de Mariscos',
    desc: 'Langostinos, gambas, ostras y más',
    condition: (step1: any) => (step1?.guest_count || 0) > 100,
  },
  {
    id: 'menu-nino',
    label: 'Menú Infantil',
    desc: 'Opciones especiales para los más pequeños',
    condition: (step1: any) => (step1?.kids_count || 0) > 0,
  },
  {
    id: 'estacion-ahumados',
    label: 'Estación de Ahumados',
    desc: 'Jamón, quesos y carnes ahumadas en directo',
    condition: () => true,
  },
  {
    id: 'show-cooking',
    label: 'Show Cooking',
    desc: 'Un chef preparará platos al momento',
    condition: (step1: any) => (step1?.guest_count || 0) > 150,
  },
  {
    id: 'mesa-chuches',
    label: 'Mesa de Dulces',
    desc: 'Dulces y golosinas para los invitados',
    condition: (step1: any) => (step1?.kids_count || 0) > 5,
  },
];

const SUGGESTION_ICONS: Record<string, JSX.Element> = {
  'bar-libre': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3v4l-3 8h12l-3-8V3M6 15h12v4H6v-4z" />
    </svg>
  ),
  'estacion-mariscos': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4 4-6 8-6 12a6 6 0 0012 0c0-4-2-8-6-12z" />
    </svg>
  ),
  'menu-nino': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 0v4m0 4h.01M8 20h8" />
    </svg>
  ),
  'estacion-ahumados': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M8 9l4 4 4-4M6 21h12" />
    </svg>
  ),
  'show-cooking': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a6 6 0 006 6v6a6 6 0 00-12 0V9a6 6 0 006-6z" />
    </svg>
  ),
  'mesa-chuches': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.5 5 5.5.8-4 3.9.9 5.3L12 15.5 7.1 18l.9-5.3-4-3.9 5.5-.8z" />
    </svg>
  ),
};

export default function WizardStep4() {
  const { step4, step1, setStepData, nextStep } = useWizardStore();
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>(
    step4?.selected_suggestions || []
  );
  const [barHours, setBarHours] = useState(Number(step4?.bar_hours) || 0);

  useEffect(() => {
    setStepData('step4', {
      bar_hours: Number(barHours),
      selected_suggestions: selectedSuggestions,
    } as any);
  }, [barHours, selectedSuggestions]);

  const toggleSuggestion = (id: string) => {
    setSelectedSuggestions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const availableSuggestions = SUGGESTIONS.filter((s) => s.condition(step1));

  const handleNext = () => {
    nextStep();
  };

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
          Personaliza tu Experiencia
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Añade extras que hagan tu evento aún más especial
        </p>
      </div>

      {/* Suggestions */}
      <div className="space-y-3">
        {availableSuggestions.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.3 }}
            onClick={() => toggleSuggestion(s.id)}
            className={`w-full text-left rounded-xl p-5 border-2 transition-all duration-200
              ${selectedSuggestions.includes(s.id)
                ? 'border-amber-600 bg-amber-50/50 shadow-md'
                : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
              }`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex-shrink-0 ${
                selectedSuggestions.includes(s.id) ? 'text-amber-700' : 'text-stone-400'
              }`}>
                {SUGGESTION_ICONS[s.id]}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold ${
                  selectedSuggestions.includes(s.id) ? 'text-stone-800' : 'text-stone-700'
                }`}>
                  {s.label}
                </h3>
                <p className="text-sm text-stone-500 mt-0.5">{s.desc}</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors
                ${selectedSuggestions.includes(s.id) ? 'border-amber-600 bg-amber-600' : 'border-stone-300'}`}>
                {selectedSuggestions.includes(s.id) && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Bar hours */}
      <div className="rounded-xl p-6 border-2 border-stone-200 bg-white">
        <h3 className="font-serif text-lg text-stone-800 mb-4">
          Servicio de Barra
        </h3>
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((h) => (
            <button
              key={h}
              onClick={() => setBarHours(h)}
              className={`flex-1 py-3 rounded-lg font-medium text-sm transition-all border
                ${barHours === h
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                }`}
            >
              {h === 0 ? 'No' : `${h}h`}
            </button>
          ))}
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={handleNext}
        className="w-full py-4 rounded-xl font-semibold text-base bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-md hover:shadow-lg"
      >
        Ver Resumen →
      </button>
    </motion.div>
  );
}
