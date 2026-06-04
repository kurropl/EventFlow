'use client';
/**
 * J.Benitez — Public Guest Form
 * 
 * Página pública donde el cliente rellena los datos de sus invitados
 * (nombres, grupo/mesa, tipo menú, intolerancias) cuando acepta el presupuesto.
 * 
 * Acceso: /invitados/[token] donde token = event.client_token
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

const DIET_OPTIONS = [
  { id: 'celiaco', label: 'Celíaco', icon: '🌾' },
  { id: 'vegetariano', label: 'Vegetariano', icon: '🥬' },
  { id: 'vegano', label: 'Vegano', icon: '🌱' },
  { id: 'sin_lactosa', label: 'Sin lactosa', icon: '🥛' },
  { id: 'alergico_frutos_secos', label: 'Alergia frutos secos', icon: '🥜' },
  { id: 'alergico_marisco', label: 'Alergia marisco', icon: '🦐' },
  { id: 'otros', label: 'Otra restricción', icon: '⚠️' },
];

const MENU_TYPES = [
  { value: 'adulto', label: 'Adulto', icon: '👤' },
  { value: 'nino', label: 'Niño/a', icon: '👶' },
  { value: 'bebe', label: 'Bebé', icon: '🍼' },
];

const LINEN_OPTIONS = [
  { value: 'blanco', label: 'Blanco' },
  { value: 'marfil', label: 'Marfil' },
  { value: 'dorado', label: 'Dorado' },
  { value: 'negro', label: 'Negro' },
  { value: 'azul', label: 'Azul' },
  { value: 'rojo', label: 'Rojo' },
  { value: 'personalizado', label: 'Personalizado' },
];
const CENTERPIECE_OPTIONS = [
  { value: 'flores_naturales', label: 'Flores naturales' },
  { value: 'flores_sinteticas', label: 'Flores sintéticas' },
  { value: 'velas', label: 'Velas' },
  { value: 'arreglos_mezcla', label: 'Arreglos mixtos' },
  { value: 'personalizado', label: 'Personalizado' },
];

interface GuestFormEntry {
  name: string;
  group_name: string;
  menu_type: string;
  dietary: string[];
  notes: string;
  linen_type?: string;
  centerpiece?: string;
}

interface EventInfo {
  id: string;
  client_name: string;
  event_date: string;
  event_type: string;
  guest_count: number;
  kids_count: number;
  status: string;
}

interface FormResponse {
  event: EventInfo;
  form: {
    guests: GuestFormEntry[];
    client_name: string;
    email: string;
    submitted_at: string | null;
  };
}

export default function PublicGuestForm() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [clientName, setClientName] = useState('');
  const [email, setEmail] = useState('');
  const [guests, setGuests] = useState<GuestFormEntry[]>([]);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/guest-forms?event_token=${token}`);
        const data = await res.json();
        if (!data.success) {
          setError(data.error || 'No se pudo cargar el evento');
          return;
        }
        const ev = data.data.event;
        setEventInfo(ev);
        if (data.data.form) {
          setClientName(data.data.form.client_name || '');
          setEmail(data.data.form.email || '');
          setGuests(data.data.form.guests || []);
          if (data.data.form.submitted_at) {
            setSubmitted(true);
          }
        }
      } catch {
        setError('Error de conexión');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const addGuest = () => {
    setGuests(prev => [...prev, { name: '', group_name: '', menu_type: 'adulto', dietary: [], notes: '', linen_type: '', centerpiece: '' }]);
  };

  const removeGuest = (idx: number) => {
    setGuests(prev => prev.filter((_, i) => i !== idx));
  };

  const updateGuest = (idx: number, field: keyof GuestFormEntry, value: any) => {
    setGuests(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g));
  };

  const toggleDiet = (idx: number, dietId: string) => {
    setGuests(prev => prev.map((g, i) => {
      if (i !== idx) return g;
      const current = g.dietary || [];
      return { ...g, dietary: current.includes(dietId) ? current.filter(d => d !== dietId) : [...current, dietId] };
    }));
  };

  const saveForm = async () => {
    if (!clientName.trim()) { setError('Tu nombre es obligatorio'); return; }
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/guest-forms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_token: token, client_name: clientName, email, guests }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error || 'Error al guardar'); return; }
      setSuccessMsg('¡Datos guardados correctamente!');
      if (guests.length > 0 && !submitted) {
        setSubmitted(true);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d: string) => {
    const iso = (d || '').slice(0, 10);
    const [y, m, day] = iso.split('-');
    const M = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return y && m && day ? `${parseInt(day)} de ${M[parseInt(m) - 1]} de ${y}` : iso;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 border-[#C9A84C] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#9CA3AF]">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!eventInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            <span className="font-bold text-xl text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
          </div>
          <h1 className="text-xl font-serif text-[#1A1A1A] mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Enlace no válido</h1>
          <p className="text-sm text-[#9CA3AF] mb-6">Este enlace ya no está disponible o ha caducado. Contacta con J.Benitez si necesitas uno nuevo.</p>
          <a href="/" className="text-sm font-medium text-[#C9A84C] hover:underline">Volver al inicio →</a>
        </div>
      </div>
    );
  }

  const totalGuests = guests.length;
  const confirmedGuests = guests.filter(g => g.name.trim()).length;

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <header className="bg-white border-b border-[#ECECF1]">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
            <span className="font-bold text-sm text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>JB</span>
          </div>
          <div>
            <h1 className="text-base font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>J. Benitez</h1>
            <p className="text-[11px] text-[#9CA3AF]">Lista de invitados</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Event info card */}
        <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">🎉</span>
            <h2 className="font-serif text-lg text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {eventInfo.event_type}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-[#9CA3AF] text-xs block">Fecha</span>
              <span className="text-[#1A1A1A] font-medium">{fmtDate(eventInfo.event_date)}</span>
            </div>
            <div>
              <span className="text-[#9CA3AF] text-xs block">Comensales previstos</span>
              <span className="text-[#1A1A1A] font-medium">{eventInfo.guest_count} adultos{eventInfo.kids_count > 0 ? ` + ${eventInfo.kids_count} niños` : ''}</span>
            </div>
          </div>
          {submitted && (
            <div className="mt-3 p-3 bg-[#EFFAF2] rounded-xl text-sm text-[#15803D] font-medium">
              ✓ Ya has enviado tus datos de invitados. Puedes editarlos aquí.
            </div>
          )}
        </div>

        {/* Client info */}
        <div className="bg-white rounded-2xl border border-[#ECECF1] p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3">
          <h3 className="font-semibold text-sm text-[#1A1A1A]">Datos del cliente</h3>
          <div>
            <label className="block text-[12px] font-medium text-[#6B7280] mb-1">Nombre completo *</label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
              placeholder="Tu nombre completo"
            />
          </div>
          <div>
            <label className="block text-[12px] font-medium text-[#6B7280] mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
              placeholder="tu@email.com"
            />
          </div>
        </div>

        {/* Guests list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-[#1A1A1A]">
              Invitados ({totalGuests})
            </h3>
            <button
              onClick={addGuest}
              className="text-sm font-medium text-white px-4 py-2 rounded-xl shadow-sm flex items-center gap-1.5"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
            >
              <span className="text-lg leading-none">+</span> Añadir
            </button>
          </div>

          {guests.length === 0 && (
            <div className="bg-white rounded-2xl border border-[#ECECF1] p-8 text-center">
              <p className="text-sm text-[#9CA3AF] mb-3">Aún no has añadido invitados</p>
              <p className="text-xs text-[#C7C7CF]">Pulsa "Añadir" para comenzar</p>
            </div>
          )}

          {guests.map((guest, idx) => (
            <div key={idx} className="bg-white rounded-2xl border border-[#ECECF1] p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] space-y-3">
              {/* Guest header */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#9CA3AF]">Invitado {idx + 1}</span>
                <button
                  onClick={() => removeGuest(idx)}
                  className="p-1.5 rounded-lg text-[#C7C7CF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-all"
                  title="Eliminar invitado"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Name + Group */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Nombre *</label>
                  <input
                    value={guest.name}
                    onChange={(e) => updateGuest(idx, 'name', e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
                    placeholder="Nombre del invitado"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Grupo / Mesa</label>
                  <input
                    value={guest.group_name}
                    onChange={(e) => updateGuest(idx, 'group_name', e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
                    placeholder="Familia novia..."
                  />
                </div>
              </div>

              {/* Menu type */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Tipo</label>
                <div className="flex gap-2">
                  {MENU_TYPES.map(mt => (
                    <button
                      key={mt.value}
                      onClick={() => updateGuest(idx, 'menu_type', mt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        guest.menu_type === mt.value
                          ? 'bg-[#FBF6E9] text-[#8A6D1F] border-[#E8DCC8]'
                          : 'bg-white text-[#9CA3AF] border-[#ECECF1] hover:bg-[#F9F9FB]'
                      }`}
                    >
                      <span>{mt.icon}</span>
                      <span>{mt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dietary */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Intolerancias / Alergias</label>
                <div className="flex flex-wrap gap-1.5">
                  {DIET_OPTIONS.map(d => {
                    const on = (guest.dietary || []).includes(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() => toggleDiet(idx, d.id)}
                        className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-all ${
                          on
                            ? 'bg-[#FEF3F3] text-[#B91C1C] border-[#FAD4D4] font-medium'
                            : 'bg-white text-[#9CA3AF] border-[#ECECF1] hover:bg-[#F9F9FB]'
                        }`}
                      >
                        {d.icon} {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Linen & Centerpiece */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Mantelería</label>
                  <select
                    value={guest.linen_type || ''}
                    onChange={(e) => updateGuest(idx, 'linen_type', e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
                  >
                    <option value="">Sin asignar</option>
                    {LINEN_OPTIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Centro de mesa</label>
                  <select
                    value={guest.centerpiece || ''}
                    onChange={(e) => updateGuest(idx, 'centerpiece', e.target.value)}
                    className="w-full px-2.5 py-2 rounded-lg border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
                  >
                    <option value="">Sin asignar</option>
                    {CENTERPIECE_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-medium text-[#6B7280] mb-1">Notas</label>
                <input
                  value={guest.notes}
                  onChange={(e) => updateGuest(idx, 'notes', e.target.value)}
                  className="w-full px-2.5 py-2 rounded-lg border border-[#ECECF1] text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] transition-all"
                  placeholder="Notas adicionales..."
                />
              </div>
            </div>
          ))}
        </div>

        {/* Save button */}
        <div className="pb-8">
          <button
            onClick={saveForm}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold text-white shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Guardar lista de invitados
              </>
            )}
          </button>

          {error && <p className="text-sm text-[#DC2626] text-center mt-3">{error}</p>}
          {successMsg && <p className="text-sm text-[#15803D] text-center mt-3 font-medium">{successMsg}</p>}
        </div>
      </main>
    </div>
  );
}
