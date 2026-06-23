'use client';

/**
 * BriefingCamareros — Panel de briefing para el evento
 *
 * Genera y muestra el briefing completo:
 * - Datos del evento
 * - Menú por pase
 * - Asignación de personal (zonas)
 * - Cronograma
 * - Resumen mesas/invitados
 *
 * J.Benitez — EventFlow ERP
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Printer, RefreshCw, Send, Users, UtensilsCrossed, Clock, MapPin, ClipboardList, AlertTriangle } from 'lucide-react';

interface BriefingData {
  id: string;
  event_id: string;
  version: number;
  status: string;
  generated_at: string;
  sent_at: string | null;
  content: {
    event: any;
    menu: any[];
    staffing: any[];
    timeline: any[];
    floorplan: any;
    tables: { total: number; total_capacity: number };
    guests: { confirmed: number; pending: number };
  };
}

export default function BriefingCamareros({ eventId }: { eventId: string }) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const printRef = useRef<HTMLDivElement>(null);

  const loadBriefing = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/briefing/${eventId}`);
      const data = await res.json();
      if (data.success) setBriefing(data.data);
      else setError(data.error || 'Error al cargar briefing');
    } catch {
      setError('Error de conexión');
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { loadBriefing(); }, [loadBriefing]);

  const regenerate = async () => {
    setGenerating(true);
    setMessage('');
    try {
      const res = await fetch(`/api/briefing/${eventId}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBriefing(data.data);
        setMessage('Briefing regenerado');
      } else setMessage('Error: ' + (data.error || ''));
    } catch {
      setMessage('Error de conexión');
    }
    setGenerating(false);
  };

  const markSent = async () => {
    setSending(true);
    setMessage('');
    try {
      const res = await fetch(`/api/briefing/${eventId}/send`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBriefing(prev => prev ? { ...prev, status: 'sent', sent_at: new Date().toISOString() } : prev);
        setMessage('Briefing marcado como enviado');
      } else setMessage('Error: ' + (data.error || ''));
    } catch {
      setMessage('Error de conexión');
    }
    setSending(false);
  };

  const content = briefing?.content;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-stone-400 text-xs">
        <div className="w-5 h-5 rounded-full border-2 border-stone-300 border-t-stone-600 animate-spin mr-2" />
        Generando briefing...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
        <AlertTriangle className="w-4 h-4 inline mr-1" />
        {error}
      </div>
    );
  }

  if (!content) {
    return (
      <div className="text-center py-8 text-stone-400 text-xs">Selecciona un evento para generar el briefing</div>
    );
  }

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center justify-between mb-4 bg-stone-50 rounded-lg p-2 no-print">
        <div className="flex items-center gap-2">
          <button onClick={regenerate} disabled={generating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-medium hover:bg-stone-50 disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
            Regenerar
          </button>
          {briefing?.status === 'draft' && (
            <button onClick={markSent} disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50">
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Enviando...' : 'Marcar enviado'}
            </button>
          )}
          {message && <span className="text-xs text-stone-500">{message}</span>}
        </div>
        <button onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 text-white text-xs font-medium hover:bg-stone-700">
          <Printer className="w-3.5 h-3.5" />
          Imprimir
        </button>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-3 text-[10px]">
        <span className={`px-2 py-0.5 rounded-full font-medium ${
          briefing?.status === 'sent' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {briefing?.status === 'sent' ? '🔵 Enviado ' + new Date(briefing.sent_at!).toLocaleDateString('es-ES') : '⚪ Borrador'}
        </span>
        <span className="text-stone-400">v{briefing?.version || 1} · {new Date(briefing?.generated_at || '').toLocaleString('es-ES')}</span>
      </div>

      {/* ═══ PRINT CONTENT ═══ */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        .briefing-section { break-inside: avoid; }
      `}</style>

      <div ref={printRef} className="space-y-4 text-stone-800" style={{ fontSize: '11px' }}>
        {/* Header */}
        <div className="border-b-2 border-stone-800 pb-3 mb-2">
          <h1 className="text-lg font-bold tracking-tight">BRIEFING — {content.event?.client_name || 'Evento'}</h1>
          <div className="grid grid-cols-4 gap-4 mt-2 text-[10px]">
            <div><span className="text-stone-400">Fecha:</span> {new Date(content.event?.event_date).toLocaleDateString('es-ES')}</div>
            <div><span className="text-stone-400">Tipo:</span> {content.event?.event_type || '-'}</div>
            <div><span className="text-stone-400">Comensales:</span> {content.event?.guest_count || 0} ({content.event?.kids_count || 0} niños)</div>
            <div><span className="text-stone-400">Barra:</span> {content.event?.bar_hours || 0}h</div>
          </div>
        </div>

        {/* Menu */}
        <div className="briefing-section">
          <h2 className="font-bold text-sm flex items-center gap-1.5 mb-2">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            Menú ({content.menu.length} items)
          </h2>
          {content.menu.length === 0 ? (
            <p className="text-[10px] text-stone-400">Sin menú asignado</p>
          ) : (
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-stone-300">
                  <th className="text-left p-1">Plato</th>
                  <th className="text-left p-1">Categoría</th>
                  <th className="text-right p-1">Cant.</th>
                  <th className="text-right p-1">Precio</th>
                  <th className="text-left p-1">Alérgenos</th>
                </tr>
              </thead>
              <tbody>
                {content.menu.map((item, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    <td className="p-1 font-medium">{item.name}</td>
                    <td className="p-1 text-stone-500">{item.category}</td>
                    <td className="text-right p-1">{item.quantity}</td>
                    <td className="text-right p-1">{Number(item.unit_price_pvp || 0).toFixed(2)}€</td>
                    <td className="p-1 text-amber-600 text-[9px]">
                      {Array.isArray(item.allergens) && item.allergens.length > 0
                        ? item.allergens.join(', ')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Staffing */}
        <div className="briefing-section">
          <h2 className="font-bold text-sm flex items-center gap-1.5 mb-2">
            <Users className="w-3.5 h-3.5" />
            Personal ({content.staffing.length})
          </h2>
          {content.staffing.length === 0 ? (
            <p className="text-[10px] text-stone-400">Sin personal asignado</p>
          ) : (
            <div className="grid grid-cols-2 gap-1">
              {content.staffing.map((s, i) => (
                <div key={i} className="p-2 border border-stone-200 rounded text-[10px]">
                  <p className="font-medium">{s.worker_name}</p>
                  <p className="text-stone-400">{s.role} {s.location ? '— ' + s.location : ''}</p>
                  {s.notes && <p className="text-stone-400 text-[9px] mt-0.5">{s.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="briefing-section">
          <h2 className="font-bold text-sm flex items-center gap-1.5 mb-2">
            <Clock className="w-3.5 h-3.5" />
            Cronograma
          </h2>
          {content.timeline.length === 0 ? (
            <p className="text-[10px] text-stone-400">Sin planificación</p>
          ) : (
            <div className="space-y-1">
              {content.timeline.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-1.5 border border-stone-100 rounded text-[10px]">
                  <span className="font-mono font-bold text-stone-500 w-16 shrink-0">{t.planned_time || '-'}</span>
                  <div className="flex-1">
                    <p className="font-medium">{t.title}</p>
                    {t.description && <p className="text-stone-400">{t.description}</p>}
                  </div>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${t.completed ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                    {t.completed ? 'Hecho' : t.category}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tables & Guests */}
        <div className="briefing-section grid grid-cols-3 gap-3">
          <div className="p-3 border border-stone-200 rounded">
            <p className="font-bold text-[10px] uppercase tracking-wider text-stone-500">Mesas</p>
            <p className="text-lg font-bold font-mono">{content.tables?.total || 0}</p>
            <p className="text-[9px] text-stone-400">Capacidad: {content.tables?.total_capacity || 0} plazas</p>
          </div>
          <div className="p-3 border border-stone-200 rounded">
            <p className="font-bold text-[10px] uppercase tracking-wider text-stone-500">Invitados</p>
            <p className="text-lg font-bold font-mono text-emerald-600">{content.guests?.confirmed || 0}</p>
            <p className="text-[9px] text-stone-400">Confirmados ({content.guests?.pending || 0} pendientes)</p>
          </div>
          <div className="p-3 border border-stone-200 rounded">
            <p className="font-bold text-[10px] uppercase tracking-wider text-stone-500">Comensales</p>
            <p className="text-lg font-bold font-mono">{content.event?.guest_count || 0}</p>
            <p className="text-[9px] text-stone-400">{content.event?.kids_count || 0} niños</p>
          </div>
        </div>

        {/* Notes */}
        {content.event?.notes && (
          <div className="briefing-section p-3 bg-amber-50 border border-amber-200 rounded text-[10px]">
            <p className="font-medium text-amber-800 mb-1">📝 Notas del evento</p>
            <p className="text-amber-700">{content.event.notes}</p>
          </div>
        )}

        {/* Details */}
        <div className="briefing-section grid grid-cols-2 gap-2 text-[10px]">
          <div className="p-2 border border-stone-200 rounded">
            <span className="text-stone-400">Mantelería:</span> {content.event?.linen_type || 'blanco'}
          </div>
          <div className="p-2 border border-stone-200 rounded">
            <span className="text-stone-400">Centro de mesa:</span> {content.event?.centerpiece || 'floral'}
          </div>
        </div>
      </div>
    </div>
  );
}