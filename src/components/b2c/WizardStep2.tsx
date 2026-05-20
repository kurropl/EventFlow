'use client';
/**
 * EventFlow — Wizard Step 2: Menú Propuesto
 * 
 * Muestra los menús predefinidos SIN precios.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS } from '@/data/menus';

export default function WizardStep2() {
  const { step2, setStepData, nextStep, prevStep } = useWizardStore();
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
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-ink mb-2">Elige tu Menú Base</h2>
        <p className="text-ink-soft/60">Selecciona un menú predefinido o personaliza después</p>
      </div>

      <div className="grid gap-4">
        {PROPOSED_MENUS.map((menu, i) => (
          <motion.button
            key={menu.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
            whileHover={{ y: -2 }}
            onClick={() => setSelectedMenu(menu.id)}
            className={`w-full text-left rounded-xl p-6 border-2 transition-all duration-300
              ${selectedMenu === menu.id
                ? 'border-gold bg-gold/5 shadow-lg shadow-gold/10'
                : 'border-gold/10 bg-paper hover:border-gold/30 hover:shadow-md'
              }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-serif text-xl text-ink">{menu.name}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${menu.tag === 'Recomendado' ? 'bg-gold/20 text-gold' :
                      (menu.tag === 'Premium' || menu.tag === 'Premium +') ? 'bg-burgundy-900/20 text-burgundy-900' :
                      menu.tag === 'Gran Selección' ? 'bg-amber-700/20 text-amber-700' :
                      menu.tag === 'Infantil' ? 'bg-green-700/20 text-green-700' :
                      'bg-ink/10 text-ink/60'
                    }`}>
                    {menu.tag}
                  </span>
                </div>
                <p className="text-sm text-ink-soft/60 mb-3">{menu.sections.length} secciones</p>
                <div className="flex flex-wrap gap-2">
                  {menu.sections.slice(0, 3).map((section) => (
                    <span key={section.section} className="text-xs bg-ink/5 text-ink/50 px-2 py-1 rounded-full">
                      {section.section}
                    </span>
                  ))}
                  {menu.sections.length > 3 && (
                    <span className="text-xs bg-ink/5 text-ink/40 px-2 py-1 rounded-full">
                      +{menu.sections.length - 3} más
                    </span>
                  )}
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                ${selectedMenu === menu.id ? 'border-gold bg-gold' : 'border-gold/30'}`}>
                {selectedMenu === menu.id && (
                  <svg className="w-3.5 h-3.5 text-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="flex gap-3">
        <button onClick={prevStep} className="px-6 py-4 rounded-xl border-2 border-gold/20 text-ink/60 hover:border-gold/50 hover:text-ink transition-all">← Atrás</button>
        <button
          onClick={handleNext}
          disabled={!selectedMenu}
          className={`flex-1 py-4 rounded-xl font-semibold text-lg transition-all duration-300
            ${selectedMenu ? 'bg-gold text-ink hover:bg-amber-400 shadow-lg shadow-gold/20' : 'bg-ink/10 text-ink/30 cursor-not-allowed'}`}
        >
          Personalizar Platos →
        </button>
      </div>
    </motion.div>
  );
}
