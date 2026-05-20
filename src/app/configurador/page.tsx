'use client';
/**
 * EventFlow — Configurador Page (B2C) Rediseñada
 * 
 * Wizard premium con diseño elegante, iconos SVG, tipografía legible.
 * Sin emojis infantiles. Sin precios.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import WizardStep1 from '@/components/b2c/WizardStep1';
import WizardStep2 from '@/components/b2c/WizardStep2';
import WizardStep3 from '@/components/b2c/WizardStep3';
import WizardStep4 from '@/components/b2c/WizardStep4';
import WizardStep5 from '@/components/b2c/WizardStep5';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

const STEPS = [WizardStep1, WizardStep2, WizardStep3, WizardStep4, WizardStep5];
const STEPS_LABELS = ['Datos', 'Menú', 'Platos', 'Extras', 'Resumen'];

export default function ConfiguradorPage() {
  const { currentStep, totalSteps, previousStep, nextStep, reset } = useWizardStore();
  const CurrentStep = STEPS[currentStep - 1] || WizardStep1;
  const isLastStep = currentStep >= totalSteps;
  const progress = ((currentStep) / totalSteps) * 100;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Top Progress Bar */}
      <div className="h-1 bg-stone-200">
        <motion.div
          className="h-full bg-amber-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeInOut' }}
        />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* Back button */}
          <button
            onClick={() => currentStep > 1 ? previousStep() : reset()}
            className="flex items-center gap-1.5 text-stone-500 hover:text-stone-800 transition-colors text-sm font-medium"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{currentStep > 1 ? 'Atrás' : 'Volver'}</span>
          </button>

          {/* Step labels */}
          <div className="hidden md:flex items-center gap-1.5">
            {STEPS_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold transition-all duration-300 ${
                  i + 1 < currentStep
                    ? 'bg-amber-600 text-white'
                    : i + 1 === currentStep
                    ? 'bg-amber-600 text-white ring-4 ring-amber-100'
                    : 'bg-stone-200 text-stone-500'
                }`}>
                  {i + 1 < currentStep ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className={`text-xs font-medium transition-colors ${
                  i + 1 === currentStep ? 'text-stone-800' : 'text-stone-400'
                }`}>
                  {label}
                </span>
                {i < STEPS_LABELS.length - 1 && (
                  <div className={`w-4 h-px ${i + 1 < currentStep ? 'bg-amber-600' : 'bg-stone-200'}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step counter */}
          <div className="text-sm font-medium text-stone-500">
            <span className="text-stone-800">{currentStep}</span>
            <span className="text-stone-400">/{totalSteps}</span>
          </div>
        </div>
      </header>

      {/* Mobile step indicator */}
      <div className="md:hidden px-4 py-2 bg-white border-b border-stone-100">
        <div className="flex justify-between items-center">
          {STEPS_LABELS.map((label, i) => (
            <div key={i} className={`flex-1 text-center text-xs font-medium py-1 transition-colors ${
              i + 1 === currentStep ? 'text-amber-700' : 'text-stone-400'
            }`}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <CurrentStep />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-stone-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex justify-between gap-3">
          <button
            onClick={() => currentStep > 1 ? previousStep() : reset()}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-sm font-medium text-stone-600
              hover:bg-stone-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <button
            onClick={isLastStep ? () => {} : nextStep}
            className="flex items-center gap-1.5 px-8 py-2.5 rounded-lg text-sm font-semibold text-white
              bg-amber-600 hover:bg-amber-700 transition-all shadow-md hover:shadow-lg"
          >
            <span>{isLastStep ? 'Enviar' : 'Siguiente'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
