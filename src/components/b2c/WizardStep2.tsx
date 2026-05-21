'use client';
/**
 * EventFlow — Wizard Step 2: Menú Propuesto
 * 
 * Menús predefinidos estilo PDF: secciones completas con todos los platos.
 * Diseño elegante con tarjetas que muestran cada sección del menú.
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
  const [selectedMenu, setSelectedMenu] = useState<string | null>(step2?.menu_id || null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  useEffect(() => {
    if (step2?.menu_id) setSelectedMenu(step2.menu_id);
  }, [step2]);

  const handleSelect = (menuId: string) => {
    setSelectedMenu(menuId);
    setExpandedMenu(menuId);
  };

  const handleNext = () => {
    if (selectedMenu) {
      setStepData('step2', { menu_id: selectedMenu } as any);
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
          Selecciona un menú predefinido. Podrás personalizar los platos después.
        </p>
      </div>

      {/* Menu Cards */}
      <div className="space-y-4">
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
              {/* Card header */}
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

      {/* Selected menu preview */}
      {selectedMenuData && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl border border-stone-200 p-5"
        >
          <h3 className="font-serif text-lg text-stone-800 mb-2">
            Menú seleccionado: {selectedMenuData.name}
          </h3>
          <p className="text-sm text-stone-500">
            Pulsa en el menú para ver todos los platos. Podrás personalizar después.
          </p>
        </motion.div>
      )}

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
