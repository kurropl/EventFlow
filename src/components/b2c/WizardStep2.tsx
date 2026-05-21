'use client';
/**
 * EventFlow — Wizard Step 2: Menú Propuesto
 * 
 * Diseño visual original (tarjetas expandibles con secciones).
 * Control de niños: si kids_count > 0, se selecciona menú adulto + infantil.
 * 
 * DOS ACCIONES:
 * - "Usar este menú" → salta directo a Extras
 * - "Personalizar Menú" → va a Step 3 con los platos del menú cargados
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS, CATALOG_CATEGORIES, CATALOG_ITEMS } from '@/data/menus';

// Mapeo nombre → categoría catálogo (heurístico)
function getDishCategory(dish: string): string {
  const d = dish.toLowerCase();
  if (d.includes('arroz') || d.includes('paella') || d.includes('fideuá')) return 'arroz';
  if (d.includes('carne') || d.includes('pollo') || d.includes('ternera') || d.includes('cordero') || d.includes('cerdo') || d.includes('carrill') || d.includes('solomillo') || d.includes('hamburguesa') || d.includes('pechuga') || d.includes('mini hamburguesa')) return 'carne';
  if (d.includes('pescado') || d.includes('lenguado') || d.includes('merluza') || d.includes('bacalao') || d.includes('gamb') || d.includes('langostino') || d.includes('pulpo') || d.includes('merluz') || d.includes('rap') || d.includes('lubina') || d.includes('rodaballo') || d.includes('ventresca')) return 'pescado';
  if (d.includes('sorbete') || d.includes('helado') || d.includes('granizado')) return 'sorbete';
  if (d.includes('postre') || d.includes('pastelito') || d.includes('tarta') || d.includes('brownie') || d.includes('crema') || d.includes('flan') || d.includes('mousse') || d.includes('lemon pie') || d.includes('torrija') || d.includes('pantera') || d.includes('surtido')) return 'postre';
  if (d.includes('bebida') || d.includes('vino') || d.includes('cerveza') || d.includes('cava') || d.includes('refresc') || d.includes('zum') || d.includes('agua') || d.includes('manzanilla') || d.includes('verdejo') || d.includes('frizzant')) return 'bebida';
  if (d.includes('canapé') || d.includes('canape') || d.includes('tosta') || d.includes('mini toast') || d.includes('croqueta') || d.includes('empanadilla') || d.includes('pincho') || d.includes('volovane') || d.includes('quiche') || d.includes('chupito') || d.includes('gordita') || d.includes('oliva') || d.includes('patata') || d.includes('pan ') || d.includes('jamón') || d.includes('queso') || d.includes('lomo') || d.includes('ensaladilla') || d.includes('hummu') || d.includes('aguacate') || d.includes('atún') || d.includes('ventresca') || d.includes('pingá') || d.includes('revuelto') || d.includes('adobo') || d.includes('choco') || d.includes('mini pita') || d.includes('mini de') || d.includes('mini hot dog') || d.includes('bao') || d.includes('alita') || d.includes('brocheta') || d.includes('empana')) return 'aperitivo-caliente';
  return 'aperitivo-frio';
}

const TAG_STYLES: Record<string, string> = {
  'Recomendado': 'bg-amber-100 text-amber-800',
  'Premium': 'bg-stone-800 text-white',
  'Premium +': 'bg-stone-800 text-white',
  'Gran Selección': 'bg-amber-100 text-amber-800',
  'Infantil': 'bg-pink-100 text-pink-700',
  'Esencial': 'bg-stone-100 text-stone-600',
  'Completo': 'bg-amber-100 text-amber-800',
  'Canapés': 'bg-purple-100 text-purple-700',
};

export default function WizardStep2() {
  const { step1, step2, setStepData, nextStep, prevStep } = useWizardStore();
  const [selectedAdultId, setSelectedAdultId] = useState<string>(step2?.menu_id || '');
  const [selectedKidId, setSelectedKidId] = useState<string>(step2?.kid_menu_id || '');
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  const kids = step1?.kids_count || 0;

  // Filtrar menús
  const adultMenus = useMemo(() => PROPOSED_MENUS.filter(m => !m.is_kid), []);
  const kidMenus = useMemo(() => PROPOSED_MENUS.filter(m => m.is_kid), []);

  // Validación: si kids > 0, necesita 1 adulto + 1 niño
  const hasAdult = !!selectedAdultId;
  const hasKid = !!selectedKidId;
  const kidsValid = kids === 0 || (hasAdult && hasKid);
  const canUseMenu = kidsValid && (hasAdult || !kids);

  // Sync store when selection changes
  useEffect(() => {
    setStepData('step2', {
      menu_id: selectedAdultId,
      kid_menu_id: selectedKidId,
      use_proposed: true,
    } as any);
  }, [selectedAdultId, selectedKidId]);

  const handleUseMenu = () => {
    if (!canUseMenu) return;
    setStepData('step2', {
      menu_id: selectedAdultId,
      kid_menu_id: selectedKidId,
      use_proposed: true,
    } as any);
    // Skip step 3 (personalización) → go to step 4 (Extras)
    nextStep();
    nextStep();
  };

  const handleCustomize = () => {
    if (!canUseMenu) return;
    const selectedMenu = [...adultMenus, ...kidMenus].find(m => m.id === (selectedAdultId || selectedKidId));
    if (!selectedMenu) return;

    // Convertir secciones del menú en items del catálogo
    const items: any[] = [];
    for (const section of selectedMenu.sections) {
      for (const dish of section.items) {
        const catId = getDishCategory(dish);
        const catItems = CATALOG_ITEMS[catId] || [];
        const dishKey = dish.toLowerCase().substring(0, 15);
        const match = catItems.find((c: string) =>
          c.toLowerCase().includes(dishKey) || dishKey.includes(c.toLowerCase().substring(0, 10))
        );
        if (match) {
          items.push({
            item_id: match,
            name: dish,
            category: catId,
            quantity: 1,
          });
        }
      }
    }

    setStepData('step2', {
      menu_id: selectedAdultId,
      kid_menu_id: selectedKidId,
      use_proposed: false,
    } as any);
    setStepData('step3', {
      selected_items: items.length > 0 ? items : selectedMenu.sections.flatMap(s => s.items.map(name => ({
        item_id: name,
        name: name,
        category: getDishCategory(name),
        quantity: 1,
      }))),
    } as any);
    nextStep();
  };

  const adultSelected = adultMenus.find(m => m.id === selectedAdultId);
  const kidSelected = kidMenus.find(m => m.id === selectedKidId);

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
                  Adulto: {hasAdult ? `✓ ${adultSelected?.name}` : '○ Sin seleccionar'} | 
                  Niño: {hasKid ? `✓ ${kidSelected?.name}` : '○ Sin seleccionar'}
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Menu Selection — original visual style */}
      <div className="space-y-3">
        {[...adultMenus, ...kidMenus].map((menu, i) => {
          const isSelected = menu.is_kid
            ? selectedKidId === menu.id
            : selectedAdultId === menu.id;
          const isExpanded = expandedMenu === menu.id;
          const isKid = menu.is_kid;
          const totalItems = menu.sections.reduce((sum, s) => sum + s.items.length, 0);

          return (
            <motion.div
              key={menu.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden
                ${isSelected
                  ? isKid
                    ? 'border-pink-500 bg-pink-50/30 shadow-lg shadow-pink-100/50'
                    : 'border-amber-600 bg-amber-50/30 shadow-lg shadow-amber-100/50'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
                }`}
            >
              <button
                onClick={() => {
                  if (isKid) {
                    setSelectedKidId(isSelected ? '' : menu.id);
                  } else {
                    setSelectedAdultId(isSelected ? '' : menu.id);
                  }
                  setExpandedMenu(isExpanded ? null : menu.id);
                }}
                className="w-full text-left p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h3 className="font-serif text-xl text-stone-800">
                        {menu.name}
                      </h3>
                      <span className={`px-3 py-0.5 rounded-full text-xs font-semibold ${TAG_STYLES[menu.tag] || 'bg-stone-100 text-stone-600'}`}>
                        {menu.tag}
                      </span>
                      {isKid && (
                        <span className="px-3 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-700">
                          Infantil
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-stone-500">
                      <span>{menu.sections.length} secciones</span>
                      <span>·</span>
                      <span>{totalItems} platos</span>
                    </div>
                  </div>
                  <div className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                    ${isSelected
                      ? isKid
                        ? 'border-pink-500 bg-pink-500 scale-110'
                        : 'border-amber-600 bg-amber-600 scale-110'
                      : 'border-stone-300'}`}>
                    {isSelected && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded sections */}
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`border-t ${isKid ? 'border-pink-200/50 bg-pink-50/30' : 'border-amber-200/50 bg-amber-50/30'}`}
                >
                  <div className="p-5 pt-4 space-y-4">
                    {menu.sections.map((section, si) => (
                      <div key={si}>
                        <h4 className="text-xs font-bold uppercase tracking-widest mb-2"
                          style={{ color: isKid ? '#be185d' : '#b45309' }}>
                          {section.section}
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {section.items.map((item, ii) => (
                            <span
                              key={ii}
                              className="text-sm px-2.5 py-1 rounded-md border"
                              style={{
                                backgroundColor: isKid ? '#fdf2f8' : '#fffbeb',
                                borderColor: isKid ? '#fbcfe8' : '#fef3c7',
                                color: '#44403c',
                              }}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
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

        {canUseMenu ? (
          <button
            onClick={handleUseMenu}
            className="flex-1 py-4 rounded-xl font-semibold text-base bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg transition-all"
          >
            ✓ Usar este menú →
          </button>
        ) : (
          <button
            disabled
            className="flex-1 py-4 rounded-xl font-semibold text-base bg-stone-200 text-stone-400 cursor-not-allowed"
          >
            {kids > 0 && !hasAdult
              ? 'Selecciona menú adulto'
              : kids > 0 && !hasKid
                ? 'Selecciona menú infantil'
                : 'Selecciona menú'}
          </button>
        )}
      </div>

      {/* Customize button — always visible when a menu is selected */}
      {selectedAdultId && (
        <button
          onClick={handleCustomize}
          className="w-full py-4 rounded-xl font-semibold text-base border-2 border-amber-600 text-amber-700 hover:bg-amber-50 transition-all"
        >
          ✏️ Personalizar este menú →
        </button>
      )}
    </motion.div>
  );
}
