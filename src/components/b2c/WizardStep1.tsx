'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useWizardStore } from '@/store/useWizardStore';

const EVENT_TYPES = [
  { id: 'boda', label: 'Boda', desc: 'El dia mas importante' },
  { id: 'cumpleaños', label: 'Cumpleaños', desc: 'Celebra tu día especial' },
  { id: 'corporativo', label: 'Corporativo', desc: 'Eventos de empresa' },
  { id: 'bautizo', label: 'Bautizo', desc: 'Momentos especiales' },
  { id: 'comunión', label: 'Comunion', desc: 'Celebraciones familiares' },
  { id: 'otro', label: 'Otro', desc: 'Personaliza tu evento' },
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
  
  const eventDate = (month && day && year) ? `${year}-${month}-${day.padStart(2, '0')}` : '';
  const canProceed = eventType && eventDate && adults >= 10;

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
      setTimeout(() => nextStep(), 50);
    } catch (err: any) {
      setError(err?.message || 'Error al validar los datos.');
      setIsLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-stone-200 bg-white focus:ring-2 focus:ring-[#C9A84C] focus:border-[#C9A84C] transition-all text-sm";
  const selectClass = inputClass;
  const cardClass = (active: boolean) =>
    `group relative p-4 rounded-xl border-2 text-center transition-all duration-200 cursor-pointer ${
      active
        ? 'border-[#C9A84C] bg-[#C9A84C]/8 shadow-md shadow-[#C9A84C]/15'
        : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-10"
    >
      <div className="text-center">
        <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Detalles del Evento
        </h2>
        <p className="text-stone-500 text-sm max-w-md mx-auto font-light">
          Cuéntanos qué tipo de celebración tienes en mente
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Event Type */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-3">Tipo de evento</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {EVENT_TYPES.map((et) => (
            <button
              key={et.id}
              type="button"
              onClick={() => setEventType(et.id)}
              className={cardClass(eventType === et.id)}
            >
              <div className={`text-sm font-semibold mb-0.5 ${
                eventType === et.id ? 'text-[#1A1A1A]' : 'text-stone-700'
              }`}>{et.label}</div>
              <div className="text-[11px] text-stone-400">{et.desc}</div>
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

      {/* Date */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-2">Fecha del evento</label>
        <div className="flex gap-2.5">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={selectClass}>
            <option value="">Mes</option>
            {MONTHS.map((m) => (<option key={m.v} value={m.v}>{m.n}</option>))}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)} className={selectClass}>
            <option value="">Día</option>
            {Array.from({ length: maxDays }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d.toString().padStart(2, '0')}>{d}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(e.target.value)} className={selectClass}>
            <option value="">Año</option>
            {yearsRange().map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>
      </div>

      {/* Guest Count */}
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-2">Comensales</label>
        <div className="flex gap-3">
          <div className="flex-1">
            <input type="number" min="10" max="300" value={guestCount} onChange={(e) => setGuestCount(e.target.value)} placeholder="Adultos" className={inputClass} />
          </div>
          <div className="flex-1">
            <input type="number" min="0" max="50" value={kidsCount} onChange={(e) => setKidsCount(e.target.value)} placeholder="Niños" className={inputClass} />
          </div>
        </div>
        <p className="text-xs text-stone-400 mt-1.5">Minimo 10 comensales adultos</p>
      </div>

      {/* Next Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleNext}
          disabled={!canProceed || isLoading}
          className={`px-8 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
            canProceed
              ? 'bg-[#1A1A1A] text-white hover:bg-stone-800 shadow-lg shadow-stone-900/20'
              : 'bg-stone-200 text-stone-400 cursor-not-allowed'
          }`}
        >
          {isLoading ? 'Procesando...' : 'Siguiente'}
        </button>
      </div>
    </motion.div>
  );
}
