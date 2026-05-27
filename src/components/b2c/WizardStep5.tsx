'use client';
/**
 * J.Benitez — Wizard Step 5: Resumen
 * 
 * Colores coherentes gold/cream/ink
 */

import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS } from '@/data/menus';

export default function WizardStep5() {
  const { step1, step2, step3, step4 } = useWizardStore();

  const selectedMenu = PROPOSED_MENUS.find(m => m.id === step2?.menu_id);
  const selectedKidMenu = PROPOSED_MENUS.find(m => m.id === step2?.kid_menu_id);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`;
  };

  const eventTypeLabels: Record<string, string> = {
    boda: 'Boda',
    'cumpleanos': 'Cumpleanos',
    corporativo: 'Corporativo',
    bautizo: 'Bautizo',
    comunión: 'Comunion',
    otro: 'Otro',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Resumen de tu Evento
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Revisa los detalles antes de enviar tu propuesta
        </p>
      </div>

      {/* Event Details */}
      <div className="rounded-xl border border-stone-200 p-5 bg-white">
        <h3 className="font-serif text-base font-semibold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
          Detalles del Evento
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Tipo</p>
            <p className="text-sm font-medium text-stone-800">{eventTypeLabels[step1?.event_type || ''] || step1?.event_type}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Fecha</p>
            <p className="text-sm font-medium text-stone-800">{formatDate(step1?.event_date || '')}</p>
          </div>
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Comensales</p>
            <p className="text-sm font-medium text-stone-800">
              {step1?.guest_count} adultos{step1?.kids_count ? `, ${step1.kids_count} niños` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="rounded-xl border border-stone-200 p-5 bg-white">
        <h3 className="font-serif text-base font-semibold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
          Menu Seleccionado
        </h3>
        {selectedMenu && (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Adultos</p>
              <p className="text-sm font-medium text-stone-800">{selectedMenu.name} <span className="text-xs text-stone-400">({selectedMenu.tag})</span></p>
            </div>
            {selectedKidMenu && (
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Infantil</p>
                <p className="text-sm font-medium text-stone-800">{selectedKidMenu.name} <span className="text-xs text-stone-400">({selectedKidMenu.tag})</span></p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extras */}
      {step4?.selected_suggestions && step4.selected_suggestions.length > 0 && (
        <div className="rounded-xl border border-stone-200 p-5 bg-white">
          <h3 className="font-serif text-base font-semibold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
            Extras
          </h3>
          <div className="flex flex-wrap gap-2">
            {step4.selected_suggestions.map((extra: string, i: number) => (
              <span key={i} className="px-3 py-1 rounded-full bg-[#C9A84C]/15 text-[#C9A84C] text-xs font-medium">
                {extra}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
        <button className="px-8 py-3 rounded-xl text-sm font-medium bg-[#1A1A1A] text-white hover:bg-stone-800 shadow-lg shadow-stone-900/20 transition-all duration-300">
          Enviar Propuesta
        </button>
      </div>
    </motion.div>
  );
}
