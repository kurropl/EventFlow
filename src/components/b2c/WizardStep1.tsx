'use client';
/**
 * EventFlow — Wizard Step 1: Detalles del Evento
 * 
 * Tipo de evento, fecha, comensales y niños.
 * Sin precios.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';

const EVENT_TYPES = [
  { id: 'boda', label: 'Boda', icon: '💒', desc: 'El día más importante' },
  { id: 'cumpleaños', label: 'Cumpleaños', icon: '🎂', desc: 'Celebra tu día' },
  { id: 'corporativo', label: 'Corporativo', icon: '🏢', desc: 'Eventos de empresa' },
  { id: 'bautizo', label: 'Bautizo', icon: '👶', desc: 'Momentos especiales' },
  { id: 'comunión', label: 'Comunión', icon: '⛪', desc: 'Celebraciones familiares' },
  { id: 'otro', label: 'Otro', icon: '🎉', desc: 'Personaliza tu evento' },
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
      className="space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-ink mb-2">Detalles del Evento</h2>
        <p className="text-ink-soft/60">Cuéntanos qué tipo de celebración tienes en mente</p>
      </div>

      {/* Event Type */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-3">¿Qué tipo de evento es?</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {EVENT_TYPES.map((et) => (
            <button
              key={et.id}
              onClick={() => setEventType(et.id)}
              className={`p-4 rounded-xl border-2 text-center transition-all duration-300
                ${eventType === et.id
                  ? 'border-gold bg-gold/5 shadow-md'
                  : 'border-gold/10 bg-paper hover:border-gold/30'
                }`}
            >
              <div className="text-2xl mb-1">{et.icon}</div>
              <div className={`text-sm font-medium ${eventType === et.id ? 'text-ink' : 'text-ink/70'}`}>
                {et.label}
              </div>
              <div className="text-xs text-ink-soft/50 mt-0.5">{et.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-sm font-semibold text-ink mb-2">Fecha del evento</label>
        <input
          type="date"
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full px-4 py-3 rounded-xl border-2 border-gold/10 bg-paper focus:border-gold focus:outline-none transition-colors text-ink"
        />
      </div>

      {/* Guest counts */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Comensales adultos</label>
          <input
            type="number"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            min="1"
            placeholder="100"
            className="w-full px-4 py-3 rounded-xl border-2 border-gold/10 bg-paper focus:border-gold focus:outline-none transition-colors text-ink"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-ink mb-2">Niños</label>
          <input
            type="number"
            value={kidsCount}
            onChange={(e) => setKidsCount(e.target.value)}
            min="0"
            placeholder="0"
            className="w-full px-4 py-3 rounded-xl border-2 border-gold/10 bg-paper focus:border-gold focus:outline-none transition-colors text-ink"
          />
        </div>
      </div>

      {/* Next button */}
      <button
        onClick={handleNext}
        disabled={!canProceed}
        className={`w-full py-4 rounded-xl font-semibold text-lg transition-all duration-300
          ${canProceed
            ? 'bg-gold text-ink hover:bg-amber-400 shadow-lg shadow-gold/20 hover:shadow-gold/40'
            : 'bg-ink/10 text-ink/30 cursor-not-allowed'
          }`}
      >
        Elegir Menú →
      </button>
    </motion.div>
  );
}
