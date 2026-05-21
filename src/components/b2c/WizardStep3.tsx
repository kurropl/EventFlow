'use client';
/**
 * EventFlow — Wizard Step 3: Personalización de Platos
 * 
 * Tabs por categoría con validación: no permite avanzar hasta completar
 * los mínimos de cada categoría. Diseño estilo byalboroto.duckdns.org
 * con colores cream/burgundy/gold.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_CATEGORIES, CATALOG_ITEMS } from '@/data/menus';

// Map proposed menu IDs to their item lists for pre-selection
const PROPOSED_MENU_MAP: Record<string, string[]> = {
  'menu1': [],
  'menu2': [],
  'menu3': [],
  'menu4': [],
  'menu5': [],
  'menu6': [],
  'kid1': [],
  'kid2': [],
};

export default function WizardStep3() {
  const { step3, setStepData, nextStep, step2 } = useWizardStore();
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0].id);
  const [selectedItems, setSelectedItems] = useState<string[]>(
    (step3 as any)?.selected_items?.map((si: { item_id: string }) => si.item_id) || []
  );
  const [showValidationWarning, setShowValidationWarning] = useState(false);

  // Load selected items from step2 if a proposed menu was selected
  useEffect(() => {
    if (step2?.menu_id && selectedItems.length === 0) {
      // Pre-select items from the proposed menu
      const menuItems = PROPOSED_MENU_MAP[step2.menu_id as string];
      if (menuItems) {
        setSelectedItems(menuItems);
      }
    }
  }, [step2?.menu_id]);

  const toggleItem = (name: string) => {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
    setShowValidationWarning(false);
  };

  const currentItems = CATALOG_ITEMS[activeCategory] || [];
  const currentCategory = CATALOG_CATEGORIES.find((c) => c.id === activeCategory);
  const minSelect = currentCategory?.minSelect || 0;
  const currentSelected = selectedItems.filter((id) => CATALOG_ITEMS[activeCategory]?.includes(id)).length;
  const isComplete = minSelect === 0 || currentSelected >= minSelect;

  // Check ALL categories are complete
  const allCategoriesComplete = useMemo(() => {
    return CATALOG_CATEGORIES.every((cat) => {
      const min = cat.minSelect || 0;
      if (min === 0) return true;
      const count = selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length;
      return count >= min;
    });
  }, [selectedItems]);

  // Get incomplete categories list
  const incompleteCategories = useMemo(() => {
    return CATALOG_CATEGORIES.filter((cat) => {
      const min = cat.minSelect || 0;
      if (min === 0) return false;
      const count = selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length;
      return count < min;
    });
  }, [selectedItems]);

  const handleNext = () => {
    // Validate all categories
    if (!allCategoriesComplete) {
      // Find first incomplete category and switch to it
      if (incompleteCategories.length > 0) {
        setActiveCategory(incompleteCategories[0].id);
      }
      setShowValidationWarning(true);
      setTimeout(() => setShowValidationWarning(false), 4000);
      return;
    }
    setStepData('step3', { selected_items: selectedItems.map((id) => ({
      item_id: id,
      name: id,
      category: activeCategory,
      quantity: 1,
    })) } as any);
    nextStep();
  };

  // Total items across all categories
  const totalSelected = selectedItems.length;
  const totalRequired = CATALOG_CATEGORIES.reduce((sum, cat) => sum + (cat.minSelect || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Personaliza tu Menú
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Selecciona los platos de cada categoría. Debes cumplir el mínimo antes de continuar.
        </p>
      </div>

      {/* Validation warning */}
      {showValidationWarning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="bg-red-50 border-2 border-red-200 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-800">Menú incompleto</p>
              <p className="text-xs text-red-600 mt-1">
                Necesitas completar todas las categorías. Pulsa en las pestañas marcadas en rojo para ver cuáles faltan.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Overall progress */}
      <div className="rounded-xl p-4 bg-white border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-stone-700">Progreso del menú</span>
          <span className={`text-sm font-bold ${allCategoriesComplete ? 'text-green-600' : 'text-amber-600'}`}>
            {totalSelected} / {totalRequired} platos mínimos
          </span>
        </div>
        <div className="w-full bg-stone-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${
              allCategoriesComplete ? 'bg-green-500' : 'bg-amber-500'
            }`}
            style={{ width: `${Math.min(100, (totalSelected / Math.max(totalRequired, 1)) * 100)}%` }}
          />
        </div>
      </div>

      {/* Category tabs with validation indicators */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {CATALOG_CATEGORIES.map((cat) => {
          const count = selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length;
          const min = cat.minSelect || 0;
          const isComplete = min === 0 || count >= min;
          const isIncomplete = !isComplete && min > 0;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border-2
                ${activeCategory === cat.id
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300'
                }
                ${isIncomplete && activeCategory !== cat.id ? 'border-red-300 bg-red-50' : ''}
              `}
            >
              <span className="mr-1">{cat.label}</span>
              <span className={`ml-1.5 text-xs ${
                activeCategory === cat.id ? 'text-amber-200' :
                isIncomplete ? 'text-red-500 font-bold' : 'text-stone-400'
              }`}>
                ({count}{min > 0 ? `/${min}` : ''})
              </span>
              {isComplete && activeCategory !== cat.id && (
                <span className="ml-1 text-green-500">✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Current category status */}
      <div className={`rounded-xl p-4 border-2 transition-colors ${
        isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className={`text-sm font-semibold ${isComplete ? 'text-green-800' : 'text-amber-800'}`}>
              {isComplete ? '✓ Categoría completa' : `Faltan ${minSelect - currentSelected} platos`}
            </span>
          </div>
          <span className="text-sm text-stone-500">
            {currentSelected} / {minSelect || '∞'} seleccionados
          </span>
        </div>
      </div>

      {/* Dish cards */}
      <div className="grid gap-2">
        {currentItems.map((dish) => {
          const isSelected = selectedItems.includes(dish);
          return (
            <button
              key={dish}
              onClick={() => toggleItem(dish)}
              className={`w-full text-left rounded-xl p-4 border-2 transition-all duration-150
                ${isSelected
                  ? 'border-amber-500 bg-amber-50 shadow-sm'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-all
                  ${isSelected ? 'border-amber-500 bg-amber-500' : 'border-stone-300'}`}>
                  {isSelected && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`text-sm ${isSelected ? 'font-semibold text-stone-800' : 'text-stone-600'}`}>
                  {dish}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Continue button */}
      <button
        onClick={handleNext}
        disabled={!allCategoriesComplete}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-200
          ${allCategoriesComplete
            ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
      >
        {allCategoriesComplete ? 'Sugerencias →' : `Completa el menú (${incompleteCategories.length} categoría${incompleteCategories.length > 1 ? 's' : ''} pendiente${incompleteCategories.length > 1 ? 's' : ''})`}
      </button>
    </motion.div>
  );
}
