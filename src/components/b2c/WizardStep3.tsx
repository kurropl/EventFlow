'use client';
/**
 * EventFlow — Wizard Step 3: Personalización de Platos
 * 
 * Tabs por categoría, tarjetas de platos SIN precios.
 * Selección múltiple con actualización visual.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_CATEGORIES, CATALOG_ITEMS } from '@/data/menus';
import DishCard from './DishCard';

export default function WizardStep3() {
  const { step3, setStepData, nextStep, prevStep, step1 } = useWizardStore();
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0].id);
  const [selectedItems, setSelectedItems] = useState<string[]>(
    step3?.selectedItems?.map((si: { item_id: string }) => si.item_id) || []
  );

  // Persist selections back to store on change
  useEffect(() => {
    const items = selectedItems.map((id) => ({
      item_id: id,
      name: id,
      category: activeCategory,
      quantity: 1,
    }));
    setStepData('step3', { selectedItems: items });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems]);

  const toggleItem = (name: string) => {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const currentItems = CATALOG_ITEMS[activeCategory] || [];
  const currentCategory = CATALOG_CATEGORIES.find((c) => c.id === activeCategory);
  const minSelect = currentCategory?.minSelect || 0;

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
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-ink mb-2">Personaliza tu Menú</h2>
        <p className="text-ink-soft/60">
          Selecciona los platos que desees. 
          {minSelect > 0 && ` Mínimo ${minSelect} por categoría.`}
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {CATALOG_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
              ${activeCategory === cat.id
                ? 'bg-gold text-ink shadow-md'
                : 'bg-paper text-ink/60 hover:bg-gold/10 hover:text-ink'
              }`}
          >
            {cat.label}
            <span className="ml-1.5 text-xs opacity-60">
              ({selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length})
            </span>
          </button>
        ))}
      </div>

      {/* Selected count bar */}
      <div className="bg-paper rounded-xl p-4 border border-gold/10 flex items-center justify-between">
        <div>
          <span className="text-sm text-ink/60">Seleccionados en esta categoría:</span>
          <span className="ml-2 font-semibold text-gold">
            {selectedItems.filter((id) => CATALOG_ITEMS[activeCategory]?.includes(id)).length}
            {minSelect > 0 && (
              <span className={`ml-1.5 text-xs ${selectedItems.filter((id) => CATALOG_ITEMS[activeCategory]?.includes(id)).length >= minSelect ? 'text-green-600' : 'text-amber-600'}`}>
                / {minSelect} mínimo
              </span>
            )}
          </span>
        </div>
        <div className="text-sm text-ink/40">
          Total: {selectedItems.length} platos
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

      {/* Buttons */}
      <div className="flex gap-3 pt-4">
        <button onClick={prevStep} className="px-6 py-4 rounded-xl border-2 border-gold/20 text-ink/60 hover:border-gold/50 hover:text-ink transition-all">← Atrás</button>
        <button
          onClick={handleNext}
          className="flex-1 py-4 rounded-xl bg-gold text-ink font-semibold text-lg hover:bg-amber-400 transition-all shadow-lg shadow-gold/20"
        >
          Sugerencias →
        </button>
      </div>
    </motion.div>
  );
}
