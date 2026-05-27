'use client';
/**
 * J.Benitez — Wizard Step 3: Personalización de Platos
 * 
 * Colores coherentes gold/cream/ink
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS, CATALOG_CATEGORIES } from '@/data/menus';

const EVENT_COLORS: Record<string, string> = {
  boda: '#C9A84C',
  'cumpleanos': '#C9A84C',
  corporativo: '#1A1A1A',
  bautizo: '#C9A84C',
  comunión: '#C9A84C',
  otro: '#1A1A1A',
};

export default function WizardStep3() {
  const { step1, step2, step3, setStepData, nextStep, prevStep } = useWizardStore();
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const adults = step1?.guest_count || 0;
  const minPerCat = Math.max(1, Math.ceil(adults / 15));

  // Pre-select from step2 if using proposed menu
  useEffect(() => {
    if (step2?.use_proposed && step2?.menu_id && !step3?.selected_items?.length) {
      const preselected: Record<string, string[]> = {};
      const menuItems = step2.menu_id.split(',');
      // Default: select first item from each category
      Object.entries(CATALOG_ITEMS).forEach(([cat, items]) => {
        if (items.length > 0) {
          preselected[cat] = [items[0]];
        }
      });
      setSelections(preselected);
    }
  }, [step2?.menu_id, step2?.use_proposed]);

  const toggleSelection = (category: string, item: string) => {
    setSelections(prev => {
      const current = prev[category] || [];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, [category]: updated };
    });
  };

  const countSelected = (category: string) => (selections[category] || []).length;
  const totalSelected = Object.values(selections).reduce((sum, items) => sum + items.length, 0);
  const canProceed = totalSelected >= Object.keys(CATALOG_ITEMS).length;

  const handleNext = () => {
    if (!canProceed) return;
    setStepData('step3', { selected_items: [] });
    nextStep();
  };

  const catItems = (cat: string) => CATALOG_ITEMS[cat] || [];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Personaliza tu Menu
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Selecciona al menos un plato por categoria ({Object.keys(CATALOG_ITEMS).length} categorias)
        </p>
        <div className="mt-2 inline-flex items-center gap-2 text-xs text-stone-400">
          <span>{totalSelected} seleccionados</span>
          <span>·</span>
          <span>{Object.keys(CATALOG_ITEMS).filter(c => countSelected(c) > 0).length}/{Object.keys(CATALOG_ITEMS).length} categorias</span>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {Object.entries(CATALOG_ITEMS).map(([cat, items]) => {
          const count = countSelected(cat);
          const isExpanded = expandedCat === cat;
          return (
            <div key={cat} className="rounded-xl border border-stone-200 bg-white overflow-hidden transition-all">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition-colors"
                onClick={() => setExpandedCat(isExpanded ? null : cat)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {cat}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    count > 0 ? 'bg-[#C9A84C]/15 text-[#C9A84C]' : 'bg-stone-100 text-stone-400'
                  }`}>
                    {count}
                  </span>
                </div>
                <svg className={`w-4 h-4 text-stone-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1">
                    {items.map((item) => {
                      const isSelected = (selections[cat] || []).includes(item);
                      return (
                        <button
                          key={item}
                          onClick={() => toggleSelection(cat, item)}
                          className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all duration-200 text-left ${
                            isSelected
                              ? 'bg-[#C9A84C]/10 text-[#1A1A1A] font-medium'
                              : 'text-stone-600 hover:bg-stone-50'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                            isSelected ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-stone-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span>{item}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-stone-200">
        <button onClick={prevStep} className="px-5 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors">
          Anterior
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed}
          className={`px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
            canProceed
              ? 'bg-[#1A1A1A] text-white hover:bg-stone-800 shadow-lg shadow-stone-900/20'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          Siguiente
        </button>
      </div>
    </motion.div>
  );
}
