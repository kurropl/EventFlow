'use client';
/**
 * EventFlow — Wizard Step 2: Menú Propuesto
 * 
 * DOS OPCIONES CLARAS:
 * 1. Menú Predefinido — elige uno de los menús completos (estilo PDF)
 * 2. Personalizado — construye tu menú plato a plato
 * 
 * REGLA NIÑOS:
 * - Si kids_count > 0: se muestran TODOS los menús (adultos + niños)
 *   El usuario debe elegir al menos 1 adulto + 1 niño
 * - Si kids_count === 0: solo se muestran menús adultos
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS, CATALOG_CATEGORIES, CATALOG_ITEMS } from '@/data/menus';

// Mapeo de sección del menú → categoría del catálogo
const SECTION_TO_CATEGORY: Record<string, string> = {
  'Aperitivos en mesa': 'aperitivo-frio',
  'Aperitivos fríos': 'aperitivo-frio',
  'Aperitivos calientes': 'aperitivo-caliente',
  'En mesa a compartir': 'compartir-mesa',
  'A compartir cada 4': 'compartir-mesa',
  'A compartir': 'compartir-mesa',
  'Plato principal': 'carne', // placeholder
  'Postre y bebida': 'postre',
};

// Mapeo nombre → categoría catálogo (heurístico)
function getDishCategory(dish: string): string {
  const d = dish.toLowerCase();
  if (d.includes('arroz') || d.includes('paella') || d.includes('fideuá')) return 'arroz';
  if (d.includes('carne') || d.includes('pollo') || d.includes('ternera') || d.includes('cordero') || d.includes('cerdo') || d.includes('carrill') || d.includes('solomillo') || d.includes('hamburguesa')) return 'carne';
  if (d.includes('pescado') || d.includes('lenguado') || d.includes('merluza') || d.includes('bacalao') || d.includes('gamb') || d.includes('langostino') || d.includes('pulpo') || d.includes('merluz')) return 'pescado';
  if (d.includes('sorbete') || d.includes('helado') || d.includes('granizado')) return 'sorbete';
  if (d.includes('postre') || d.includes('pastelito') || d.includes('tarta') || d.includes('brownie') || d.includes('crema') || d.includes('flan') || d.includes('mousse')) return 'postre';
  if (d.includes('bebida') || d.includes('vino') || d.includes('cerveza') || d.includes('cava') || d.includes('refresc') || d.includes('zum') || d.includes('agua') || d.includes('manzanilla') || d.includes('verdejo') || d.includes('frizzant')) return 'bebida';
  if (d.includes('canapé') || d.includes('canape') || d.includes('tosta') || d.includes('mini toast') || d.includes('croqueta') || d.includes('empanadilla') || d.includes('pincho') || d.includes('volovane') || d.includes('quiche') || d.includes('chupito') || d.includes('gordita') || d.includes('oliva') || d.includes('patata') || d.includes('pan ') || d.includes('jamón') || d.includes('jamón') || d.includes('queso') || d.includes('lomo') || d.includes('ensaladilla') || d.includes('hummu') || d.includes('aguacate') || d.includes('atún') || d.includes('ventresca') || d.includes('pingá') || d.includes('revuelto') || d.includes('adobo') || d.includes('choco') || d.includes('adobo')) return 'aperitivo-frio';
  if (d.includes('frito') || d.includes('frit') || d.includes('adobo') || d.includes('delici') || d.includes('mini pita') || d.includes('mini de')) return 'aperitivo-caliente';
  return 'carne'; // default
}

export default function WizardStep2() {
  const { step1, step2, setStepData, nextStep, prevStep } = useWizardStore();
  const [selectedMenuId, setSelectedMenuId] = useState<string>(step2?.menu_id || '');
  const [useProposed, setUseProposed] = useState<boolean>(step2?.use_proposed ?? true);

  const kids = step1?.kids_count || 0;

  // Filtrar menús según si hay niños
  const adultMenus = useMemo(() => PROPOSED_MENUS.filter(m => !m.is_kid), []);
  const kidMenus = useMemo(() => PROPOSED_MENUS.filter(m => m.is_kid), []);

  // Validación: si kids > 0, necesita 1 adulto + 1 niño
  const adultSelected = selectedMenuId ? adultMenus.find(m => m.id === selectedMenuId) : null;
  const kidSelected = selectedMenuId ? kidMenus.find(m => m.id === selectedMenuId) : null;
  const hasAdult = !!adultSelected;
  const hasKid = !!kidSelected;
  const kidsValid = kids === 0 || (hasAdult && hasKid);

  // Si kids > 0 y ya tiene ambos, skip a extras
  const canSkipToExtras = kidsValid && hasAdult;

  const handleUseMenu = () => {
    if (!kidsValid) return;
    setStepData('step2', {
      menu_id: selectedMenuId,
      use_proposed: true,
    } as any);
    nextStep(); // va directo a paso 4 (Extras)
  };

  const handleCustomize = () => {
    if (!kidsValid) return;
    // Cargar los platos del menú seleccionado en step3
    const selectedMenu = [...adultMenus, ...kidMenus].find(m => m.id === selectedMenuId);
    if (!selectedMenu) return;

    // Convertir secciones del menú en items del catálogo
    const items: any[] = [];
    for (const section of selectedMenu.sections) {
      const catId = SECTION_TO_CATEGORY[section.section] || 'carne';
      for (const dish of section.items) {
        const catId2 = getDishCategory(dish);
        const catItems = CATALOG_ITEMS[catId2] || [];
        // Buscar item en catálogo por nombre
        const match = catItems.find((c: string) =>
          c.toLowerCase().includes(dish.toLowerCase().split('mini ')[1] || dish.toLowerCase())
        );
        if (match) {
          items.push({
            item_id: match,
            name: dish,
            category: catId2,
            quantity: 1,
          });
        }
      }
    }

    // Si no se encontraron items exactos, cargar al menos placeholders
    // (en producción esto vendría del catálogo real)
    setStepData('step2', {
      menu_id: selectedMenuId,
      use_proposed: false,
    } as any);
    setStepData('step3', {
      selected_items: items.length > 0 ? items : [],
    } as any);
    nextStep();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Elige tu Menú
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          {kids > 0
            ? 'Selecciona un menú para adultos y otro para niños'
            : 'Selecciona un menú predefinido o personaliza el tuyo'
          }
        </p>
      </div>

      {/* Kids menu requirement */}
      {kids > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-xl p-4 border-2 ${
            kidsValid ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {kidsValid ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9.5 16.5H2.5L12 3z" />
              )}
            </svg>
            <div>
              <p className={`text-sm font-semibold ${kidsValid ? 'text-emerald-800' : 'text-amber-800'}`}>
                {kidsValid
                  ? `¡Perfecto! Menú adulto + infantil seleccionados`
                  : `Necesitas 1 menú adulto y 1 menú infantil (${kids} ${kids === 1 ? 'niño' : 'niños'})`
                }
              </p>
              {!kidsValid && (
                <p className="text-xs text-amber-600 mt-1">
                  Adulto: {hasAdult ? '✓' : '○'} | Niño: {hasKid ? '✓' : '○'}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Menu Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...adultMenus, ...kidMenus].map((menu) => {
          const isSelected = selectedMenuId === menu.id;
          const isKid = menu.is_kid;
          return (
            <button
              key={menu.id}
              onClick={() => setSelectedMenuId(menu.id)}
              className={`group relative text-left rounded-2xl border-2 overflow-hidden transition-all duration-200
                ${isSelected
                  ? 'border-amber-600 shadow-lg shadow-amber-100'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
                }`}
            >
              {/* Top accent bar */}
              <div className={`h-2 ${
                isKid ? 'bg-pink-400' : 'bg-amber-500'
              }`} />

              <div className="p-6">
                {/* Menu header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-serif text-xl text-stone-800">{menu.name}</h3>
                    <span className={`inline-block mt-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                      isKid
                        ? 'bg-pink-100 text-pink-700'
                        : menu.tag === 'Premium' || menu.tag === 'Premium +'
                          ? 'bg-amber-100 text-amber-800'
                          : menu.tag === 'Gran Selección'
                            ? 'bg-stone-800 text-white'
                            : 'bg-stone-100 text-stone-600'
                    }`}>
                      {menu.tag}
                      {isKid && ' · Infantil'}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="w-6 h-6 rounded-full bg-amber-600 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Sections preview */}
                <div className="space-y-2">
                  {menu.sections.map((sec, i) => (
                    <div key={i} className="text-sm">
                      <span className="font-semibold text-stone-700">{sec.section}:</span>
                      <span className="text-stone-500 ml-1">{sec.items.length} platos</span>
                    </div>
                  ))}
                </div>

                {/* Total items */}
                <div className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-400">
                  {menu.sections.reduce((sum, s) => sum + s.items.length, 0)} platos en total
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 pt-4">
        <button
          onClick={prevStep}
          className="px-6 py-4 rounded-xl font-semibold text-stone-600 border-2 border-stone-200 hover:border-stone-300 transition-all"
        >
          ← Atrás
        </button>

        {canSkipToExtras ? (
          <button
            onClick={handleUseMenu}
            className="flex-1 py-4 rounded-xl font-semibold text-base bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg transition-all"
          >
            ✓ Usar este menú →
          </button>
        ) : (
          <button
            onClick={handleCustomize}
            disabled={!kidsValid}
            className={`flex-1 py-4 rounded-xl font-semibold text-base transition-all
              ${kidsValid
                ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
          >
            Personalizar Menú →
          </button>
        )}
      </div>
    </motion.div>
  );
}
