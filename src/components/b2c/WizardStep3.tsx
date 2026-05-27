'use client';
/**
 * J.Benitez — Wizard Step 3: Personalización de Platos
 * 
 * Diseño premium con selección interactiva de platos por categoría.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS, CATALOG_CATEGORIES } from '@/data/menus';
import { PROPOSED_MENUS } from '@/data/menus';
import type { SelectedItem } from '@/types/specs';

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
  menu.sections.forEach(section => {
    section.items.forEach(item => platos.push(item));
  });
  return platos;
}

function getDishCategory(dish: string): string {
  for (const [category, items] of Object.entries(CATALOG_ITEMS)) {
    if (items.some(i => i === dish)) return category;
  }
  return 'aperitivo-frio';
}

export default function WizardStep3() {
  const { step1, step2, step3, setStepData, nextStep, prevStep } = useWizardStore();
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const isPredefined = !!step2?.menu_id;
  const predefinedPlatos = step2?.menu_id ? getMenuPlatos(step2.menu_id) : [];

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

  const handleProceed = () => {
    if (!canProceed()) return;
    
    // Convert selections to the format expected by the store
    const selectedItems: SelectedItem[] = [];
    
    // Add predefined items if using a menu
    if (isPredefined) {
      predefinedPlatos.forEach(plato => {
        const cat = getDishCategory(plato);
        selectedItems.push({
          item_id: plato,
          name: plato,
          category: cat as SelectedItem['category'],
          quantity: 1,
          unit_price_pvp: 0,
          unit_price_cost: 0,
          subtotal_pvp: 0,
          subtotal_cost: 0,
        });
      });
    } else {
      // Add custom selections
      Object.entries(selections).forEach(([category, items]) => {
        items.forEach(itemName => {
          selectedItems.push({
            item_id: itemName,
            name: itemName,
            category: category as SelectedItem['category'],
            quantity: 1,
            unit_price_pvp: 0,
            unit_price_cost: 0,
            subtotal_pvp: 0,
            subtotal_cost: 0,
          });
        });
      });
    }
    
    setStepData('step3', { selected_items: selectedItems });
    nextStep();
  };

  const filteredItems = (catId: string) => {
    const items = CATALOG_ITEMS[catId] || [];
    if (!searchTerm) return items;
    return items.filter(item => item.toLowerCase().includes(searchTerm.toLowerCase()));
  };

  const getCategoryName = (catId: string) => {
    const cat = CATALOG_CATEGORIES.find(c => c.id === catId);
    return cat?.label || catId;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Personaliza tu Menú
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          {isPredefined 
            ? 'Tu menú ha sido preconfigurado. Puedes añadir o quitar platos.'
            : 'Selecciona al menos un plato por categoría.'
          }
        </p>
      </div>

      {/* Search */}
      <div className="max-w-md mx-auto">
        <input
          type="text"
          placeholder="Buscar plato..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors text-stone-800 text-base"
        />
      </div>

      {/* Categories */}
      <div className="space-y-6">
        {CATALOG_CATEGORIES.map((category) => {
          const items = filteredItems(category.id);
          const count = (selections[category.id] || []).length;
          const minRequired = getMinRequired(category.id);
          const isComplete = isCategoryComplete(category.id);

          if (items.length === 0) return null;

          return (
            <div
              key={category.id}
              className={`rounded-xl border-2 p-4 transition-all ${
                isComplete
                  ? 'border-green-500 bg-green-50'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span
                    className="w-6 h-6 rounded text-xs flex items-center justify-center font-bold"
                    style={{ background: '#C9A84C', color: '#fff' }}
                  >
                    {category.id.split('-')[0].toUpperCase()}
                  </span>
                  <h3 className="font-semibold text-stone-800">
                    {getCategoryName(category.id)}
                  </h3>
                  <span className="text-sm text-stone-500">
                    {count}/{minRequired} seleccionados
                  </span>
                </div>
                {isComplete && (
                  <span className="text-green-600 text-sm font-medium">✓ Completo</span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {items.map((item) => {
                  const isSelected = (selections[category.id] || []).includes(item);
                  return (
                    <button
                      key={item}
                      onClick={() => toggleSelection(category.id, item)}
                      className={`p-3 rounded-lg text-left transition-all ${
                        isSelected
                          ? 'bg-[#C9A84C] text-white border-2 border-[#C9A84C]'
                          : 'bg-stone-50 hover:bg-stone-100 border-2 border-transparent'
                      }`}
                    >
                      <div className="font-medium text-sm">{item}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={prevStep}
          className="flex-1 py-4 rounded-xl font-semibold text-base transition-all duration-200 border-2 border-stone-200 text-stone-600 hover:bg-stone-50"
        >
          ← Atrás
        </button>
        <button
          onClick={handleProceed}
          disabled={!canProceed()}
          className="flex-1 py-4 rounded-xl font-semibold text-base transition-all duration-200 bg-[#C9A84C] text-white hover:bg-[#A88A3A] disabled:bg-stone-200 disabled:text-stone-400 disabled:cursor-not-allowed"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}