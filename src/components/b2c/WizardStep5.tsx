'use client';
/**
 * J.Benitez — Wizard Step 5: Resumen
 * 
 * Muestra el resumen final del evento configurado.
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

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Resumen de tu Evento
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Revisa los detalles antes de enviar tu propuesta
        </p>
      </div>

      {/* Event Details */}
      <div className="rounded-xl border border-stone-200 p-6 bg-white">
        <h3 className="font-serif text-xl text-stone-800 mb-4">Detalles del Evento</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-stone-500">Tipo de evento</p>
            <p className="font-medium text-stone-800">{step1?.event_type}</p>
          </div>
          <div>
            <p className="text-sm text-stone-500">Fecha</p>
            <p className="font-medium text-stone-800">{formatDate(step1?.event_date)}</p>
          </div>
          <div>
            <p className="text-sm text-stone-500">Comensales</p>
            <p className="font-medium text-stone-800">{step1?.guest_count} adultos{step1?.kids_count ? `, ${step1.kids_count} niños` : ''}</p>
          </div>
        </div>
      </div>

      {/* Menu Selection */}
      <div className="rounded-xl border border-stone-200 p-6 bg-white">
        <h3 className="font-serif text-xl text-stone-800 mb-4">Menú Seleccionado</h3>
        {selectedMenu && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-stone-500">Menú Adulto</p>
              <p className="font-medium text-stone-800">{selectedMenu.name} ({selectedMenu.tag})</p>
            </div>
            {selectedKidMenu && (
              <div>
                <p className="text-sm text-stone-500">Menú Infantil</p>
                <p className="font-medium text-stone-800">{selectedKidMenu.name} ({selectedKidMenu.tag})</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extras */}
      {step4?.extras && step4.extras.length > 0 && (
        <div className="rounded-xl border border-stone-200 p-6 bg-white">
          <h3 className="font-serif text-xl text-stone-800 mb-4">Extras</h3>
          <div className="flex flex-wrap gap-2">
            {step4.extras.map((extra, i) => (
              <span key={i} className="px-3 py-1 rounded-full bg-[#C9A84C]/20 text-[#C9A84C] text-sm font-medium">
                {extra}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
        <button className="px-8 py-4 rounded-xl text-sm font-medium bg-[#C9A84C] text-white hover:bg-[#A88A3A] shadow-lg shadow-[#C9A84C]/30 transition-all duration-300">
          Enviar Propuesta
        </button>
      </div>
    </motion.div>
  );
}
