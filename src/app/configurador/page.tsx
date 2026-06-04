'use client';
/**
 * J.Benitez — Configurador Page (B2C) Rediseñado
 *
 * Header limpio crema/dorado sin negro agresivo
 * Paleta coherente: cream (#F8F3E6) / gold (#C9A84C) / ink (#1A1A1A)
 * Sin colores mezclados entre pasos
 *
 * Comportamiento de persistencia:
 * - Al cargar la página, si hay datos persistidos del wizard, se pregunta si quiere
 *   continuar con ellos o empezar de nuevo.
 * - Si el usuario ya está en un paso avanzado (step > 1), NO se muestra el popup:
 *   se continúa con la configuración existente.
 */

import { useState, useEffect, useRef } from 'react';
import { useWizardStore } from '@/store/useWizardStore';

const STEP_LABELS = [
  'Detalles',
  'Menu',
  'Personalizar',
  'Extras',
  'Resumen',
];

function LazyStep({ step }: { step: number }) {
  const { currentStep, nextStep, prevStep } = useWizardStore();
  const [Comp, setComp] = useState<any>(null);

  useEffect(() => {
    const names = ['WizardStep1', 'WizardStep2', 'WizardStep3', 'WizardStep4', 'WizardStep5'];
    import(`@/components/b2c/${names[step - 1]}`).then((m) => setComp(() => m.default));
  }, [step]);

  if (!Comp) return null;
  return <Comp onNext={nextStep} onPrev={prevStep} />;
}

export default function ConfiguradorPage() {
  const { currentStep, nextStep, prevStep, reset, step1, step2, step3, step4 } = useWizardStore();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const hasCheckedPersistence = useRef(false);

  // Al montar: si hay datos persistidos y estamos en step 1, mostrar popup de continuar
  useEffect(() => {
    if (hasCheckedPersistence.current) return;
    hasCheckedPersistence.current = true;

    const hasPersistedData = step1 !== null || step2 !== null || step3 !== null || step4 !== null;
    if (hasPersistedData && currentStep === 1) {
      setShowResumeDialog(true);
    }
  }, [step1, step2, step3, step4, currentStep]);

  const handleReset = () => {
    reset();
    setShowResetConfirm(false);
  };

  const handleResume = () => {
    setShowResumeDialog(false);
    // Los datos ya están en el store por persist, solo cerramos el popup
  };

  const handleStartFresh = () => {
    setShowResumeDialog(false);
    reset();
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
        
          <div
            key={currentStep}
          >
            <LazyStep step={currentStep} />
          </div>
        
      </main>

      {/* Dialog: ¿Continuar configuración anterior o empezar de nuevo? */}
      {showResumeDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 p-6 max-w-sm w-full mx-4"
          >
            <h3 className="text-lg font-semibold text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              ¿Configuración anterior?
            </h3>
            <p className="text-sm text-stone-500 mb-6">
              Detectamos una configuración guardada. ¿Quieres continuar con ella o empezar de nuevo?
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleStartFresh}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
              >
                Empezar de nuevo
              </button>
              <button
                onClick={handleResume}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors"
                style={{ background: '#C9A84C' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#B8953F')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '#C9A84C')}
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}