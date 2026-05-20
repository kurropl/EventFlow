'use client';
/**
 * EventFlow — Configurador Page (B2C)
 * 
 * Orquesta los 5 pasos del wizard con transiciones Framer Motion.
 * Sin precios en ningún lado.
 */

import { AnimatePresence } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import WizardLayout from '../app/configurador/layout';
import WizardStep1 from '@/components/b2c/WizardStep1';
import WizardStep2 from '@/components/b2c/WizardStep2';
import WizardStep3 from '@/components/b2c/WizardStep3';
import WizardStep4 from '@/components/b2c/WizardStep4';
import WizardStep5 from '@/components/b2c/WizardStep5';

const STEPS = [WizardStep1, WizardStep2, WizardStep3, WizardStep4, WizardStep5];

export default function ConfiguradorPage() {
  const { currentStep, reset } = useWizardStore();
  const CurrentStep = STEPS[currentStep - 1] || WizardStep1;

  return (
    <WizardLayout currentStep={currentStep} onBack={currentStep > 1 ? undefined : () => {}}>
      <AnimatePresence mode="wait">
        <CurrentStep key={currentStep} />
      </AnimatePresence>
    </WizardLayout>
  );
}
