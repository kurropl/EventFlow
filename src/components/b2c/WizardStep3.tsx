'use client';
/**
 * J.Benitez — Wizard Step 3: Personalización de Platos
 * 
 * Diseño premium con selección interactiva de platos por categoría.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_CATEGORIES, CATALOG_ITEMS, ProposedMenu } from '@/data/menus';
import { PROPOSED_MENUS } from '@/data/menus';

const DEFAULT_MINIMUMS: Record<string, number> = {
  'carne': 1,
  'pescado': 1,
  'arroz': 0,
  'sorbete': 1,
  'postre': 1,
  'aperitivo-frio': 4,
  'aperitivo-caliente': 4,
  'compartir-mesa': 1,
  'bebida': 0,
  'complemento': 0,
};

function getMenuPlatos(menuId: string): string[] {
  const menu = PROPOSED_MENUS.find((m) => m.id === menuId);
  if (!menu) return [];
  const platos: string[] = [];
  for (const section of menu.sections) {
    platos.push(...section.items);
  }
  return platos;
}

function getDishCategory(dishName: string): string {
  const lower = dishName.toLowerCase();
  
  for (const [catId, items] of Object.entries(CATALOG_ITEMS)) {
    for (const item of items) {
      if (item.toLowerCase() === lower || 
          item.toLowerCase().includes(lower.substring(0, 15)) ||
          lower.includes(item.toLowerCase().substring(0, 15))) {
        return catId;
      }
    }
  }
  
  if (lower.includes('carrillera') || lower.includes('cordero') || lower.includes('pato') || 
      lower.includes('solomillo') || lower.includes('pres')) return 'carne';
  if (lower.includes('lubina') || lower.includes('merluza') || lower.includes('bacalao') || 
      lower.includes('gamb') || lower.includes('pulpo') || lower.includes('rodaballo')) return 'pescado';
  if (lower.includes('arroz') || lower.includes('paella') || lower.includes('fideuá')) return 'arroz';
  if (lower.includes('sorbete') || lower.includes('helado') || lower.includes('granizado')) return 'sorbete';
  if (lower.includes('postre') || lower.includes('tarta') || lower.includes('pastelito') || 
      lower.includes('brownie') || lower.includes('crema') || lower.includes('flan')) return 'postre';
  if (lower.includes('canapé') || lower.includes('tosta') || lower.includes('croqueta') || 
      lower.includes('empanadilla') || lower.includes('pincho') || lower.includes('mini toast')) return 'aperitivo-caliente';
  return 'aperitivo-frio';
}

export default function WizardStep3() {
  const { step1, step2, step3, setStepData, nextStep, prevStep } = useWizardStore();
  const [selections, setSelections] = useState<Record<string, string[]>>(step3?.selections || {});
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const isPredefined = !!step2?.menu_id;
  const predefinedPlatos = isPredefined ? getMenuPlatos(step2.menu_id) : [];

  // Initialize selections from predefined menu
  useEffect(() => {
    if (isPredefined && predefinedPlatos.length > 0 && Object.keys(selections).length === 0) {
      const initialSelections: Record<string, string[]> = {};
      predefinedPlatos.forEach(plato => {
        const cat = getDishCategory(plato);
        if (!initialSelections[cat]) initialSelections[cat] = [];
        if (!initialSelections[cat].includes(plato)) {
          initialSelections[cat].push(plato);
        }
      });
      setSelections(initialSelections);
    }
  }, [isPredefined, predefinedPlatos]);

  const toggleSelection = (category: string, item: string) => {
    setSelections(prev => {
      const current = prev[category] || [];
      const updated = current.includes(item)
        ? current.filter(i => i !== item)
        : [...current, item];
      return { ...prev, [category]: updated };
    });
  };

  const getMinRequired = (catId: string) => {
    const cat = CATALOG_CATEGORIES.find(c => c.id === catId);
    return cat?.minSelect || DEFAULT_MINIMUMS[catId] || 0;
  };

  const isCategoryComplete = (catId: string) => {
    const count = (selections[catId] || []).length;
    return count >= getMinRequired(catId);
  };

  const canProceed = () => {
    if (isPredefined) return true;
    return CATALOG_CATEGORIES.every(cat => isCategoryComplete(cat.id));
  };

  const handleNext = () => {
    setStepData('step3', { selections, extras: [] });
    nextStep();
  };

  const filteredItems = (catId: string) => {
    const items = CATALOG_ITEMS[catId] || [];
    if (!searchTerm) return items;
    return items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));
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
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Personaliza tu Menú
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          {isPredefined 
            ? 'Modifica los platos de tu menú seleccionado'
            : 'Selecciona platos para cada categoría'}
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto">
        <input
          type="text"
          placeholder="Buscar plato..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
        />
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {CATALOG_CATEGORIES.map((cat) => {
          const items = filteredItems(cat.id);
          const selectedCount = (selections[cat.id] || []).length;
          const isComplete = isCategoryComplete(cat.id);

          return (
            <div
              key={cat.id}
              className={`rounded-xl border-2 p-5 transition-all duration-300 ${
                isComplete
                  ? 'border-[#C9A84C] bg-[#C9A84C]/5'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg text-stone-800">{cat.label}</h3>
                <span className={`text-sm font-medium ${isComplete ? 'text-[#C9A84C]' : 'text-stone-500'}`}>
                  {selectedCount}/{getMinRequired(cat.id)}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const isSelected = (selections[cat.id] || []).includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleSelection(cat.id, item)}
                      className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 ${
                        isSelected
                          ? 'bg-[#C9A84C]/20 text-[#C9A84C] font-medium'
                          : 'text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-stone-300'
                        }`}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span>{item}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t border-stone-200">
        <button
          onClick={prevStep}
          className="px-6 py-3 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
        >
          Anterior
        </button>
        <button
          onClick={handleNext}
          disabled={!canProceed()}
          className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
            canProceed()
              ? 'bg-[#C9A84C] text-white hover:bg-[#A88A3A] shadow-lg shadow-[#C9A84C]/30'
              : 'bg-stone-200 text-stone-500 cursor-not-allowed'
          }`}
        >
          Siguiente
        </button>
      </div>
    </motion.div>
  );
}
