'use client';
/**
 * J.Benitez — Wizard Step 3: Personalización de Platos
 *
 * Dos modos de entrada:
 * 1. Sin menú seleccionado → catálogo vacío, usuario elige desde cero
 * 2. Con menú seleccionado → platos del menú pre-marcados dentro de cada categoría
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

function getDishCategory(dish: string): string {
  const d = dish.toLowerCase();
  if (d.includes('arroz') || d.includes('paella') || d.includes('fideua')) return 'arroz';
  if (d.includes('carne') || d.includes('pollo') || d.includes('ternera') || d.includes('cordero') || d.includes('cerdo') || d.includes('carrill') || d.includes('solomillo') || d.includes('hamburguesa') || d.includes('pechuga') || d.includes('mini hamburguesa')) return 'carne';
  if (d.includes('pescado') || d.includes('lenguado') || d.includes('merluza') || d.includes('bacalao') || d.includes('gamb') || d.includes('langostino') || d.includes('pulpo') || d.includes('merluz') || d.includes('rap') || d.includes('lubina') || d.includes('rodaballo')) return 'pescado';
  if (d.includes('sorbete') || d.includes('helado') || d.includes('granizado')) return 'sorbete';
  if (d.includes('postre') || d.includes('pastelito') || d.includes('tarta') || d.includes('brownie') || d.includes('crema') || d.includes('flan') || d.includes('mousse') || d.includes('lemon pie') || d.includes('torrija') || d.includes('pantera') || d.includes('surtido')) return 'postre';
  if (d.includes('bebida') || d.includes('vino') || d.includes('cerveza') || d.includes('cava') || d.includes('refresc') || d.includes('zum') || d.includes('agua') || d.includes('manzanilla') || d.includes('verdejo') || d.includes('frizzant')) return 'bebida';
  if (d.includes('canape') || d.includes('tosta') || d.includes('mini toast') || d.includes('croqueta') || d.includes('empanadilla') || d.includes('pincho') || d.includes('volovane') || d.includes('quiche') || d.includes('chupito') || d.includes('oliva') || d.includes('ensaladilla') || d.includes('hummu') || d.includes('aguacate') || d.includes('atun')) return 'aperitivo-caliente';
  return 'aperitivo-frio';
}

/**
 * Split proposed menu items into catalog matches (by exact name) and extras (by category).
 * Returns extras grouped by category for display inside each accordion.
 */
function classifyMenuItems(step3Items: any[]): {
  catalogNames: Record<string, Set<string>>;
  extrasByCategory: Record<string, { name: string; isMain: boolean; enabled: boolean }[]>;
} {
  if (!step3Items || step3Items.length === 0) {
    return { catalogNames: {}, extrasByCategory: {} };
  }

  const allCatalogNames = new Set<string>();
  Object.values(CATALOG_ITEMS).forEach(items => items.forEach(name => allCatalogNames.add(name)));

  const catalogNames: Record<string, Set<string>> = {};
  const extrasByCategory: Record<string, { name: string; isMain: boolean; enabled: boolean }[]> = {};

  step3Items.forEach((item: any) => {
    const cat = item.category || getDishCategory(item.name);
    const isMain = MAIN_COURSES.includes(cat);

    if (allCatalogNames.has(item.name)) {
      // Exact match in catalog → will be checked in the accordion
      if (!catalogNames[cat]) catalogNames[cat] = new Set();
      catalogNames[cat].add(item.name);
    } else {
      // Not in catalog → show as extra within the category accordion
      if (!extrasByCategory[cat]) extrasByCategory[cat] = [];
      extrasByCategory[cat].push({ name: item.name, isMain, enabled: true });
    }
  });

  return { catalogNames, extrasByCategory };
}

export default function WizardStep3() {
  const { step1, step2, step3, setStepData, nextStep, prevStep } = useWizardStore();
  const adults = step1?.guest_count || 0;

  // Classify initial items from the store
  const initial = useMemo(() => classifyMenuItems(step3?.selected_items || []), []);

  // Catalog selections: category → Set of checked item names
  const [selectedCatalog, setSelectedCatalog] = useState<Record<string, Set<string>>>(() => {
    const result: Record<string, Set<string>> = {};
    Object.keys(CATALOG_ITEMS).forEach(cat => { result[cat] = new Set(); });
    Object.entries(initial.catalogNames).forEach(([cat, names]) => {
      result[cat] = new Set(names);
    });
    return result;
  });

  // Extra items (from proposed menu, not in catalog) — grouped by category
  const [extrasByCategory, setExtrasByCategory] = useState<Record<string, { name: string; isMain: boolean; enabled: boolean }[]>>(() => {
    return initial.extrasByCategory;
  });

  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Count selected per category (catalog checks + extras)
  const catalogSelectionsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    Object.entries(selectedCatalog).forEach(([cat, set]) => {
      if (set.size > 0) map[cat] = Array.from(set);
    });
    return map;
  }, [selectedCatalog]);

  const countSelected = (cat: string) => {
    const catalogCount = (catalogSelectionsMap[cat] || []).length;
    const extrasCount = (extrasByCategory[cat] || []).length;
    return catalogCount + extrasCount;
  };

  // Catalog main courses (for the limit check)
  const catalogMainCount = MAIN_COURSES.reduce((sum, cat) => sum + ((catalogSelectionsMap[cat] || []).length), 0);
  const mainsAtMax = catalogMainCount >= MAIN_MAX;

  // Extras that are main courses (from proposed menu)
  const extraMainCount = MAIN_COURSES.reduce((sum, cat) => {
    const extras = extrasByCategory[cat] || [];
    return sum + extras.filter(e => e.isMain && e.enabled).length;
  }, 0);

  // Total main courses for proceed check (catalog + extras)
  const mainCount = catalogMainCount + extraMainCount;

  const hasMenuBase = Object.keys(extrasByCategory).length > 0 || Object.values(initial.catalogNames).some(s => s.size > 0);

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

  const toggleExtraItem = (category: string, index: number) => {
    setExtrasByCategory(prev => {
      const next = { ...prev };
      const items = [...(next[category] || [])];
      items[index] = { ...items[index], enabled: !items[index].enabled };
      next[category] = items;
      return next;
    });
  };

  const totalCatalogItems = Object.values(selectedCatalog).reduce((sum, set) => sum + set.size, 0);
  const totalExtras = Object.values(extrasByCategory).reduce((sum, items) => sum + items.filter(e => e.enabled).length, 0);
  const totalItems = totalCatalogItems + totalExtras;
  const canProceed = mainCount > 0;

  const handleNext = () => {
    if (!canProceed) return;

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

    // Extra items (from proposed menu, not in catalog) — only enabled ones
    Object.entries(extrasByCategory).forEach(([cat, items]) => {
      items.filter(item => item.enabled).forEach(item => {
        allItems.push({
          item_id: item.name,
          name: item.name,
          category: cat,
          quantity: item.isMain ? adults : 1,
          unit_price_pvp: 0,
          unit_price_cost: 0,
          subtotal_pvp: 0,
          subtotal_cost: 0,
        });
      });
    });

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

      {/* Categories */}
      <div className="space-y-2">
        {Object.entries(CATALOG_ITEMS).map(([cat, items]) => {
          const count = countSelected(cat);
          const isExpanded = expandedCat === cat;
          const isMain = MAIN_COURSES.includes(cat);
          const extras = extrasByCategory[cat] || [];

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
                    {/* Extra items from menu base (toggleable checkboxes) */}
                    {extras.map((extra, idx) => {
                      const isExtraMain = MAIN_COURSES.includes(cat);
                      return (
                        <div key={`extra-${cat}-${idx}`}>
                          <button
                            onClick={() => toggleExtraItem(cat, idx)}
                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-sm transition-all duration-200 text-left ${
                              extra.enabled
                                ? 'bg-[#C9A84C]/5 border border-[#C9A84C]/15 text-[#1A1A1A] font-medium'
                                : 'text-stone-400 border border-stone-100'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all ${
                              extra.enabled ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-stone-300'
                            }`}>
                              {extra.enabled && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className="flex-1">{extra.name}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                              extra.enabled ? 'bg-[#C9A84C]/15 text-[#C9A84C]' : 'bg-stone-100 text-stone-400'
                            }`}>
                              menú base
                            </span>
                            {isExtraMain && extra.enabled && (
                              <span className="text-xs text-stone-400 flex-shrink-0">{adults} raciones</span>
                            )}
                          </button>
                        </div>
                      );
                    })}

                    {/* Catalog items */}
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

      {/* Single summary at the bottom */}
      {totalItems > 0 && (
        <div className="rounded-xl border border-stone-200 p-4 bg-[#FAF8F5]">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">
            Resumen ({totalItems} platos)
          </h4>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {/* Catalog selections */}
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
            {/* Extra items from menu base */}
            {Object.entries(extrasByCategory).map(([cat, items]) =>
              items.filter(item => item.enabled).map((item, idx) => (
                <div key={`extra-summary-${cat}-${idx}`} className="flex items-center justify-between text-sm">
                  <span className="text-stone-700">{item.name}</span>
                  <span className="text-stone-400 text-xs ml-2 flex-shrink-0">
                    {CAT_LABELS[cat] || cat} · menú base
                  </span>
                </div>
              ))
            )}
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
