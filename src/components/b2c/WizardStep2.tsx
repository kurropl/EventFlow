'use client';
/**
 * EventFlow — Wizard Step 2: Menú Propuesto
 * 
 * DOS OPCIONES CLARAS:
 * 1. Menú predefinido — elige uno de los menús completos (estilo PDF)
 * 2. Personalizado — elige platos uno a uno (wizard manual)
 * 
 * Si elige menú predefinido, puede personalizar después o usarlo tal cual.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS } from '@/data/menus';

const TAG_STYLES: Record<string, string> = {
  'Recomendado': 'bg-amber-100 text-amber-800',
  'Premium': 'bg-stone-800 text-white',
  'Premium +': 'bg-stone-800 text-white',
  'Gran Selección': 'bg-amber-100 text-amber-800',
  'Infantil': 'bg-green-100 text-green-800',
  'Esencial': 'bg-stone-100 text-stone-600',
  'Completo': 'bg-amber-100 text-amber-800',
};

export default function WizardStep2() {
  const { step2, setStepData, nextStep } = useWizardStore();
  const [mode, setMode] = useState<'proposed' | 'custom'>('proposed');
  const [selectedMenu, setSelectedMenu] = useState<string | null>(step2?.menu_id || null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  useEffect(() => {
    if (step2?.menu_id) setSelectedMenu(step2.menu_id);
    if (step2?.use_proposed === false) setMode('custom');
  }, [step2]);

  const handleSelect = (menuId: string) => {
    setSelectedMenu(menuId);
    setExpandedMenu(menuId);
  };

  const handleModeChange = (newMode: 'proposed' | 'custom') => {
    setMode(newMode);
    if (newMode === 'custom') {
      // Clear menu selection when switching to custom
      setSelectedMenu(null);
      setStepData('step2', { menu_id: null, use_proposed: false } as any);
    }
  };

  const handleNext = () => {
    if (mode === 'proposed' && selectedMenu) {
      setStepData('step2', { menu_id: selectedMenu, use_proposed: true } as any);
      nextStep();
    } else if (mode === 'custom') {
      setStepData('step2', { menu_id: null, use_proposed: false } as any);
      nextStep();
    }
  };

  const selectedMenuData = PROPOSED_MENUS.find((m) => m.id === selectedMenu);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Elige tu Menú
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Selecciona un menú completo o personaliza cada plato.
        </p>
      </div>

      {/* Mode selector — two clear options */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Option 1: Proposed menu */}
        <button
          onClick={() => handleModeChange('proposed')}
          className={`rounded-2xl p-6 border-2 text-left transition-all duration-200
            ${mode === 'proposed'
              ? 'border-amber-600 bg-amber-50/50 shadow-lg shadow-amber-100/50'
              : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
            }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center
              ${mode === 'proposed' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg text-stone-800">Menú Predefinido</h3>
              <p className="text-xs text-stone-500">Menús completos listos para usar</p>
            </div>
          </div>
          <p className="text-sm text-stone-600">
            Elige entre 6 menús completos con secciones ya organizadas. Puedes usarlos tal cual o personalizar después.
          </p>
          {mode === 'proposed' && (
            <div className="absolute top-3 right-3">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>

        {/* Option 2: Custom */}
        <button
          onClick={() => handleModeChange('custom')}
          className={`rounded-2xl p-6 border-2 text-left transition-all duration-200
            ${mode === 'custom'
              ? 'border-amber-600 bg-amber-50/50 shadow-lg shadow-amber-100/50'
              : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
            }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center
              ${mode === 'custom' ? 'bg-amber-600 text-white' : 'bg-stone-100 text-stone-500'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
              </svg>
            </div>
            <div>
              <h3 className="font-serif text-lg text-stone-800">Personalizado</h3>
              <p className="text-xs text-stone-500">Elige cada plato a tu medida</p>
            </div>
          </div>
          <p className="text-sm text-stone-600">
            Construye tu menú plato a plato. Selecciona entrantes, carnes, pescados, postres y bebidas.
          </p>
          {mode === 'custom' && (
            <div className="absolute top-3 right-3">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      </div>

      {/* Proposed menu list (shown when mode is proposed) */}
      {mode === 'proposed' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-600" />
            <span className="text-sm font-semibold text-stone-700">Elige un menú de la lista</span>
          </div>

          <div className="space-y-3">
            {PROPOSED_MENUS.map((menu, i) => {
              const isSelected = selectedMenu === menu.id;
              const isExpanded = expandedMenu === menu.id;
              const totalItems = menu.sections.reduce((sum, s) => sum + s.items.length, 0);

              return (
                <motion.div
                  key={menu.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.3 }}
                  className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden
                    ${isSelected
                      ? 'border-amber-600 bg-amber-50/30 shadow-lg shadow-amber-100/50'
                      : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
                    }`}
                >
                  <button
                    onClick={() => handleSelect(menu.id)}
                    className="w-full text-left p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-serif text-xl text-stone-800">
                            {menu.name}
                          </h3>
                          <span className={`px-3 py-0.5 rounded-full text-xs font-semibold ${TAG_STYLES[menu.tag] || 'bg-stone-100 text-stone-600'}`}>
                            {menu.tag}
                          </span>
                          {menu.is_kid && (
                            <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                              Infantil
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-stone-500">
                          <span>{menu.sections.length} secciones</span>
                          <span>·</span>
                          <span>{totalItems} platos</span>
                        </div>
                      </div>
                      <div className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                        ${isSelected ? 'border-amber-600 bg-amber-600 scale-110' : 'border-stone-300'}`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Expanded sections */}
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-amber-200/50 bg-white/50"
                    >
                      <div className="p-5 pt-4 space-y-4">
                        {menu.sections.map((section, si) => (
                          <div key={si}>
                            <h4 className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">
                              {section.section}
                            </h4>
                            <div className="flex flex-wrap gap-1.5">
                              {section.items.map((item, ii) => (
                                <span
                                  key={ii}
                                  className="text-sm text-stone-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-100"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Continue button */}
      <button
        onClick={handleNext}
        disabled={!(mode === 'proposed' && selectedMenu)}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-200
          ${(mode === 'proposed' && selectedMenu)
            ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
      >
        {mode === 'custom' ? 'Personalizar Platos →' : 'Continuar →'}
      </button>
    </motion.div>
  );
}
