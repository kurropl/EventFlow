'use client';
/**
 * J.Benitez — Wizard Step 3: Personalización de Platos
 *
 * Dos modos de entrada:
 * 1. Sin menú seleccionado → catálogo vacío, usuario elige desde cero
 * 2. Con menú seleccionado → catálogo con los platos del menú pre-marcados + extras no encontrados
 *
 * - Aperitivos y complementos: solo ON/OFF (sin cantidad individual)
 * - Plato principal (carne/pescado/arroz): máximo 2 TOTAL entre los tres
 * - Cada plato principal = 1 ración por comensal
 * - Sorbete, postre, bebida: ON/OFF (van incluidos con el menú)
 */

import { useState, useMemo } from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_ITEMS } from '@/data/menus';

// Categorías que se consideran "plato principal"
const MAIN_COURSES = ['carne', 'pescado', 'arroz'];
const MAIN_MAX = 2;

// Categorías que NO necesitan cantidad (van incluidas en menú)
const NO_QTY = ['aperitivo-frio', 'aperitivo-caliente', 'compartir-mesa', 'sorbete', 'postre', 'bebida', 'complemento'];

const CAT_LABELS: Record<string, string> = {
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

function initSelectedItems(step3Items: any[], adults: number): any[] {
  if (!step3Items || step3Items.length === 0) return [];

  // Build a set of catalog item names for fast lookup
  const allCatalogNames = new Set<string>();
  Object.values(CATALOG_ITEMS).forEach(items => items.forEach(name => allCatalogNames.add(name)));

  // Separate: items found in catalog vs extras from menu
  const catalogMatches: any[] = [];
  const extras: any[] = [];

  step3Items.forEach((item: any) => {
    if (allCatalogNames.has(item.name)) {
      // This item exists in the catalog — will be shown as checked in the catalog section
      catalogMatches.push(item);
    } else {
      // This item is from the proposed menu but not in the catalog — show as extra
      extras.push({
        ...item,
        quantity: item.quantity || adults,
      });
    }
  });

  return catalogMatches;
}

export default function WizardStep3() {
  const { step1, step2, step3, setStepData, nextStep, prevStep } = useWizardStore();
  const adults = step1?.guest_count || 0;

  // Items from the proposed menu that aren't in the catalog
  const [extraItems, setExtraItems] = useState<any[]>(() => {
    if (!step3?.selected_items || step3.selected_items.length === 0) return [];
    const allCatalogNames = new Set<string>();
    Object.values(CATALOG_ITEMS).forEach(items => items.forEach(name => allCatalogNames.add(name)));
    return step3.selected_items.filter((item: any) => !allCatalogNames.has(item.name));
  });

  // Initialize selected items from catalog
  const [selectedCatalog, setSelectedCatalog] = useState<Record<string, Set<string>>>(() => {
    const initial: Record<string, Set<string>> = {};
    Object.keys(CATALOG_ITEMS).forEach(cat => { initial[cat] = new Set(); });

    if (step3?.selected_items && step3.selected_items.length > 0) {
      step3.selected_items.forEach((item: any) => {
        if (CATALOG_ITEMS[item.category]?.includes(item.name)) {
          if (!initial[item.category]) initial[item.category] = new Set();
          initial[item.category].add(item.name);
        }
      });
    }
    return initial;
  });

  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Nombres seleccionados por categoría (from catalog)
  const catalogSelectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.entries(selectedCatalog).forEach(([cat, set]) => {
      if (set.size > 0) map[cat] = Array.from(set);
    });
    return map;
  }, [selectedCatalog]);

  // Total de platos principales seleccionados
  const mainCount = MAIN_COURSES.reduce((sum, cat) => sum + ((catalogSelectionsMap[cat] || []).length), 0);
  const mainsAtMax = mainCount >= MAIN_MAX;

  // Has any pre-selected items from a proposed menu?
  const hasMenuBase = extraItems.length > 0 || Object.values(selectedCatalog).some(s => s.size > 0);

  const toggleCatalogItem = (category: string, item: string) => {
    setSelectedCatalog(prev => {
      const next = { ...prev };
      const set = new Set(next[category] || []);
      if (set.has(item)) {
        set.delete(item);
      } else {
        const isMain = MAIN_COURSES.includes(category);
        if (isMain && mainsAtMax) return prev;
        set.add(item);
      }
      next[category] = set;
      return next;
    });
  };

  const toggleExtraItem = (index: number) => {
    setExtraItems(prev => prev.filter((_, i) => i !== index));
  };

  const addExtraItem = (category: string, itemName: string) => {
    if (!itemName.trim()) return;
    const isMain = MAIN_COURSES.includes(category);
    const onePerGuest = isMain || category === 'compartir-mesa';
    setExtraItems(prev => [
      ...prev,
      {
        item_id: itemName,
        name: itemName,
        category,
        quantity: onePerGuest ? adults : 1,
        unit_price_pvp: 0,
        unit_price_cost: 0,
        subtotal_pvp: 0,
        subtotal_cost: 0,
      },
    ]);
  };

  const countSelected = (cat: string) => (catalogSelectionsMap[cat] || []).length;
  const totalCatalogItems = Object.values(selectedCatalog).reduce((sum, set) => sum + set.size, 0);
  const totalItems = totalCatalogItems + extraItems.length;
  const canProceed = mainCount > 0;

  const handleNext = () => {
    if (!canProceed) return;

    // Merge catalog selections + extras into a single array
    const allItems: any[] = [];

    // Catalog items
    Object.entries(selectedCatalog).forEach(([cat, set]) => {
      set.forEach(itemName => {
        const isMain = MAIN_COURSES.includes(cat);
        const onePerGuest = isMain || cat === 'compartir-mesa';
        allItems.push({
          item_id: itemName,
          name: itemName,
          category: cat,
          quantity: onePerGuest ? adults : 1,
          unit_price_pvp: 0,
          unit_price_cost: 0,
          subtotal_pvp: 0,
          subtotal_cost: 0,
        });
      });
    });

    // Extra items (from proposed menu not in catalog)
    allItems.push(...extraItems);

    setStepData('step3', { selected_items: allItems });
    nextStep();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Personaliza tu Menú
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          {hasMenuBase
            ? 'Menú base cargado — ajusta los platos a tu gusto'
            : 'Selecciona los platos para tu evento'
          }
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

      {/* Extra items from proposed menu (not in catalog) */}
      {extraItems.length > 0 && (
        <div className="rounded-xl border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[#C9A84C] mb-3">
            Platos del menú base ({extraItems.length})
          </h4>
          <p className="text-xs text-stone-400 mb-3">
            Estos platos del menú seleccionado no están en el catálogo estándar
          </p>
          <div className="space-y-1.5">
            {extraItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-[#C9A84C]" />
                  <span className="text-stone-700">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-stone-400 text-xs">{CAT_LABELS[item.category] || item.category}</span>
                  <button
                    onClick={() => toggleExtraItem(i)}
                    className="text-stone-300 hover:text-red-400 transition-colors p-0.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog categories */}
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
                    {CAT_LABELS[cat] || cat} {isMain ? `(elige ${MAIN_MAX})` : ''}
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
                <div className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-1">
                    {items.map((item) => {
                      const isSelected = selectedCatalog[cat]?.has(item) || false;
                      const atLimit = !isSelected && isMain && mainsAtMax;
                      return (
                        <div key={item} className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCatalogItem(cat, item)}
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
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected items summary */}
      {totalItems > 0 && (
        <div className="rounded-xl border border-stone-200 p-4 bg-[#FAF8F5]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
            Resumen ({totalItems} platos)
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {Object.entries(selectedCatalog).map(([cat, set]) =>
              Array.from(set).map(item => (
                <div key={`${cat}-${item}`} className="flex items-center justify-between text-sm">
                  <span className="text-stone-700">{item}</span>
                  <span className="text-stone-400 text-xs ml-2 flex-shrink-0">
                    {CAT_LABELS[cat] || cat}
                    {MAIN_COURSES.includes(cat) ? ` · ${adults} raciones` : ''}
                  </span>
                </div>
              ))
            )}
            {extraItems.map((item, i) => (
              <div key={`extra-${i}`} className="flex items-center justify-between text-sm">
                <span className="text-stone-700">{item.name}</span>
                <span className="text-stone-400 text-xs ml-2 flex-shrink-0">
                  {CAT_LABELS[item.category] || item.category} · menú base
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
    </div>
  );
}
