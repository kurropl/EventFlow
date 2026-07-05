'use client';
/**
 * J.Benitez — Wizard Step 4: Extras
 * 
 * Colores coherentes gold/cream/ink
 */

import { useState, useEffect } from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS } from '@/data/menus';
import { BAR_PRICES } from '@/types/specs';

export default function WizardStep4() {
  const { step1, step4, setStepData, nextStep, prevStep } = useWizardStore();
  const [extras, setExtras] = useState<string[]>([]);
  const [barHours, setBarHours] = useState<0 | 1 | 2 | 3>((step4?.bar_hours as 0 | 1 | 2 | 3) || 0);

  const allExtras = CATALOG_ITEMS['complemento'] || [];
  const guestCount = step1?.guest_count || 0;

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
      bar_hours: barHours,
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
          Añade toques especiales a tu celebración
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
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

      <div className="pt-2 border-t border-stone-200">
        <h3 className="font-serif text-base font-semibold text-stone-700 mb-3 mt-6" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Barra libre
        </h3>
        <div className="grid grid-cols-4 gap-2.5 max-w-md">
          {([0, 1, 2, 3] as const).map((h) => (
            <button
              key={h}
              onClick={() => setBarHours(h)}
              className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${
                barHours === h
                  ? 'border-[#C9A84C] bg-[#C9A84C]/8 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
              }`}
            >
              <div className={`text-sm font-medium ${barHours === h ? 'text-[#1A1A1A]' : 'text-stone-600'}`}>
                {h === 0 ? 'Sin barra' : `${h}h`}
              </div>
              {h > 0 && (
                <div className="text-[11px] text-stone-400 mt-0.5">{BAR_PRICES[h]}€/pax</div>
              )}
            </button>
          ))}
        </div>
        {barHours > 0 && guestCount > 0 && (
          <p className="text-xs text-stone-500 mt-2">
            {barHours}h de barra libre × {guestCount} comensales × {BAR_PRICES[barHours]}€ = {(BAR_PRICES[barHours] * guestCount).toFixed(2)}€
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-stone-200">
        <button onClick={prevStep} className="px-5 py-2.5 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-700 border border-stone-200 bg-white hover:bg-stone-50 transition-colors">
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
