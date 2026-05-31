'use client';
/**
 * J.Benitez — Wizard Step 3: Personalización de Platos
 *
 * - Aperitivos y complementos: solo ON/OFF (sin cantidad individual)
 * - Plato principal (carne/pescado/arroz): máximo 2 TOTAL entre los tres
 * - Cada plato principal = 1 ración por comensal
 * - Sorbete, postre, bebida: ON/OFF (van incluidos con el menú)
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS, CATALOG_CATEGORIES } from '@/data/menus';

// Categorías que se consideran "plato principal"
const MAIN_COURSES = ['carne', 'pescado', 'arroz'];
const MAIN_MAX = 2;

// Categorías que NO necesitan cantidad (van incluidas en menú)
const NO_QTY = ['aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa', 'sorbete', 'postre', 'bebida', 'complemento'];

function catLabel(cat: string): string {
  const labels: Record<string, string> = {
    'aperitivo-frio': 'Aperitivos Fríos',
    'aperitivo-caliente': 'Aperitivos Calientes',
    'compartir-mesa': 'Para Compartir en Mesa',
    'carne': 'Plato de Carne',
    'pescado': 'Plato de Pescado',
    'arroz': 'Arroz',
    'sorbete': 'Sorbete',
    'postre': 'Postre',
    'bebida': 'Bebida',
    'complemento': 'Complementos',
  };
  return labels[cat] || cat;
}

export default function WizardStep3() {
  const { step1, step2, step3, setStepData, nextStep, prevStep } = useWizardStore();
  const [selectedItems, setSelectedItems] = useState<any[]>(step3?.selected_items || []);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const adults = step1?.guest_count || 0;

  // Nombres seleccionados por categoría
  const selectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    selectedItems.forEach(item => {
      if (!map[item.category]) map[item.category] = [];
      map[item.category].push(item.name);
    });
    return map;
  }, [selectedItems]);

  // Total de platos principales seleccionados
  const mainCount = MAIN_COURSES.reduce((sum, cat) => sum + ((selectionsMap[cat] || []).length), 0);
  const mainsAtMax = mainCount >= MAIN_MAX;

  const toggleItem = (category: string, item: string) => {
    const current = selectionsMap[category] || [];
    const isSelected = current.includes(item);
    const isMain = MAIN_COURSES.includes(category);

    if (isSelected) {
      setSelectedItems(prev => prev.filter(i => !(i.name === item && i.category === category)));
    } else {
      // Límite total de platos principales
      if (isMain && mainsAtMax) return;

      const onePerGuest = isMain || category === 'compartir-mesa';
      setSelectedItems(prev => [
        ...prev,
        {
          item_id: item,
          name: item,
          category,
          quantity: onePerGuest ? adults : 1,
          unit_price_pvp: 0,
          unit_price_cost: 0,
          subtotal_pvp: 0,
          subtotal_cost: 0,
        },
      ]);
    }
  };

  const countSelected = (cat: string) => (selectionsMap[cat] || []).length;
  const totalItems = selectedItems.length;
  const canProceed = mainCount > 0;

  const handleNext = () => {
    if (!canProceed) return;
    setStepData('step3', { selected_items: selectedItems });
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
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Personaliza tu Menú
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Selecciona los platos para tu evento
        </p>
        <div className="mt-2 inline-flex items-center gap-2 text-xs text-stone-400">
          <span>{totalItems} platos seleccionados</span>
          <span className="text-stone-300">·</span>
          <span>Máximo {MAIN_MAX} platos principales (carne/pescado/arroz)</span>
        </div>
      </div>

      {mainCount === 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <p className="text-amber-700 text-sm">
            Selecciona al menos <strong>1 plato principal</strong> (carne, pescado o arroz)
          </p>
        </div>
      )}

      {mainCount > MAIN_MAX && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-center">
          <p className="text-red-700 text-sm">
            Has seleccionado {mainCount} platos principales. Máximo {MAIN_MAX}.
          </p>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-2">
        {Object.entries(CATALOG_ITEMS).map(([cat, items]) => {
          const count = countSelected(cat);
          const isExpanded = expandedCat === cat;
          const isMain = MAIN_COURSES.includes(cat);

          return (
            <div key={cat} className="rounded-xl border border-stone-200 bg-white overflow-hidden transition-all">
              <button
                className="w-full flex items-center justify-between p-4 text-left hover:bg-stone-50 transition-colors"
                onClick={() => setExpandedCat(isExpanded ? null : cat)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    {catLabel(cat)} {isMain ? `(elige ${MAIN_MAX})` : ''}
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
                      const atLimit = !isSelected && isMain && mainsAtMax;
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
                            <span className="flex-1">{item}</span>
                            {isSelected && isMain && (
                              <span className="text-xs text-stone-400 flex-shrink-0 ml-2">{adults} raciones</span>
                            )}
                            {isSelected && !isMain && !NO_QTY.includes(cat) && (
                              <span className="text-xs text-stone-400 flex-shrink-0 ml-2">1 ración</span>
                            )}
                          </button>
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
            Resumen ({totalItems} platos)
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {selectedItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-stone-700">{item.name}</span>
                <span className="text-stone-400 text-xs ml-2 flex-shrink-0">
                  {item.category}
                  {MAIN_COURSES.includes(item.category) ? ` · ${item.quantity} raciones` : ''}
                </span>
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
