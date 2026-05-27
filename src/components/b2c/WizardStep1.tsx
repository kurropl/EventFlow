'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';

const EVENT_TYPES = [
  { id: 'boda', label: 'Boda', desc: 'El día más importante', icon: '♡' },
  { id: 'cumpleaños', label: 'Cumpleaños', desc: 'Celebra tu día especial', icon: '☆' },
  { id: 'corporativo', label: 'Corporativo', desc: 'Eventos de empresa', icon: '◈' },
  { id: 'bautizo', label: 'Bautizo', desc: 'Momentos especiales', icon: '✧' },
  { id: 'comunión', label: 'Comunión', desc: 'Celebraciones familiares', icon: '✦' },
  { id: 'otro', label: 'Otro', desc: 'Personaliza tu evento', icon: '⋆' },
];

const MONTHS = [
  { v: '01', n: 'Enero' }, { v: '02', n: 'Febrero' }, { v: '03', n: 'Marzo' },
  { v: '04', n: 'Abril' }, { v: '05', n: 'Mayo' }, { v: '06', n: 'Junio' },
  { v: '07', n: 'Julio' }, { v: '08', n: 'Agosto' }, { v: '09', n: 'Septiembre' },
  { v: '10', n: 'Octubre' }, { v: '11', n: 'Noviembre' }, { v: '12', n: 'Diciembre' },
];

function getDays(month: string, year: string) {
  if (!month || !year) return 31;
  return new Date(parseInt(year), parseInt(month), 0).getDate();
}

function yearsRange() {
  const y = new Date().getFullYear();
  return Array.from({ length: 4 }, (_, i) => (y + i).toString());
}

export default function WizardStep1() {
  const { step1, setStepData, nextStep } = useWizardStore();
  
  // State
  const [eventType, setEventType] = useState<string>(step1?.event_type || '');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [guestCount, setGuestCount] = useState(step1?.guest_count?.toString() || '');
  const [kidsCount, setKidsCount] = useState(step1?.kids_count?.toString() || '');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const adults = parseInt(guestCount) || 0;
  const kids = parseInt(kidsCount) || 0;
  
  // Build ISO date string from three selects
  const eventDate = (month && day && year) ? `${year}-${month}-${day.padStart(2, '0')}` : '';
  const canProceed = eventType && eventDate && adults >= 10;

  // Update day when month/year changes (to prevent invalid dates)
  const maxDays = getDays(month, year);
  useEffect(() => {
    if (parseInt(day) > maxDays) setDay(maxDays.toString());
  }, [month, year]);

  const handleNext = () => {
    setError(null);
    setIsLoading(true);
    
    try {
      setStepData('step1', {
        event_type: eventType as any,
        event_date: eventDate,
        guest_count: adults,
        kids_count: kids,
      });
      // Use setTimeout to ensure state is committed before advancing
      setTimeout(() => {
        nextStep();
      }, 50);
    } catch (err: any) {
      setError(err?.message || 'Error al validar los datos. Revisa los campos.');
      setIsLoading(false);
    }
  };

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
          Detalles del Evento
        </h2>
        <p className="text-stone-500 text-base max-w-md mx-auto">
          Cuéntanos qué tipo de celebración tienes en mente
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Event Type */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-4">¿Qué tipo de evento es?</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {EVENT_TYPES.map((et) => (
            <button
              key={et.id}
              type="button"
              onClick={() => setEventType(et.id)}
              data-testid={`event-type-${et.id}`}
              className={`group relative p-5 rounded-xl border-2 text-center transition-all duration-200 ${
                eventType === et.id
                  ? 'border-[#C9A84C] bg-[#C9A84C]/10 shadow-md shadow-[#C9A84C]/20'
                  : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
              }`}
            >
              <div className={`text-2xl mb-2 ${
                eventType === et.id ? 'text-[#C9A84C]' : 'text-stone-400'
              }`}>{et.icon}</div>
              <div className={`text-sm font-semibold ${
                eventType === et.id ? 'text-stone-800' : 'text-stone-700'
              }`}>{et.label}</div>
              <div className="text-xs text-stone-400 mt-1">{et.desc}</div>
              {eventType === et.id && (
                <div className="absolute top-2 right-2">
                  <svg className="w-4 h-4 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Date: Three Selects */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-2">Fecha del evento</label>
        <div className="flex gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
          >
            <option value="">Mes</option>
            {MONTHS.map((m) => (
              <option key={m.v} value={m.v}>{m.n}</option>
            ))}
          </select>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
          >
            <option value="">Día</option>
            {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d.toString().padStart(2, '0')}>{d}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
          >
            <option value="">Año</option>
            {yearsRange().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Guest Count */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-2">Número de comensales</label>
        <div className="flex gap-4">
          <div className="flex-1">
            <input
              type="number"
              min="10"
              max="300"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              placeholder="Adultos"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
            />
          </div>
          <div className="flex-1">
            <input
              type="number"
              min="0"
              max="50"
              value={kidsCount}
              onChange={(e) => setKidsCount(e.target.value)}
              placeholder="Niños"
              className="w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all"
            />
          </div>
        </div>
        <p className="text-xs text-stone-500 mt-2">Mínimo 10 comensales adultos</p>
      </div>

      {/* Next Button */}
      <div className="flex justify-end">
        <button
          onClick={handleNext}
          disabled={!canProceed || isLoading}
          className={`px-8 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
            canProceed
              ? 'bg-[#C9A84C] text-white hover:bg-[#A88A3A] shadow-lg shadow-[#C9A84C]/30'
              : 'bg-stone-200 text-stone-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Procesando...' : 'Siguiente'}
        </button>
      </div>
    </motion.div>
  );
}
