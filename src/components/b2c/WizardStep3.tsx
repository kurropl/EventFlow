'use client';
/**
 * EventFlow — Wizard Step 3: Personalización de Platos
 * 
 * Tabs por categoría, tarjetas de platos limpias.
 * Sin emojis. Tipografía clara sobre fondos blancos.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_CATEGORIES, CATALOG_ITEMS } from '@/data/menus';
import DishCard from './DishCard';

export default function WizardStep3() {
  const { step3, setStepData, nextStep } = useWizardStore();
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0].id);
  const [selectedItems, setSelectedItems] = useState<string[]>(
    (step3 as any)?.selected_items?.map((si: { item_id: string }) => si.item_id) || []
  );

  useEffect(() => {
    const items = selectedItems.map((id) => ({
      item_id: id,
      name: id,
      category: activeCategory,
      quantity: 1,
    }));
    setStepData('step3', { selected_items: items } as any);
  }, [selectedItems, activeCategory]);

  const toggleItem = (name: string) => {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const currentItems = CATALOG_ITEMS[activeCategory] || [];
  const currentCategory = CATALOG_CATEGORIES.find((c) => c.id === activeCategory);
  const minSelect = currentCategory?.minSelect || 0;
  const currentSelected = selectedItems.filter((id) => CATALOG_ITEMS[activeCategory]?.includes(id)).length;
  const isComplete = minSelect === 0 || currentSelected >= minSelect;

  const handleNext = () => {
    nextStep();
  };

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
          Selecciona los platos que desees de cada categoría.
          {minSelect > 0 && ` Mínimo ${minSelect} por categoría.`}
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {CATALOG_CATEGORIES.map((cat) => {
          const count = selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border
                ${activeCategory === cat.id
                  ? 'bg-amber-600 text-white border-amber-600 shadow-md'
                  : 'bg-white text-stone-600 border-stone-200 hover:border-stone-300 hover:bg-stone-50'
                }`}
            >
              {cat.label}
              <span className={`ml-1.5 text-xs ${activeCategory === cat.id ? 'text-amber-200' : 'text-stone-400'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Selection status bar */}
      <div className={`rounded-xl p-4 border ${
        isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className={`text-sm font-medium ${isComplete ? 'text-green-800' : 'text-amber-800'}`}>
              {currentSelected} / {minSelect || '∞'} seleccionados
            </span>
          </div>
          <span className="text-sm text-stone-500">
            Total: {selectedItems.length} platos
          </span>
        </div>
      </div>

      {/* Dish cards */}
      <div className="grid gap-2">
        {currentItems.map((dish, i) => (
          <DishCard
            key={dish}
            name={dish}
            selected={selectedItems.includes(dish)}
            onClick={() => toggleItem(dish)}
            category={activeCategory}
          />
        ))}
      </div>

      {/* Continue button */}
      <button
        onClick={handleNext}
        className="w-full py-4 rounded-xl font-semibold text-base bg-amber-600 text-white hover:bg-amber-700 transition-all shadow-md hover:shadow-lg mt-4"
      >
        Sugerencias →
      </button>
    </motion.div>
  );
}
