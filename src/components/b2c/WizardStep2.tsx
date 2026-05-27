'use client';
/**
 * J.Benitez — Wizard Step 2: Menú Propuesto
 * 
 * Diseño visual premium con tarjetas expandibles y secciones.
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
  'Recomendado': 'bg-[#C9A84C]/20 text-[#C9A84C]',
  'Premium': 'bg-stone-800 text-white',
  'Premium +': 'bg-stone-800 text-white',
  'Gran Selección': 'bg-[#C9A84C]/20 text-[#C9A84C]',
  'Infantil': 'bg-pink-100 text-pink-700',
  'Esencial': 'bg-stone-100 text-stone-600',
  'Completo': 'bg-[#C9A84C]/20 text-[#C9A84C]',
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
    if (selectedAdultId && selectedKidId) {
      setStepData('step2', { use_proposed: true,
        menu_id: selectedAdultId,
        kid_menu_id: selectedKidId,
      });
    }
  }, [selectedAdultId, selectedKidId]);

  const handleUseMenu = () => {
    if (!canUseMenu) return;
    setStepData('step2', { use_proposed: true,
      menu_id: selectedAdultId,
      kid_menu_id: selectedKidId,
    });
    nextStep();
  };

  const handleCustomizeMenu = () => {
    if (!canUseMenu) return;
    
    const selectedMenu = PROPOSED_MENUS.find(m => m.id === selectedAdultId);
    if (!selectedMenu) return;

    // Convertir menú propuesto a estructura de personalización
    const selections: Record<string, string[]> = {};
    selectedMenu.sections.forEach(section => {
      const category = getDishCategory(section.items[0] || '');
      if (!selections[category]) selections[category] = [];
      selections[category].push(...section.items);
    });

    setStepData('step2', { use_proposed: true,
      menu_id: selectedAdultId,
      kid_menu_id: selectedKidId,
    });
    setStepData('step3', { selected_items: [],
    });
    nextStep();
  };

  const selectedMenu = adultMenus.find(m => m.id === selectedAdultId);
  const selectedKidMenu = kidMenus.find(m => m.id === selectedKidId);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-10"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Elige tu Menú
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Selecciona un menú propuesto o personaliza cada plato a tu gusto
        </p>
      </div>

      {/* Adult Menus */}
      <div>
        <h3 className="font-serif text-xl text-stone-700 mb-4">Menús para adultos</h3>
        <div className="grid md:grid-cols-2 gap-4">
          {adultMenus.map((menu) => (
            <div
              key={menu.id}
              className={`rounded-xl border-2 p-5 transition-all duration-300 cursor-pointer ${
                selectedAdultId === menu.id
                  ? 'border-[#C9A84C] bg-[#C9A84C]/5 shadow-lg shadow-[#C9A84C]/20'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
              }`}
              onClick={() => setSelectedAdultId(menu.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-serif text-lg text-stone-800">{menu.name}</h4>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${TAG_STYLES[menu.tag] || 'bg-stone-100 text-stone-600'}`}>
                    {menu.tag}
                  </span>
                </div>
                {selectedAdultId === menu.id && (
                  <div className="w-6 h-6 rounded-full bg-[#C9A84C] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              
              {/* Expandable sections */}
              <div className="space-y-2">
                {menu.sections.map((section, idx) => (
                  <div key={idx}>
                    <button
                      className="flex items-center justify-between w-full text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedMenu(expandedMenu === `${menu.id}-${idx}` ? null : `${menu.id}-${idx}`);
                      }}
                    >
                      <span>{section.section}</span>
                      <svg className={`w-4 h-4 transition-transform ${expandedMenu === `${menu.id}-${idx}` ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedMenu === `${menu.id}-${idx}` && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <ul className="mt-2 space-y-1">
                          {section.items.map((item, i) => (
                            <li key={i} className="text-sm text-stone-500 pl-4 border-l-2 border-[#C9A84C]/30">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kid Menus */}
      {kids > 0 && (
        <div>
          <h3 className="font-serif text-xl text-stone-700 mb-4">Menús para niños</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {kidMenus.map((menu) => (
              <div
                key={menu.id}
                className={`rounded-xl border-2 p-5 transition-all duration-300 cursor-pointer ${
                  selectedKidId === menu.id
                    ? 'border-pink-400 bg-pink-50 shadow-lg shadow-pink-200/50'
                    : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
                }`}
                onClick={() => setSelectedKidId(menu.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-serif text-lg text-stone-800">{menu.name}</h4>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${TAG_STYLES[menu.tag] || 'bg-stone-100 text-stone-600'}`}>
                      {menu.tag}
                    </span>
                  </div>
                  {selectedKidId === menu.id && (
                    <div className="w-6 h-6 rounded-full bg-pink-400 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  {menu.sections.map((section, idx) => (
                    <div key={idx}>
                      <button
                        className="flex items-center justify-between w-full text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenu(expandedMenu === `${menu.id}-${idx}` ? null : `${menu.id}-${idx}`);
                        }}
                      >
                        <span>{section.section}</span>
                        <svg className={`w-4 h-4 transition-transform ${expandedMenu === `${menu.id}-${idx}` ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedMenu === `${menu.id}-${idx}` && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <ul className="mt-2 space-y-1">
                            {section.items.map((item, i) => (
                              <li key={i} className="text-sm text-stone-500 pl-4 border-l-2 border-pink-300">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t border-stone-200">
        <button
          onClick={prevStep}
          className="px-6 py-3 rounded-xl text-sm font-medium text-stone-600 hover:text-stone-800 transition-colors"
        >
          Anterior
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleCustomizeMenu}
            disabled={!canUseMenu}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
              canUseMenu
                ? 'bg-[#C9A84C] text-white hover:bg-[#A88A3A] shadow-lg shadow-[#C9A84C]/30'
                : 'bg-stone-200 text-stone-500 cursor-not-allowed'
            }`}
          >
            Personalizar Menú
          </button>
          <button
            onClick={handleUseMenu}
            disabled={!canUseMenu}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
              canUseMenu
                ? 'bg-stone-800 text-white hover:bg-stone-900'
                : 'bg-stone-200 text-stone-500 cursor-not-allowed'
            }`}
          >
            Usar este Menú
          </button>
        </div>
      </div>
    </motion.div>
  );
}
