'use client';
/**
 * EventFlow — Wizard Step 3: Personalización de Platos
 * 
 * Dos modos:
 * 1. MENÚ PREDEFINIDO: se cargan automáticamente los platos del menú elegido.
 *    El usuario puede modificarlos (añadir/quitar). Puede saltar a Extras tal cual.
 * 2. PERSONALIZADO: el usuario debe elegir platos de cada categoría cumpliendo mínimos.
 * 
 * NO se obliga a completar todas las categorías si se usa un menú predefinido.
 */

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { CATALOG_CATEGORIES, CATALOG_ITEMS, ProposedMenu } from '@/data/menus';
import { PROPOSED_MENUS } from '@/data/menus';

// Mínimos para modo personalizado
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

// Map menu_id → platos que incluye (por nombre)
function getMenuPlatos(menuId: string): string[] {
  const menu = PROPOSED_MENUS.find((m) => m.id === menuId);
  if (!menu) return [];
  const platos: string[] = [];
  for (const section of menu.sections) {
    platos.push(...section.items);
  }
  return platos;
}

// Mapear nombre de plato del menú a categoría del catálogo
function getDishCategory(dishName: string): string {
  const lower = dishName.toLowerCase();
  
  // Buscar en cada categoría del catálogo
  for (const [catId, items] of Object.entries(CATALOG_ITEMS)) {
    for (const item of items) {
      if (item.toLowerCase() === lower || 
          item.toLowerCase().includes(lower.substring(0, 15)) ||
          lower.includes(item.toLowerCase().substring(0, 15))) {
        return catId;
      }
    }
  }
  
  // Fallback: heurística por nombre
  if (lower.includes('carrillera') || lower.includes('cordero') || lower.includes('pato') || 
      lower.includes('solomillo') || lower.includes('ciervo') || lower.includes('presa') ||
      lower.includes('lana') || lower.includes('lasaña')) return 'carne';
  if (lower.includes('lubina') || lower.includes('rodaballo') || lower.includes('ventresca') ||
      lower.includes('bacalao') || lower.includes('merluza') || lower.includes('rodaja')) return 'pescado';
  if (lower.includes('arroz')) return 'arroz';
  if (lower.includes('sorbete')) return 'sorbete';
  if (lower.includes('postre') || lower.includes('tarta') || lower.includes('pie') || 
      lower.includes('helado') || lower.includes('chocolate') || lower.includes('torrija') ||
      lower.includes('paste') || lower.includes('pantera')) return 'postre';
  if (lower.includes('cerveza') || lower.includes('vino') || lower.includes('cava') ||
      lower.includes('refresc') || lower.includes('agua') || lower.includes('manzanilla') ||
      lower.includes('verdejo') || lower.includes('frizzante')) return 'bebida';
  if (lower.includes('gordita') || lower.includes('jamón') || lower.includes('queso') ||
      lower.includes('pan individual') || lower.includes('gamba') || lower.includes('frito') ||
      lower.includes('chacina') || lower.includes('gazpacho') || lower.includes('tosta') ||
      lower.includes('brioche') || lower.includes('tartar') || lower.includes('carpaccio') ||
      lower.includes('ensaladilla') || lower.includes('ensalada') || lower.includes('mini ensalada') ||
      lower.includes('salpicón') || lower.includes('navaja') || lower.includes('gilda') ||
      lower.includes('ostra') || lower.includes('oliva') || lower.includes('patata') ||
      lower.includes('patas') || lower.includes('croqueta') || lower.includes('empanadilla') ||
      lower.includes('empana') || lower.includes('hot dog') || lower.includes('pita') ||
      lower.includes('bocadillo') || lower.includes('bao') || lower.includes('alita') ||
      lower.includes('atún') || lower.includes('vieira') || lower.includes('lubina') ||
      lower.includes('choco') || lower.includes('alcachofa') || lower.includes('calamar') ||
      lower.includes('marmitaco') || lower.includes('brocheta')) return 'aperitivo-caliente';
  if (lower.includes('gordita') || lower.includes('jamón') || lower.includes('queso') ||
      lower.includes('pan') || lower.includes('gamba') || lower.includes('frito') ||
      lower.includes('chacina') || lower.includes('gazpacho') || lower.includes('tosta') ||
      lower.includes('brioche') || lower.includes('tartar') || lower.includes('carpaccio') ||
      lower.includes('ensaladilla') || lower.includes('ensalada') || lower.includes('mini ensalada') ||
      lower.includes('salpicón') || lower.includes('navaja') || lower.includes('gilda') ||
      lower.includes('ostra') || lower.includes('oliva')) return 'aperitivo-frio';
  if (lower.includes('canelón') || lower.includes('lingote') || lower.includes('tartar de tomate') ||
      lower.includes('canelón de calabacín') || lower.includes('berenjena') || 
      lower.includes('espárrago') || lower.includes('huevos rotos') || lower.includes('pulpo') ||
      lower.includes('mariscada')) return 'compartir-mesa';
  
  return 'complemento'; // fallback
}

export default function WizardStep3() {
  const { step3, step2, setStepData, nextStep } = useWizardStore();
  const [activeCategory, setActiveCategory] = useState(CATALOG_CATEGORIES[0].id);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [showValidationWarning, setShowValidationWarning] = useState(false);

  // Determine if using proposed menu or custom
  const isProposed = step2?.use_proposed === true;
  const menuId = step2?.menu_id || null;
  const selectedMenuData = PROPOSED_MENUS.find((m) => m.id === menuId);

  // Load menu platos when proposed menu is selected
  useEffect(() => {
    if (isProposed && menuId) {
      const platos = getMenuPlatos(menuId);
      setSelectedItems(platos);
    } else if (!isProposed) {
      // Load from store for custom mode
      const existing = (step3 as any)?.selected_items?.map((si: { item_id: string }) => si.item_id) || [];
      setSelectedItems(existing);
    }
  }, [isProposed, menuId, step3]);

  // Save to store whenever selectedItems changes
  useEffect(() => {
    if (selectedItems.length > 0 || !isProposed) {
      setStepData('step3', { selected_items: selectedItems.map((id) => ({
        item_id: id,
        name: id,
        category: getDishCategory(id),
        quantity: 1,
      })) } as any);
    }
  }, [selectedItems, isProposed]);

  const toggleItem = (name: string) => {
    setSelectedItems((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
    setShowValidationWarning(false);
  };

  // Check if all required categories are complete (custom mode only)
  const allCategoriesComplete = useMemo(() => {
    if (isProposed) return true; // proposed menu: always complete
    return CATALOG_CATEGORIES.every((cat) => {
      const min = DEFAULT_MINIMUMS[cat.id] || 0;
      if (min === 0) return true;
      const count = selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length;
      return count >= min;
    });
  }, [selectedItems, isProposed]);

  // Get incomplete categories (custom mode only)
  const incompleteCategories = useMemo(() => {
    if (isProposed) return [];
    return CATALOG_CATEGORIES.filter((cat) => {
      const min = DEFAULT_MINIMUMS[cat.id] || 0;
      if (min === 0) return false;
      const count = selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length;
      return count < min;
    });
  }, [selectedItems, isProposed]);

  const handleNext = () => {
    if (!isProposed && !allCategoriesComplete) {
      if (incompleteCategories.length > 0) {
        setActiveCategory(incompleteCategories[0].id);
      }
      setShowValidationWarning(true);
      setTimeout(() => setShowValidationWarning(false), 4000);
      return;
    }
    nextStep();
  };

  const handleSkip = () => {
    setSkipConfirmation(true);
  };

  const confirmSkip = () => {
    setSkipConfirmation(false);
    nextStep();
  };

  const cancelSkip = () => {
    setSkipConfirmation(false);
  };

  const currentItems = CATALOG_ITEMS[activeCategory] || [];
  const currentCategory = CATALOG_CATEGORIES.find((c) => c.id === activeCategory);
  const minSelect = DEFAULT_MINIMUMS[activeCategory] || currentCategory?.minSelect || 0;
  const currentSelected = selectedItems.filter((id) => CATALOG_ITEMS[activeCategory]?.includes(id)).length;
  const isComplete = minSelect === 0 || currentSelected >= minSelect;

  // Total items
  const totalSelected = selectedItems.length;

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
          {isProposed ? 'Personaliza tu Menú' : 'Elige tus Platos'}
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          {isProposed
            ? `Menú ${selectedMenuData?.name || ''} (${selectedMenuData?.tag || ''}) — ajusta los platos según tu gusto. Puedes saltar si te gusta tal cual.`
            : 'Selecciona los platos de cada categoría. Debes cumplir el mínimo antes de continuar.'
          }
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
                Necesitas completar todas las categorías marcadas en rojo.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Skip button (only for proposed menu) */}
      {isProposed && (
        <div className="flex justify-end">
          <button
            onClick={handleSkip}
            className="text-sm text-amber-700 hover:text-amber-900 font-medium underline underline-offset-2"
          >
            Saltar personalización →
          </button>
        </div>
      )}

      {/* Skip confirmation modal */}
      {skipConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          >
            <h3 className="font-serif text-xl text-stone-800 mb-2">¿Saltar personalización?</h3>
            <p className="text-sm text-stone-500 mb-4">
              Usarás el menú {selectedMenuData?.name || ''} tal cual. Podrás modificarlo más adelante.
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelSkip}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 transition-colors"
              >
                Seguir editando
              </button>
              <button
                onClick={confirmSkip}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
              >
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Menu info (if proposed) */}
      {isProposed && selectedMenuData && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span className="text-sm font-semibold text-amber-800">
              Menú {selectedMenuData.name} ({selectedMenuData.tag})
            </span>
          </div>
          <p className="text-xs text-amber-700">
            Platos incluidos: {selectedMenuData.sections.map(s => s.section).join(' · ')}
          </p>
        </div>
      )}

      {/* Current category status */}
      <div className={`rounded-xl p-4 border-2 transition-colors ${
        isComplete ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isComplete ? 'bg-green-500' : 'bg-amber-500'}`} />
            <span className={`text-sm font-semibold ${isComplete ? 'text-green-800' : 'text-amber-800'}`}>
              {isComplete ? '✓ Categoría completa' : `Faltan ${Math.max(0, minSelect - currentSelected)} platos`}
            </span>
          </div>
          <span className="text-sm text-stone-500">
            {currentSelected} / {minSelect || '∞'} seleccionados
          </span>
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {CATALOG_CATEGORIES.map((cat) => {
          const count = selectedItems.filter((id) => CATALOG_ITEMS[cat.id]?.includes(id)).length;
          const min = DEFAULT_MINIMUMS[cat.id] || 0;
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

      {/* Summary bar */}
      <div className="rounded-xl p-4 bg-white border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-700">
            {isProposed ? 'Platos del menú' : 'Total seleccionados'}
          </span>
          <span className="text-lg font-bold text-amber-700">{totalSelected} platos</span>
        </div>
      </div>

      {/* Continue button */}
      <button
        onClick={handleNext}
        disabled={!allCategoriesComplete && !isProposed}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-200
          ${(allCategoriesComplete || isProposed)
            ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
      >
        {isProposed ? 'Sugerencias →' : allCategoriesComplete ? 'Sugerencias →' : `Completa el menú (${incompleteCategories.length} pendiente${incompleteCategories.length > 1 ? 's' : ''})`}
      </button>
    </motion.div>
  );
}
