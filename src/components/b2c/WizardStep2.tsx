'use client';
/**
 * J.Benitez — Wizard Step 2: Menu Propuesto
 * 
 * Colores coherentes: sin rosa chillon para menus infantiles
 * Paleta: cream/gold/ink en todo
 */

import { useState, useMemo } from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS } from '@/data/menus';

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

const TAG_STYLES: Record<string, string> = {
  'Recomendado': 'bg-[#C9A84C]/15 text-[#C9A84C]',
  'Premium': 'bg-stone-800 text-white',
  'Premium +': 'bg-stone-800 text-white',
  'Gran Selección': 'bg-[#C9A84C]/15 text-[#C9A84C]',
  'Infantil': 'bg-stone-200 text-stone-600',
  'Esencial': 'bg-stone-100 text-stone-500',
  'Completo': 'bg-[#C9A84C]/15 text-[#C9A84C]',
};

export default function WizardStep2() {
  const { step1, step2, setStepData, nextStep, prevStep, setStep } = useWizardStore();
  const [selectedAdultId, setSelectedAdultId] = useState<string>(step2?.menu_id || '');
  const [selectedKidId, setSelectedKidId] = useState<string>(step2?.kid_menu_id || '');
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const kids = step1?.kids_count || 0;

  const adultMenus = useMemo(() => PROPOSED_MENUS.filter(m => !m.is_kid), []);
  const kidMenus = useMemo(() => PROPOSED_MENUS.filter(m => m.is_kid), []);

  const hasAdult = !!selectedAdultId;
  const hasKid = !!selectedKidId;
  const kidsValid = kids === 0 || (hasAdult && hasKid);
  const canUseMenu = kidsValid && (hasAdult || !kids);

  // NO useEffect that auto-saves — we save manually on button click

  const handleUseMenu = () => {
    if (!canUseMenu) return;
    try {
      setStepData('step2', {
        use_proposed: true,
        menu_id: selectedAdultId,
        kid_menu_id: selectedKidId || '',
      });
      // Saltar a step4 directamente → menú ya hecho, no necesita personalizar
      setStepData('step3', { selected_items: [] });
      setStep(4);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el menú');
    }
  };

  const handleCustomFromScratch = () => {
    try {
      setStepData('step2', {
        use_proposed: false,
        menu_id: '',
        kid_menu_id: '',
      });
      setStepData('step3', { selected_items: [] });
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar personalización');
    }
  };

  const handleCustomizeMenu = () => {
    if (!canUseMenu) return;
    const selectedMenu = PROPOSED_MENUS.find(m => m.id === selectedAdultId);
    if (!selectedMenu) return;

    try {
      // Cargar todos los items del menú seleccionado en step3
      const selectedItems: any[] = [];
      selectedMenu.sections.forEach(section => {
        section.items.forEach(item => {
          const category = getDishCategory(item);
          // Estimar cantidad base: 1 por comensal para plato principal, 1/10 para compartir
          const isMain = category === 'carne' || category === 'pescado' || category === 'arroz';
          const onePerGuest = isMain || category === 'compartir-mesa';
          selectedItems.push({
            item_id: item,
            name: item,
            category,
            quantity: onePerGuest ? (step1?.guest_count || 1) : 1,
            unit_price_pvp: 0,
            unit_price_cost: 0,
            subtotal_pvp: 0,
            subtotal_cost: 0,
          });
        });
      });

      setStepData('step2', {
        use_proposed: true,
        menu_id: selectedAdultId,
        kid_menu_id: selectedKidId || '',
      });
      setStepData('step3', { selected_items: selectedItems });
      // Ir a step3 para personalizar
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el menú');
    }
  };

  const selectedMenu = adultMenus.find(m => m.id === selectedAdultId);
  const selectedKidMenu = kidMenus.find(m => m.id === selectedKidId);

  const cardClass = (active: boolean, accentColor?: string) =>
    `rounded-xl border-2 p-4 transition-all duration-300 cursor-pointer ${
      active
        ? `border-[#C9A84C] bg-[#C9A84C]/6 shadow-md shadow-[#C9A84C]/10`
        : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
    }`;

  return (
    <div
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Elige tu Menu
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Selecciona un menu propuesto o personaliza cada plato
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Adult Menus */}
      <div>
        <h3 className="font-serif text-base font-semibold text-stone-700 mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Menus para adultos
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          {adultMenus.map((menu) => (
            <div
              key={menu.id}
              className={cardClass(selectedAdultId === menu.id)}
              onClick={() => setSelectedAdultId(menu.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="font-serif text-base text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {menu.name}
                  </h4>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${TAG_STYLES[menu.tag] || 'bg-stone-100 text-stone-500'}`}>
                    {menu.tag}
                  </span>
                </div>
                {selectedAdultId === menu.id && (
                  <div className="w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
              
              <div className="space-y-1">
                {menu.sections.map((section, idx) => (
                  <div key={idx}>
                    <button
                      className="flex items-center justify-between w-full text-xs font-medium text-stone-500 hover:text-stone-700 transition-colors py-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedMenu(expandedMenu === `${menu.id}-${idx}` ? null : `${menu.id}-${idx}`);
                      }}
                    >
                      <span>{section.section}</span>
                      <svg className={`w-3 h-3 transition-transform ${expandedMenu === `${menu.id}-${idx}` ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {expandedMenu === `${menu.id}-${idx}` && (
                      <div className="overflow-hidden">
                        <ul className="mt-1.5 space-y-0.5">
                          {section.items.map((item, i) => (
                            <li key={i} className="text-xs text-stone-400 pl-3 border-l border-[#C9A84C]/25">
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
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
          <h3 className="font-serif text-base font-semibold text-stone-700 mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Menus para niños
          </h3>
          <div className="grid md:grid-cols-2 gap-3">
            {kidMenus.map((menu) => (
              <div
                key={menu.id}
                className={cardClass(selectedKidId === menu.id)}
                onClick={() => setSelectedKidId(menu.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h4 className="font-serif text-base text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                      {menu.name}
                    </h4>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium mt-0.5 ${TAG_STYLES[menu.tag] || 'bg-stone-100 text-stone-500'}`}>
                      {menu.tag}
                    </span>
                  </div>
                  {selectedKidId === menu.id && (
                    <div className="w-5 h-5 rounded-full bg-[#C9A84C] flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                
                <div className="space-y-1">
                  {menu.sections.map((section, idx) => (
                    <div key={idx}>
                      <button
                        className="flex items-center justify-between w-full text-xs font-medium text-stone-500 hover:text-stone-700 transition-colors py-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedMenu(expandedMenu === `${menu.id}-${idx}` ? null : `${menu.id}-${idx}`);
                        }}
                      >
                        <span>{section.section}</span>
                        <svg className={`w-3 h-3 transition-transform ${expandedMenu === `${menu.id}-${idx}` ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {expandedMenu === `${menu.id}-${idx}` && (
                        <div className="overflow-hidden">
                          <ul className="mt-1.5 space-y-0.5">
                            {section.items.map((item, i) => (
                              <li key={i} className="text-xs text-stone-400 pl-3 border-l border-[#C9A84C]/25">
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
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
      <div className="flex flex-col sm:flex-row gap-3 justify-end pt-4 border-t border-stone-200">
        <button onClick={prevStep} className="px-5 py-2.5 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors">
          Anterior
        </button>
        <div className="flex gap-2.5 flex-wrap justify-end">
          <button
            onClick={handleCustomFromScratch}
            className="px-5 py-2.5 rounded-xl text-sm font-medium bg-white border border-stone-200 text-stone-600 hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-all duration-300"
          >
            Personalizar desde cero
          </button>
          <button
            onClick={handleCustomizeMenu}
            disabled={!canUseMenu}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              canUseMenu
                ? 'bg-[#C9A84C] text-white hover:bg-[#B8973F] shadow-md shadow-[#C9A84C]/20'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Personalizar Menu
          </button>
          <button
            onClick={handleUseMenu}
            disabled={!canUseMenu}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
              canUseMenu
                ? 'bg-[#1A1A1A] text-white hover:bg-stone-800'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Usar este Menu
          </button>
        </div>
      </div>
    </div>
  );
}
