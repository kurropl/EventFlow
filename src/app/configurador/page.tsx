'use client';
/**
 * J.Benitez — Configurador Page (B2C)
 * 
 * Orquesta los pasos del wizard con transiciones Framer Motion.
 * Sin precios en ningún lado.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import WizardStep1 from '@/components/b2c/WizardStep1';
import WizardStep2 from '@/components/b2c/WizardStep2';
import WizardStep3 from '@/components/b2c/WizardStep3';
import WizardStep4 from '@/components/b2c/WizardStep4';
import WizardStep5 from '@/components/b2c/WizardStep5';

// Step labels matching the visual design
const STEP_LABELS = [
  'Detalles',
  'Menús Propuestos',
  'Personalizar',
  'Extras',
  'Resumen',
];

// Map step number to component
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
    <div className="min-h-screen" style={{ background: '#FAF8F5', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #1A1A1A 0%, #2A2A2A 100%)' }}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(201,168,76,0.3)' }}>
          {/* Brand */}
          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <button
                onClick={prevStep}
                className="text-white/60 hover:text-[#C9A84C] transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div className="flex items-center gap-2">
              <div
                className="w-9 h-9 rounded-full border border-[#C9A84C] flex items-center justify-center"
                style={{ fontFamily: "'Playfair Display', serif", color: '#C9A84C', fontStyle: 'italic', fontWeight: 700 }}
              >
                J
              </div>
              <div>
                <span className="font-serif text-[#C9A84C] text-base" style={{ fontFamily: "'Playfair Display', serif" }}>
                  J.Benitez
                </span>
              </div>
            </div>
          </div>

          {/* Reset button + Steps */}
          <div className="flex items-center gap-3">
            {/* Reset */}
            <div className="relative">
              <button
                onClick={() => setShowResetConfirm(!showResetConfirm)}
                className="text-stone-400 hover:text-[#C9A84C] transition-colors p-1"
                title="Restablecer todo"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
                </svg>
              </button>
              {showResetConfirm && (
                <div className="absolute right-0 top-8 bg-white rounded-xl shadow-xl border border-stone-200 p-4 w-64 z-50">
                  <p className="text-sm text-stone-700 mb-3 font-medium">¿Restablecer todo?</p>
                  <p className="text-xs text-stone-500 mb-3">Se perderán todas las selecciones del menú.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Restablecer
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Steps indicator — styled like the screenshot */}
            <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1.5 backdrop-blur">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className="flex items-center">
                  <div
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer
                      ${i + 1 === currentStep
                        ? 'bg-[#C9A84C] text-white font-semibold'
                        : i + 1 < currentStep
                        ? 'bg-[#C9A84C]/20 text-[#C9A84C]'
                        : 'bg-transparent text-stone-500 hover:text-stone-300'
                      }`}
                    onClick={() => { if (i + 1 <= currentStep) { /* allow going back */ } }}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs
                      ${i + 1 === currentStep ? 'bg-white text-[#C9A84C]' : ''}
                      ${i + 1 < currentStep ? 'bg-[#C9A84C] text-white' : ''}`}>
                      {i + 1 < currentStep ? '✓' : i + 1}
                    </span>
                    <span className="hidden lg:inline">{label}</span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`w-3 h-px mx-1 ${i + 1 < currentStep ? 'bg-[#C9A84C]' : 'bg-stone-600'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <StepComponent onNext={nextStep} onPrev={prevStep} />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
