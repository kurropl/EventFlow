'use client';
/**
 * EventFlow — Wizard Step 4: Sugerencias (Upselling)
 * 
 * Reglas estáticas de sugerencia basadas en tipo de evento y comensales.
 * Sin precios.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS } from '@/data/menus';

const SUGGESTIONS = [
  { id: 'bar-libre', label: 'Barra Libre', icon: '🍷', desc: 'Cócteles, cervezas y vinos a disposición de tus invitados', condition: (step1: any) => ['boda', 'comunión', 'bautizo'].includes(step1?.event_type) },
  { id: 'estacion-mariscos', label: 'Estación de Mariscos', icon: '🦐', desc: 'Langostinos, gambas, ostras y más', condition: (step1: any) => (step1?.guest_count || 0) > 100 },
  { id: 'menu-nino', label: 'Menú Infantil', icon: '🧸', desc: 'Opciones especiales para los más pequeños', condition: (step1: any) => (step1?.kids_count || 0) > 0 },
  { id: 'estacion-ahumados', label: 'Estación de Ahumados', icon: '🥓', desc: 'Jamón, quesos y carnes ahumadas en directo', condition: () => true },
  { id: 'show-cooking', label: 'Show Cooking', icon: '👨‍🍳', desc: 'Un chef preparará platos al momento', condition: (step1: any) => (step1?.guest_count || 0) > 150 },
  { id: 'mesa-chuches', label: 'Mesa de Chuches', icon: '🍬', desc: 'Dulces y golosinas para los invitados', condition: (step1: any) => (step1?.kids_count || 0) > 5 },
];

export default function WizardStep4() {
  const { step4, step1, setStepData, nextStep, prevStep } = useWizardStore();
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
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-ink mb-2">Personaliza tu Experiencia</h2>
        <p className="text-ink-soft/60">Añade extras que hagan tu evento aún más especial</p>
      </div>

      {/* Suggestions */}
      <div className="grid gap-3">
        {availableSuggestions.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            whileHover={{ y: -1 }}
            onClick={() => toggleSuggestion(s.id)}
            className={`w-full text-left rounded-xl p-5 border-2 transition-all duration-300
              ${selectedSuggestions.includes(s.id)
                ? 'border-gold bg-gold/5 shadow-md'
                : 'border-gold/10 bg-paper hover:border-gold/30'
              }`}
          >
            <div className="flex items-center gap-4">
              <div className="text-3xl">{s.icon}</div>
              <div className="flex-1">
                <h3 className="font-medium text-ink">{s.label}</h3>
                <p className="text-sm text-ink-soft/60">{s.desc}</p>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                ${selectedSuggestions.includes(s.id) ? 'border-gold bg-gold' : 'border-gold/30'}`}>
                {selectedSuggestions.includes(s.id) && (
                  <svg className="w-3.5 h-3.5 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Bar hours */}
      <div className="bg-paper rounded-xl p-6 border border-gold/10">
        <h3 className="font-serif text-xl text-ink mb-4">🍸 Servicio de Barra</h3>
        <div className="flex gap-3">
          {[0, 1, 2, 3].map((h) => (
            <button
              key={h}
              onClick={() => setBarHours(h)}
              className={`flex-1 py-3 rounded-lg font-medium transition-all
                ${barHours === h
                  ? 'bg-gold text-ink shadow-md'
                  : 'bg-cream text-ink/60 hover:bg-gold/10'
                }`}
            >
              {h === 0 ? 'No' : `${h}h`}
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={prevStep} className="px-6 py-4 rounded-xl border-2 border-gold/20 text-ink/60 hover:border-gold/50 hover:text-ink transition-all">← Atrás</button>
        <button onClick={handleNext} className="flex-1 py-4 rounded-xl bg-gold text-ink font-semibold text-lg hover:bg-amber-400 transition-all shadow-lg shadow-gold/20">Resumen →</button>
      </div>
    </motion.div>
  );
}
