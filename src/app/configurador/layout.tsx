'use client';
/**
 * EventFlow — Configurador Layout
 * 
 * Minimal layout for the B2C wizard with progress indicator
 */

import { ReactNode } from 'react';

interface WizardLayoutProps {
  children: ReactNode;
  currentStep: number;
  onBack?: () => void;
}

const STEPS = ['Detalles', 'Menú', 'Personaliza', 'Extras', 'Resumen'];

export default function WizardLayout({ children, currentStep, onBack }: WizardLayoutProps) {
  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-ink-900/95 backdrop-blur border-b border-gold/20">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="text-gold/70 hover:text-gold transition-colors p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <span className="font-serif text-gold text-lg">Alboroto Eventos</span>
          </div>
          
          {/* Progress */}
          <div className="flex items-center gap-1">
            {STEPS.map((label, i) => (
              <div key={label} className="flex items-center">
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-all
                  ${i + 1 === currentStep
                    ? 'bg-gold text-ink font-semibold'
                    : i + 1 < currentStep
                    ? 'bg-gold/30 text-gold'
                    : 'bg-ink/20 text-cream/30'
                  }`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs
                    ${i + 1 === currentStep ? 'bg-ink text-gold' : ''}
                    ${i + 1 < currentStep ? 'bg-gold text-ink' : ''}`}>
                    {i + 1 < currentStep ? '✓' : i + 1}
                  </span>
                  <span className="hidden sm:inline">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-4 h-0.5 mx-1 ${i + 1 < currentStep ? 'bg-gold' : 'bg-ink/20'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
