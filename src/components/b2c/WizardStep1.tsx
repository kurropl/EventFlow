'use client';
/**
 * EventFlow — Wizard Step 1: Detalles del Evento
 * 
 * Tipo de evento, fecha, comensales.
 * Diseño premium: iconos SVG, tipografía clara, sin emojis.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';

const EVENT_TYPES = [
  {
    id: 'boda',
    label: 'Boda',
    desc: 'El día más importante',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C9.5 2 7 4 7 7c0 1.5.5 2.5 1 3.5.5 1 1 2 1 3.5v3h6v-3c0-1.5.5-2.5 1-3.5.5-1 1-2 1-3.5 0-3-2.5-5-5-5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 21h6" />
      </svg>
    ),
  },
  {
    id: 'cumpleanos',
    label: 'Cumpleaños',
    desc: 'Celebra tu día especial',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3l1 3M16 3l-1 3M3 12h3M18 12h3" />
      </svg>
    ),
  },
  {
    id: 'corporativo',
    label: 'Corporativo',
    desc: 'Eventos de empresa',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    id: 'bautizo',
    label: 'Bautizo',
    desc: 'Momentos especiales',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M8 9l4 4 4-4M6 21h12" />
      </svg>
    ),
  },
  {
    id: 'comunión',
    label: 'Comunión',
    desc: 'Celebraciones familiares',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v6M9 5h6M12 8v13M8 21h8" />
        <circle cx="12" cy="18" r="2" />
      </svg>
    ),
  },
  {
    id: 'otro',
    label: 'Otro',
    desc: 'Personaliza tu evento',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l2.5 5 5.5.8-4 3.9.9 5.3L12 15.5 7.1 18l.9-5.3-4-3.9 5.5-.8z" />
      </svg>
    ),
  },
];

export default function WizardStep1() {
  const { step1, setStepData, nextStep } = useWizardStore();
  const [eventType, setEventType] = useState<string>(step1?.event_type || '');
  const [eventDate, setEventDate] = useState(step1?.event_date || '');
  const [guestCount, setGuestCount] = useState(step1?.guest_count?.toString() || '');
  const [kidsCount, setKidsCount] = useState(step1?.kids_count?.toString() || '');

  const canProceed = eventType && eventDate && guestCount && parseInt(guestCount) > 0;

  const handleNext = () => {
    setStepData('step1', {
      event_type: eventType as any,
      event_date: eventDate,
      guest_count: parseInt(guestCount) || 0,
      kids_count: parseInt(kidsCount) || 0,
    });
    nextStep();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-10"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-stone-800 mb-3">
          Detalles del Evento
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Cuéntanos qué tipo de celebración tienes en mente
        </p>
      </div>

      {/* Event Type Selection */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-4">
          ¿Qué tipo de evento es?
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {EVENT_TYPES.map((et) => (
            <button
              key={et.id}
              onClick={() => setEventType(et.id)}
              className={`group relative p-5 rounded-xl border-2 text-center transition-all duration-200
                ${eventType === et.id
                  ? 'border-amber-600 bg-amber-50 shadow-md shadow-amber-100'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
                }`}
            >
              <div className={`mx-auto mb-3 transition-colors ${
                eventType === et.id ? 'text-amber-700' : 'text-stone-400 group-hover:text-stone-600'
              }`}>
                {et.icon}
              </div>
              <div className={`text-sm font-semibold ${
                eventType === et.id ? 'text-stone-800' : 'text-stone-700'
              }`}>
                {et.label}
              </div>
              <div className="text-xs text-stone-400 mt-1">
                {et.desc}
              </div>
              {eventType === et.id && (
                <div className="absolute top-2 right-2">
                  <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-2">
          Fecha del evento
        </label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors text-stone-800 text-base"
        />
      </div>

      {/* Guest counts */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-2">
            Comensales adultos
          </label>
          <input
            type="number"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            min="1"
            placeholder="100"
            className="w-full px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors text-stone-800 text-base"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-stone-700 mb-2">
            Niños
          </label>
          <input
            type="number"
            value={kidsCount}
            onChange={(e) => setKidsCount(e.target.value)}
            min="0"
            placeholder="0"
            className="w-full px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white focus:border-amber-600 focus:outline-none transition-colors text-stone-800 text-base"
          />
        </div>
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={!canProceed}
        className={`w-full py-4 rounded-xl font-semibold text-base transition-all duration-200
          ${canProceed
            ? 'bg-amber-600 text-white hover:bg-amber-700 shadow-md hover:shadow-lg'
            : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
      >
        Elegir Menú →
      </button>
    </motion.div>
  );
}
