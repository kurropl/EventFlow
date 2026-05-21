'use client';
/**
 * EventFlow — Wizard Step 2: Menús Propuestos
 * 
 * Diseño visual elegante estilo captura:
 * - Tarjetas con fondo cream, tipografía Playfair Display, burgundy/gold
 * - Secciones con etiquetas doradas mayúsculas
 * - Lista de platos con viñetas
 * - Botón "Usar este menú" → salta directo a Extras
 * - Botón "Personalizar" → va al paso 3
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS } from '@/data/menus';

// Font injection
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@300;400;500;600;700&display=swap';
  link.rel = 'stylesheet';
  if (!document.querySelector('[href*="Playfair"]')) {
    document.head.appendChild(link);
  }
}

const TAG_COLORS: Record<string, string> = {
  'Esencial': 'text-stone-500',
  'Recomendado': 'text-amber-700',
  'Completo': 'text-amber-700',
  'Premium': 'text-amber-700',
  'Premium +': 'text-amber-700',
  'Gran Selección': 'text-amber-700',
  'Infantil': 'text-green-700',
};

const TAG_BG: Record<string, string> = {
  'Esencial': 'bg-stone-100',
  'Recomendado': 'bg-amber-50',
  'Completo': 'bg-amber-50',
  'Premium': 'bg-amber-50',
  'Premium +': 'bg-amber-50',
  'Gran Selección': 'bg-amber-50',
  'Infantil': 'bg-green-50',
};

export default function WizardStep2() {
  const { step2, setStepData, nextStep } = useWizardStore();
  const [selectedMenu, setSelectedMenu] = useState<string | null>(step2?.menu_id || null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

  useEffect(() => {
    if (step2?.menu_id) setSelectedMenu(step2.menu_id);
  }, [step2]);

  const handleSelect = (menuId: string) => {
    setSelectedMenu(menuId);
    setExpandedMenu(expandedMenu === menuId ? null : menuId);
  };

  const handleUseMenu = () => {
    if (!selectedMenu) return;
    setStepData('step2', { menu_id: selectedMenu, use_proposed: true } as any);
    // Skip step 3 (personalization) and go to step 4 (extras)
    nextStep(); // 2→3
    nextStep(); // 3→4
  };

  const handleCustomize = () => {
    if (!selectedMenu) return;
    setStepData('step2', { menu_id: selectedMenu, use_proposed: true } as any);
    nextStep(); // 2→3 (personalization)
  };

  const selectedMenuData = PROPOSED_MENUS.find((m) => m.id === selectedMenu);

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
        <h2 className="font-serif text-3xl md:text-4xl text-[#6b2737] mb-3"
            style={{ fontFamily: "'Playfair Display', serif" }}>
          Menús Propuestos
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Selecciona un menú completo o personaliza cada plato.
        </p>
      </div>

      {/* Menu cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {PROPOSED_MENUS.map((menu, i) => {
          const isSelected = selectedMenu === menu.id;
          const isExpanded = expandedMenu === menu.id;
          const totalItems = menu.sections.reduce((sum, s) => sum + s.items.length, 0);

          return (
            <motion.div
              key={menu.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className={`rounded-2xl border-2 transition-all duration-300 overflow-hidden
                ${isSelected
                  ? 'border-[#6b2737] shadow-xl shadow-[#6b2737]/10'
                  : 'border-stone-200 shadow-md hover:shadow-lg'
                }`}
              style={{
                background: isSelected ? '#faf8f3' : '#fdfbf7',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              {/* Card header */}
              <button
                onClick={() => handleSelect(menu.id)}
                className="w-full text-left p-6 pb-4"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1">
                    <span className={`text-xs font-semibold uppercase tracking-widest ${TAG_COLORS[menu.tag] || 'text-stone-400'}`}>
                      {menu.tag}
                    </span>
                    <h3
                      className="text-3xl font-bold text-[#6b2737] mt-1"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {menu.name}
                    </h3>
                  </div>
                  <div className={`w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all mt-2
                    ${isSelected ? 'border-[#6b2737] bg-[#6b2737]' : 'border-stone-300'}`}>
                    {isSelected && (
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Separator line */}
                <div className="w-full h-px bg-gradient-to-r from-[#b08a3e]/30 to-transparent mb-4" />

                {/* Sections preview */}
                <div className="space-y-3">
                  {menu.sections.slice(0, isExpanded ? undefined : 2).map((section, si) => (
                    <div key={si}>
                      <h4 className="text-xs font-bold text-[#b08a3e] uppercase tracking-widest mb-1.5">
                        {section.section}
                      </h4>
                      <ul className="space-y-0.5">
                        {section.items.slice(0, isExpanded ? undefined : 3).map((item, ii) => (
                          <li key={ii} className="text-sm text-stone-700 flex items-start gap-1.5">
                            <span className="text-[#b08a3e] mt-1.5 text-xs">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                        {section.items.length > 3 && !isExpanded && (
                          <li className="text-xs text-stone-400 italic">
                            +{section.items.length - 3} más...
                          </li>
                        )}
                      </ul>
                    </div>
                  ))}
                  {menu.sections.length > 2 && !isExpanded && (
                    <div className="text-xs text-stone-400 italic">
                      +{menu.sections.length - 2} secciones más...
                    </div>
                  )}
                </div>
              </button>

              {/* Expand/collapse */}
              <button
                onClick={() => handleSelect(menu.id)}
                className="w-full py-2.5 text-center text-xs font-medium text-[#b08a3e] hover:text-[#6b2737] transition-colors border-t border-stone-100 bg-white/50"
              >
                {isExpanded ? '▲ Cerrar' : `▼ Ver todos los platos`}
              </button>

              {/* Action buttons (shown when selected) */}
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 pt-0 space-y-2"
                >
                  <button
                    onClick={handleUseMenu}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
                      bg-[#6b2737] text-white hover:bg-[#4a1a26] shadow-md hover:shadow-lg"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    Usar este menú →
                  </button>
                  <button
                    onClick={handleCustomize}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200
                      border-2 border-[#b08a3e] text-[#b08a3e] hover:bg-[#b08a3e]/5"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                  >
                    Personalizar este menú
                  </button>
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
