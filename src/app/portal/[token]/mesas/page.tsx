'use client';
/**
 * EventFlow — Portal: Distribución de Mesas
 *
 * Página del portal del cliente para distribuir invitados en mesas.
 * Versión restringida del editor de mapa de mesas:
 * - Plano en solo lectura
 * - Mover invitados entre mesas: SÍ
 * - Editar plano: NO
 * - Solo invitados confirmados asignables
 * - Aforo no superable
 *
 * WP-27: Portal — Distribución de Mesas
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import PortalTableMap from '@/components/b2c/PortalTableMap';

interface PortalData {
  eventId: string;
  floorplanName: string;
  tables: any[];
  elements: any[];
  guests: any[];
  assignments: any[];
  isFrozen: boolean;
}

export default function PortalMesasPage() {
  const params = useParams();
  const token = params?.token as string;

  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Cargar datos ──
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/public/portal/${token}/tables`);
      const json = await res.json();

      if (!json.success) {
        setError(json.error || 'Error al cargar datos');
        return;
      }

      setData(json.data);
      setError(null);
    } catch (err) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Guardar asignaciones ──
  const handleSave = async (assignments: { tableId: string; guestId: string; seatNumber?: number }[]) => {
    const res = await fetch(`/api/public/portal/${token}/tables/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignments }),
    });

    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || 'Error al guardar');
    }

    // Recargar datos para sincronizar
    await loadData();
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F1E7] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-[#5A4A38]">Cargando plano de mesas...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error) {
    return (
      <div className="min-h-screen bg-[#F6F1E7] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-[#8B5B5B]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#8B5B5B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="font-serif text-lg text-[#6B2737] font-semibold mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            No se pudo cargar
          </h2>
          <p className="text-sm text-[#5A4A38] mb-4">{error}</p>
          <button onClick={loadData}
            className="px-4 py-2 bg-[#C9A84C] text-[#1A1208] text-xs font-bold rounded
              hover:bg-[#F0C060] transition-colors uppercase tracking-wider">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ── Sin datos ──
  if (!data || data.tables.length === 0) {
    return (
      <div className="min-h-screen bg-[#F6F1E7] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 bg-[#C9A84C]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-[#C9A84C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <h2 className="font-serif text-lg text-[#6B2737] font-semibold mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}>
            Plano no disponible
          </h2>
          <p className="text-sm text-[#5A4A38]">
            Tu evento aún no tiene un plano de mesas configurado.
            <br />Contacta con tu responsable de evento.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="h-screen flex flex-col">
      <PortalTableMap
        tables={data.tables}
        guests={data.guests}
        assignments={data.assignments}
        isFrozen={data.isFrozen}
        floorplanName={data.floorplanName}
        onSave={handleSave}
      />
    </div>
  );
}
