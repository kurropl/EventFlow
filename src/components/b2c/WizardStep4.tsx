'use client';
/**
 * J.Benitez — Wizard Step 4: Extras
 * 
 * Selección de extras y complementos para el evento.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS } from '@/data/menus';

export default function WizardStep4() {
  const { step3, setStepData, nextStep, prevStep } = useWizardStore();
  const [extras, setExtras] = useState<string[]>(step3?.extras || []);

  const allExtras = CATALOG_ITEMS['complemento'] || [];

  const toggleExtra = (extra: string) => {
    setExtras(prev => 
      prev.includes(extra)
        ? prev.filter(e => e !== extra)
        : [...prev, extra]
    );
  };

  const handleNext = () => {
    setStepData('step4', { extras });
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
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Extras y Complementos
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Añade toques especiales a tu celebración
        </p>
      </div>

      {/* Extras Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {allExtras.map((extra) => {
          const isSelected = extras.includes(extra);
          return (
            <button
              key={extra}
              onClick={() => toggleExtra(extra)}
              className={`p-4 rounded-xl border-2 transition-all duration-300 text-left ${
                isSelected
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10 shadow-md shadow-[#C9A84C]/20'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  isSelected ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-stone-300'
                }`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${isSelected ? 'text-[#C9A84C] font-medium' : 'text-stone-600'}`}>
                  {extra}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t border-stone-200">
        <button
          onClick={prevStep}
          className="px-6 py-3 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
        >
          Anterior
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-3 rounded-xl text-sm font-medium bg-[#C9A84C] text-white hover:bg-[#A88A3A] shadow-lg shadow-[#C9A84C]/30 transition-all duration-300"
        >
          Ver Resumen
        </button>
      </div>
    </motion.div>
  );
}
