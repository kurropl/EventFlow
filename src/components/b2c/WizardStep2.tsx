'use client';
/**
 * EventFlow — Wizard Step 2: Menú Propuesto
 * 
 * Menús predefinidos SIN precios. Diseño limpio y legible.
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
};

export default function WizardStep2() {
  const { step2, setStepData, nextStep } = useWizardStore();
  const [selectedMenu, setSelectedMenu] = useState<string | null>(step2?.menu_id || null);

  useEffect(() => {
    if (step2?.menu_id) setSelectedMenu(step2.menu_id);
  }, [step2]);

  const handleNext = () => {
    if (selectedMenu) {
      setStepData('step2', { menu_id: selectedMenu } as any);
      nextStep();
    }
  };

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
          Elige tu Menú Base
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Selecciona un menú predefinido o personaliza después
        </p>
      </div>

      {/* Menu Cards */}
      <div className="space-y-3">
        {PROPOSED_MENUS.map((menu, i) => (
          <motion.button
            key={menu.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.3 }}
            onClick={() => setSelectedMenu(menu.id)}
            className={`w-full text-left rounded-xl p-5 border-2 transition-all duration-200
              ${selectedMenu === menu.id
                ? 'border-amber-600 bg-amber-50/50 shadow-md'
                : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
              }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="font-serif text-lg text-stone-800">
                    {menu.name}
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TAG_STYLES[menu.tag] || 'bg-stone-100 text-stone-600'}`}>
                    {menu.tag}
                  </span>
                </div>
                <p className="text-sm text-stone-500 mb-3">
                  {menu.sections.length} secciones
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {menu.sections.slice(0, 4).map((section) => (
                    <span key={section.section} className="text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-md">
                      {section.section}
                    </span>
                  ))}
                  {menu.sections.length > 4 && (
                    <span className="text-xs bg-stone-100 text-stone-400 px-2 py-1 rounded-md">
                      +{menu.sections.length - 4} más
                    </span>
                  )}
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors
                ${selectedMenu === menu.id ? 'border-amber-600 bg-amber-600' : 'border-stone-300'}`}>
                {selectedMenu === menu.id && (
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Continue button */}
      <button
        onClick={handleNext}
        disabled={!selectedMenu}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-200
          ${selectedMenu
            ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
      >
        Personalizar Platos →
      </button>
    </motion.div>
  );
}
