'use client';
/**
 * J.Benitez — Wizard Step 4: Extras
 * 
 * Colores coherentes gold/cream/ink
 */

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS } from '@/data/menus';

export default function WizardStep4() {
  const { step3, setStepData, nextStep, prevStep } = useWizardStore();
  const [extras, setExtras] = useState<string[]>([]);

  const allExtras = CATALOG_ITEMS['complemento'] || [];

  const toggleExtra = (extra: string) => {
    setExtras(prev =>
      prev.includes(extra)
        ? prev.filter(e => e !== extra)
        : [...prev, extra]
    );
  };

  const handleNext = () => {
    setStepData('step4', {
      selected_suggestions: extras,
      suggestions: extras,
      bar_hours: 0,
    });
    nextStep();
  };

  return (
    <div
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Extras y Complementos
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Anade toques especiales a tu celebracion
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
        {allExtras.map((extra) => {
          const isSelected = extras.includes(extra);
          return (
            <button
              key={extra}
              onClick={() => toggleExtra(extra)}
              className={`p-3.5 rounded-xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? 'border-[#C9A84C] bg-[#C9A84C]/8 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-4.5 h-4.5 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                  isSelected ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-stone-300'
                }`} style={{ width: '18px', height: '18px' }}>
                  {isSelected && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${isSelected ? 'text-[#1A1A1A] font-medium' : 'text-stone-600'}`}>
                  {extra}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-stone-200">
        <button onClick={prevStep} className="px-5 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors">
          Anterior
        </button>
        <button
          onClick={handleNext}
          className="px-6 py-2.5 rounded-xl text-sm font-medium bg-[#1A1A1A] text-white hover:bg-stone-800 shadow-lg shadow-stone-900/20 transition-all duration-300"
        >
          Ver Resumen
        </button>
      </div>
    </div>
  );
}
