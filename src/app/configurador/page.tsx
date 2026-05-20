'use client';
/**
 * EventFlow — Configurador Page (B2C)
 * 
 * Orquesta los 5 pasos del wizard con transiciones Framer Motion.
 * Sin precios en ningún lado.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import WizardStep1 from '@/components/b2c/WizardStep1';
import WizardStep2 from '@/components/b2c/WizardStep2';
import WizardStep3 from '@/components/b2c/WizardStep3';
import WizardStep4 from '@/components/b2c/WizardStep4';
import WizardStep5 from '@/components/b2c/WizardStep5';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const STEPS = [WizardStep1, WizardStep2, WizardStep3, WizardStep4, WizardStep5];
const STEPS_LABELS = ['Datos', 'Menú', 'Personalizar', 'Sugerencias', 'Resumen'];

export default function ConfiguradorPage() {
  const { currentStep, totalSteps, previousStep, nextStep, reset } = useWizardStore();
  const CurrentStep = STEPS[currentStep - 1] || WizardStep1;
  const isLastStep = currentStep >= totalSteps;

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-cream-dark/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => currentStep > 1 ? previousStep() : reset()}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            {currentStep > 1 ? 'Atrás' : 'Volver'}
          </Button>
          <div className="flex items-center gap-2">
            {STEPS_LABELS.map((label, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 <= currentStep ? 'w-8 bg-amber-600' : 'w-4 bg-cream-dark/20'
                }`}
              />
            ))}
          </div>
          <div className="text-sm font-medium text-ink/60">
            Paso {currentStep}/{totalSteps}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <CurrentStep />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer Nav */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t border-cream-dark/20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? previousStep() : reset()}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Anterior
          </Button>
          <Button
            onClick={isLastStep ? () => {} : nextStep}
            className="gap-2"
          >
            {isLastStep ? 'Enviar' : 'Siguiente'}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}
