'use client';
/**
 * J.Benitez — Configurador Page (B2C) Rediseñado
 * 
 * Header limpio crema/dorado sin negro agresivo
 * Paleta coherente: cream (#F8F3E6) / gold (#C9A84C) / ink (#1A1A1A)
 * Sin colores mezclados entre pasos
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import WizardStep1 from '@/components/b2c/WizardStep1';
import WizardStep2 from '@/components/b2c/WizardStep2';
import WizardStep3 from '@/components/b2c/WizardStep3';
import WizardStep4 from '@/components/b2c/WizardStep4';
import WizardStep5 from '@/components/b2c/WizardStep5';

const STEP_LABELS = [
  'Detalles',
  'Menu',
  'Personalizar',
  'Extras',
  'Resumen',
];

const STEP_COMPONENTS: Record<number, React.ComponentType<{ onNext: () => void; onPrev: () => void }>> = {
  1: WizardStep1,
  2: WizardStep2,
  3: WizardStep3,
  4: WizardStep4,
  5: WizardStep5,
};

export default function ConfiguradorPage() {
  const { currentStep, nextStep, prevStep, reset } = useWizardStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const StepComponent = STEP_COMPONENTS[currentStep] || WizardStep1;

  const handleReset = () => {
    reset();
    setShowResetConfirm(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F3E6]" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header — limpio, crema con borde dorado, sin negro agresivo */}
      <header className="sticky top-0 z-50 bg-[#F8F3E6]/95 backdrop-blur-xl border-b border-[#C9A84C]/20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="text-stone-500 hover:text-[#C9A84C] transition-colors p-1.5 rounded-lg hover:bg-[#C9A84C]/10"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: '#1A1A1A',
                  color: '#C9A84C',
                  fontFamily: "'Playfair Display', Georgia, serif",
                }}
              >
                J
              </div>
              <span
                className="font-serif text-sm tracking-wide"
                style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}
              >
                J.Benitez
              </span>
            </div>
          </div>

          {/* Steps indicator — minimal, dorado/crema */}
          <div className="flex items-center gap-1">
            {/* Reset */}
            <div className="relative mr-2">
              <button
                onClick={() => setShowResetConfirm(!showResetConfirm)}
                className="text-stone-400 hover:text-[#C9A84C] transition-colors p-1.5 rounded-lg hover:bg-[#C9A84C]/10"
                title="Restablecer todo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
                </svg>
              </button>
              {showResetConfirm && (
                <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-60 z-50">
                  <p className="text-sm text-stone-700 mb-3 font-medium">Restablecer todo?</p>
                  <p className="text-xs text-stone-500 mb-3">Se perderan todas las selecciones del menu.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#1A1A1A] text-white hover:bg-stone-800 transition-colors"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Steps */}
            {STEP_LABELS.map((label, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === currentStep;
              const isCompleted = stepNum < currentStep;
              return (
                <div key={label} className="flex items-center">
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-300 cursor-default ${
                      isActive
                        ? 'bg-[#C9A84C] text-white font-semibold shadow-sm'
                        : isCompleted
                        ? 'bg-[#C9A84C]/15 text-[#C9A84C] font-medium'
                        : 'text-stone-400'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isActive
                          ? 'bg-white text-[#C9A84C]'
                          : isCompleted
                          ? 'bg-[#C9A84C] text-white'
                          : 'bg-stone-200 text-stone-400'
                      }`}
                    >
                      {isCompleted ? '✓' : stepNum}
                    </span>
                    <span className="hidden lg:inline">{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`w-4 h-px mx-0.5 ${isCompleted ? 'bg-[#C9A84C]/50' : 'bg-stone-300'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Content — fondo crema uniforme */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            <StepComponent onNext={nextStep} onPrev={prevStep} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
