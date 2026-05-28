'use client';
/**
 * J.Benitez — Wizard Step 3: Personalización de Platos
 * 
 * - Si viene de "Personalizar Menú": items precargados desde step2
 * - Platos principales (carne, pescado): máximo 1 o 2
 * - Contabilización: muestra cantidad por item
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS, CATALOG_CATEGORIES } from '@/data/menus';

// Categorías que se consideran "plato principal" → límite 1-2
const MAIN_COURSES = ['carne', 'pescado', 'arroz'];

export default function WizardStep3() {
  const { step1, step2, step3, setStepData, nextStep, prevStep } = useWizardStore();
  
  // Items ya cargados desde el menú (si viene de Personalizar)
  const [selectedItems, setSelectedItems] = useState<any[]>(step3?.selected_items || []);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Calcular cantidades de items precargados del menú
  const selectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    selectedItems.forEach(item => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item.name);
    });
    return map;
  }, [selectedItems]);

  const adults = step1?.guest_count || 0;
  const isCustomizing = step2?.use_proposed && step2?.menu_id && selectedItems.length > 0;

  // Obtener el límite de platos principales
  const getMainLimit = (cat: string): number => {
    return MAIN_COURSES.includes(cat) ? 2 : 99;
  };

  const toggleItem = (category: string, item: string) => {
    const current = selectionsMap[category] || [];
    const isSelected = current.includes(item);
    const limit = getMainLimit(category);

    if (isSelected) {
      // Quitar item
      setSelectedItems(prev => prev.filter(i => !(i.name === item && i.category === category)));
    } else {
      // Agregar item con cantidad por defecto
      if (current.length >= limit) return; // Límite alcanzado
      const isMain = MAIN_COURSES.includes(category);
      setSelectedItems(prev => [
        ...prev,
        {
          item_id: item,
          name: item,
          category,
          quantity: isMain ? (adults || 1) : Math.ceil((adults || 1) / 10),
          unit_price_pvp: 0,
          unit_price_cost: 0,
          subtotal_pvp: 0,
          subtotal_cost: 0,
        },
      ]);
    }
  };

  const updateQuantity = (itemName: string, category: string, delta: number) => {
    setSelectedItems(prev =>
      prev.map(i => {
        if (i.name === itemName && i.category === category) {
          const newQty = Math.max(1, (i.quantity || 1) + delta);
          return { ...i, quantity: newQty };
        }
        return i;
      })
    );
  };

  const countSelected = (category: string) => (selectionsMap[category] || []).length;
  const totalItems = selectedItems.length;
  const totalQty = selectedItems.reduce((sum, i) => sum + (i.quantity || 0), 0);

  const hasMainCourse = MAIN_COURSES.some(cat => countSelected(cat) > 0);
  const canProceed = totalItems > 0 && hasMainCourse;

  const handleNext = () => {
    if (!canProceed) return;
    setStepData('step3', { selected_items: selectedItems });
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
          {isCustomizing
            ? 'Ajusta las cantidades o cambia los platos del menu seleccionado'
            : 'Selecciona los platos para tu evento'}
        </p>
        <div className="mt-2 inline-flex items-center gap-3 text-xs text-stone-400">
          <span>{totalItems} platos · {totalQty} raciones</span>
          <span>·</span>
          <span>{Object.keys(MAIN_COURSES).length} plato(s) principal(es) máximo 2</span>
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {Object.entries(CATALOG_ITEMS).map(([cat, items]) => {
          const count = countSelected(cat);
          const limit = getMainLimit(cat);
          const isExpanded = expandedCat === cat;
          const isMain = MAIN_COURSES.includes(cat);

          return (
            <div key={cat} className="rounded-xl border border-stone-200 bg-white overflow-hidden transition-all">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition-colors"
                onClick={() => setExpandedCat(isExpanded ? null : cat)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500" style={{ fontFamily: "'Inter', sans-serif" }}>
                    {cat} {isMain ? `(máx. ${limit})` : ''}
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
                      const isSelected = (selectionsMap[cat] || []).includes(item);
                      const selectedItem = selectedItems.find(i => i.name === item && i.category === cat);
                      const atLimit = !isSelected && (count >= limit);
                      return (
                        <div key={item} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleItem(cat, item)}
                            disabled={atLimit}
                            className={`flex-1 flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all duration-200 text-left ${
                              isSelected
                                ? 'bg-[#C9A84C]/10 text-[#1A1A1A] font-medium'
                                : atLimit
                                ? 'text-stone-300 cursor-not-allowed'
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
                          {/* Quantity controls for selected items */}
                          {isSelected && (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => updateQuantity(item, cat, -1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium border border-stone-200 hover:bg-stone-100 transition-colors"
                              >
                                −
                              </button>
                              <span className="text-xs font-semibold text-stone-700 w-5 text-center">
                                {selectedItem?.quantity || 1}
                              </span>
                              <button
                                onClick={() => updateQuantity(item, cat, 1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-xs font-medium border border-stone-200 hover:bg-stone-100 transition-colors"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected items summary */}
      {selectedItems.length > 0 && (
        <div className="rounded-xl border border-stone-200 p-4 bg-[#FAF8F5]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
            Resumen de platos seleccionados ({totalItems})
          </h4>
          <div className="space-y-1.5">
            {selectedItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-stone-700">{item.name}</span>
                <span className="text-stone-400 text-xs">{item.quantity} raciones · {item.category}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          {canProceed ? `Siguiente (${totalItems} platos)` : 'Selecciona al menos 1 plato principal'}
        </button>
      </div>
    </motion.div>
  );
}
