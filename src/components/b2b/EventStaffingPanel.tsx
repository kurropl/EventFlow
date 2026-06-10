'use client';
/**
 * EventFlow — Panel de Personal por evento (dentro de Operaciones)
 *
 * Muestra el "escandallo de personal" de un evento (líneas de necesidad por rol),
 * su cobertura en tiempo real (asignados / plazas), y permite difundir la oferta
 * por WhatsApp. Es el puente entre Operaciones y el módulo de Staffing.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Icon from '../shared/Icon';

interface StaffingLine {
  id: string;
  role: string;
  slots_needed: number;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  uniform: string | null;
  status: 'open' | 'filled' | 'cancelled';
  assigned_count: number;
  offers_sent: number;
}

interface Props {
  eventId: string;
  eventDate: string;
  guestCount: number;
  waitersSuggested?: number;
  canEdit?: boolean;
}

const ROLE_LABEL: Record<string, string> = {
  camarero: 'Camareros', barman: 'Barman', azafata: 'Azafatas', montaje: 'Montaje', dj: 'DJ',
};

const fmtTime = (d: string | null) => {
  if (!d) return null;
  const date = new Date(d);
  return isNaN(date.getTime()) ? null : date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
};

export default function EventStaffingPanel({ eventId, eventDate, guestCount, waitersSuggested, canEdit = true }: Props) {
  const [lines, setLines] = useState<StaffingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/staffing/lines?event_id=${eventId}`);
      const j = await r.json();
      if (j.success) setLines(j.data || []);
      else setError(j.error || 'No se pudo cargar el personal');
    } catch {
      setError('No se pudo cargar el personal');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  // Difundir oferta por WhatsApp para una línea
  const broadcast = async (lineId: string) => {
    setBusy(lineId);
    try {
      const r = await fetch(`/api/staffing/lines/${lineId}/offers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (j.success) {
        const d = j.data || {};
        flash(`Oferta difundida: ${d.messaged ?? d.total_sent ?? 0} mensajes de WhatsApp enviados${d.skipped_count ? ` · ${d.skipped_count} ya tenían oferta` : ''}.`);
        load();
      } else {
        flash(j.error || 'No se pudo difundir la oferta');
      }
    } catch {
      flash('Error de red al difundir');
    } finally {
      setBusy(null);
    }
  };

  // Auto-generar el escandallo de personal a partir del evento
  const autoGenerate = async () => {
    setBusy('generate');
    const dateOnly = (eventDate || '').slice(0, 10);
    const camareros = Math.max(1, waitersSuggested || Math.ceil(guestCount / 15));
    const azafatas = guestCount > 100 ? 2 : 1;
    const barman = Math.max(1, Math.ceil(guestCount / 75));
    const defs = [
      { role: 'camarero', slots_needed: camareros, start: '18:00', end: '02:00', location: 'Sala principal', uniform: 'Traje negro + camisa blanca' },
      { role: 'barman', slots_needed: barman, start: '17:00', end: '02:00', location: 'Zona bar', uniform: 'Chaleco negro + delantal' },
      { role: 'azafata', slots_needed: azafatas, start: '19:00', end: '01:00', location: 'Entrada y recepción', uniform: 'Uniforme de protocolo' },
    ];
    try {
      for (const d of defs) {
        await fetch('/api/staffing/lines', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event_id: eventId,
            role: d.role,
            slots_needed: d.slots_needed,
            start_time: dateOnly ? `${dateOnly}T${d.start}:00` : null,
            end_time: dateOnly ? `${dateOnly}T${d.end}:00` : null,
            location: d.location,
            uniform: d.uniform,
          }),
        });
      }
      flash('Escandallo de personal generado.');
      load();
    } catch {
      flash('No se pudo generar el personal');
    } finally {
      setBusy(null);
    }
  };

  const totalNeeded = lines.reduce((s, l) => s + (l.slots_needed || 0), 0);
  const totalAssigned = lines.reduce((s, l) => s + (l.assigned_count || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-[#1A1A2E]">
          <Icon name="staffing" className="w-4 h-4 inline mr-1.5" /> Personal del evento (Escandallo de personal)
        </h3>
        <div className="flex items-center gap-2">
          {lines.length > 0 && (
            <span className="text-[11px] text-[#6B7280]">{totalAssigned}/{totalNeeded} plazas cubiertas</span>
          )}
          <button onClick={load} className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#6B7280] hover:bg-[#F5F5F8] transition-colors" title="Actualizar">
            <Icon name="refreshCw" className="w-3.5 h-3.5" />
          </button>
          <Link href={`/admin/staffing?event_id=${eventId}`} className="text-[11px] font-medium text-[#A88A3A] hover:underline">Gestionar →</Link>
        </div>
      </div>

      {toast && (
        <div className="text-[12px] px-3 py-2 rounded-lg bg-[#EFFAF2] text-[#15803D] border border-[#D1FAE5]">{toast}</div>
      )}
      {error && (
        <div className="text-[12px] px-3 py-2 rounded-lg bg-red-50 text-red-700 border border-red-200 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={load} className="underline text-xs ml-3">Reintentar</button>
        </div>
      )}

      {loading && <div className="text-center text-sm text-[#9CA3AF] py-6">Cargando personal…</div>}

      {!loading && lines.length === 0 && !error && (
        <div className="p-5 rounded-xl bg-[#FAF8F5] border border-dashed border-[#E0D3A8] text-center">
          <p className="text-sm text-[#6B7280] mb-3">Este evento aún no tiene necesidades de personal definidas.</p>
          {canEdit && (
            <button onClick={autoGenerate} disabled={busy === 'generate'}
              className="px-4 py-2 text-[12px] font-medium text-white rounded-lg shadow-sm disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
              {busy === 'generate' ? 'Generando…' : 'Auto-generar personal'}
            </button>
          )}
        </div>
      )}

      {!loading && lines.length > 0 && (
        <div className="space-y-2">
          {lines.map((l) => {
            const covered = l.assigned_count >= l.slots_needed;
            const pct = l.slots_needed > 0 ? Math.min(100, Math.round((l.assigned_count / l.slots_needed) * 100)) : 0;
            const t1 = fmtTime(l.start_time), t2 = fmtTime(l.end_time);
            return (
              <div key={l.id} className="p-3.5 rounded-xl bg-white border border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-[#1A1A2E]">{ROLE_LABEL[l.role] || l.role}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${covered ? 'bg-[#EFFAF2] text-[#15803D]' : 'bg-[#FFF8EC] text-[#B45309]'}`}>
                      {covered ? 'Cubierto' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">
                    {t1 && t2 ? `${t1}–${t2}` : 'Horario por definir'}
                    {l.location ? ` · ${l.location}` : ''}
                    {l.uniform ? ` · ${l.uniform}` : ''}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-28">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[#6B7280] tabular-nums">{l.assigned_count}/{l.slots_needed}</span>
                      {l.offers_sent > 0 && <span className="text-[#9CA3AF]">{l.offers_sent} oferta(s)</span>}
                    </div>
                    <div className="h-1.5 rounded-full bg-[#F0F0F4] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: covered ? '#16A34A' : '#C9A84C' }} />
                    </div>
                  </div>
                  {canEdit && l.status === 'open' && (
                    <button onClick={() => broadcast(l.id)} disabled={busy === l.id}
                      className="px-3 py-1.5 text-[11px] font-medium rounded-lg border border-[#25D366]/40 text-[#128C4B] bg-[#25D366]/10 hover:bg-[#25D366]/20 transition-colors disabled:opacity-60 whitespace-nowrap">
                      {busy === l.id ? 'Enviando…' : 'Difundir WhatsApp'}
                    </button>
                  )}
                  {l.status === 'filled' && (
                    <span className="text-[11px] font-medium text-[#15803D] whitespace-nowrap">✓ Completo</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
