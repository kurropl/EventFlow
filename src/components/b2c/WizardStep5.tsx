'use client';
/**
 * J.Benitez — Wizard Step 5: Resumen y Envío
 * 
 * - Muestra todos los detalles del evento
 * - Contabiliza platos seleccionados con cantidades
 * - Envía la propuesta al backend
 */

import { useState } from 'react';
import { useWizardStore } from '@/store/useWizardStore';
import { PROPOSED_MENUS } from '@/data/menus';

export default function WizardStep5() {
  const { 
    step1, step2, step3, step4, 
    clientInfo, setClientInfo,
    submit, isSubmitting, submitError, submitSuccess,
    prevStep, reset
  } = useWizardStore();
  const [submitted, setSubmitted] = useState(false);

  const selectedMenu = PROPOSED_MENUS.find(m => m.id === step2?.menu_id);
  const selectedKidMenu = PROPOSED_MENUS.find(m => m.id === step2?.kid_menu_id);
  const selectedItems = (step3 as any)?.selected_items || [];

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${parseInt(day)} de ${months[parseInt(month) - 1]} de ${year}`;
  };

  const eventTypeLabels: Record<string, string> = {
    boda: 'Boda',
    'cumpleaños': 'Cumpleaños',
    corporativo: 'Corporativo',
    bautizo: 'Bautizo',
    comunión: 'Comunión',
    otro: 'Otro',
  };

  // Agrupar items por categoría
  const groupedItems: Record<string, any[]> = {};
  selectedItems.forEach((item: any) => {
    if (!groupedItems[item.category]) groupedItems[item.category] = [];
    groupedItems[item.category].push(item);
  });

  const totalQuantity = selectedItems.reduce((sum: number, i: any) => sum + (i.quantity || 0), 0);
  const totalPlates = selectedItems.length;

  const handleSubmit = async () => {
    if (submitted) return;
    setSubmitted(true);
    const result = await submit();
    if (!result.success) {
      setSubmitted(false);
    }
  };

  // Si se envió con éxito → mostrar mensaje
  if (submitSuccess) {
    return (
      <div
        className="text-center py-16"
      >
        <div className="w-16 h-16 rounded-full bg-[#C9A84C]/20 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          ¡Propuesta Enviada!
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Hemos recibido tu propuesta. En breve nos pondremos en contacto contigo para confirmar los detalles.
        </p>
        <button
          onClick={() => reset()}
          className="mt-8 px-7 py-3 rounded-xl text-sm font-medium bg-[#1A1A1A] text-white hover:bg-stone-800 transition-colors"
        >
          Diseñar otra propuesta
        </button>
      </div>
    );
  }

  return (
    <div
      className="space-y-8"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Resumen de tu Evento
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Revisa los detalles y completa tus datos para enviar la propuesta
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
          <div>
            <p className="text-xs text-stone-400 uppercase tracking-wider mb-0.5">Total platos</p>
            <p className="text-sm font-medium text-stone-800">{totalPlates} platos · {totalQuantity} raciones</p>
          </div>
        </div>
      </div>

      {/* Menu */}
      <div className="rounded-xl border border-stone-200 p-5 bg-white">
        <h3 className="font-serif text-base font-semibold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
          Menú Seleccionado
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

      {/* Selected Items with quantities */}
      {selectedItems.length > 0 && (
        <div className="rounded-xl border border-stone-200 p-5 bg-white">
          <h3 className="font-serif text-base font-semibold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
            Platos Seleccionados ({totalPlates})
          </h3>
          <div className="space-y-3">
            {Object.entries(groupedItems).map(([cat, items]) => (
              <div key={cat}>
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-1.5">{cat} ({items.length})</p>
                <div className="space-y-1">
                  {(items as any[]).map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-sm py-0.5">
                      <span className="text-stone-700">{item.name}</span>
                      <span className="text-xs text-stone-400 ml-2 flex-shrink-0">
                        x{item.quantity} ración{item.quantity > 1 ? 'es' : ''}
                      </span>
                    </div>
                  ))}
                </div>
                {Object.keys(groupedItems).indexOf(cat) < Object.keys(groupedItems).length - 1 && (
                  <div className="h-px bg-stone-100 mt-2" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extras */}
      {(step4 as any)?.selected_suggestions?.length > 0 && (
        <div className="rounded-xl border border-stone-200 p-5 bg-white">
          <h3 className="font-serif text-base font-semibold mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
            Extras
          </h3>
          <div className="flex flex-wrap gap-2">
            {(step4 as any).selected_suggestions.map((extra: string, i: number) => (
              <span key={i} className="px-3 py-1 rounded-full bg-[#C9A84C]/15 text-[#C9A84C] text-xs font-medium">
                {extra}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Client Info Form */}
      <div className="rounded-xl border border-stone-200 p-5 bg-white">
        <h3 className="font-serif text-base font-semibold mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#1A1A1A' }}>
          Tus Datos
        </h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Nombre completo *</label>
            <input
              type="text"
              value={clientInfo.name}
              onChange={(e) => setClientInfo({ name: e.target.value })}
              placeholder="Tu nombre"
              className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Email *</label>
            <input
              type="email"
              value={clientInfo.email}
              onChange={(e) => setClientInfo({ email: e.target.value })}
              placeholder="tu@email.com"
              className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Teléfono</label>
            <input
              type="tel"
              value={clientInfo.phone}
              onChange={(e) => setClientInfo({ phone: e.target.value })}
              placeholder="+34 600 000 000"
              className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Notas</label>
            <input
              type="text"
              value={clientInfo.notes}
              onChange={(e) => setClientInfo({ notes: e.target.value })}
              placeholder="Alguna observación..."
              className="w-full px-3 py-2.5 rounded-lg border border-stone-200 bg-[#FAF8F5] text-sm focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{submitError}</div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
        <button onClick={prevStep} disabled={isSubmitting} className="px-6 py-3 rounded-xl text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors disabled:opacity-50">
          Anterior
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !clientInfo.name || !clientInfo.email}
          className={`px-10 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
            isSubmitting || !clientInfo.name || !clientInfo.email
              ? 'bg-stone-300 text-stone-500 cursor-not-allowed'
              : 'bg-[#C9A84C] text-white hover:bg-[#B8973F] shadow-lg shadow-[#C9A84C]/30'
          }`}
        >
          {isSubmitting ? 'Enviando...' : 'Enviar Propuesta'}
        </button>
      </div>
    </div>
  );
}
