'use client';

/**
 * EventFlow — Checklist Día D
 * Quick checklist panel for day-of event execution.
 * Reads event_id from URL search params.
 */

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/shared/Icon';

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  done: boolean;
  time?: string;
}

const DEFAULT_CATEGORIES = [
  {
    category: 'Preparación de cocina',
    items: [
      'Confirmar ingredientes del escandallo',
      'Revisar stock de bebidas',
      'Preparar mesas de trabajo',
      'Verificar cámaras frigoríficas',
    ],
  },
  {
    category: 'Sala y decoración',
    items: [
      'Colocar mantelería',
      'Montar centros de mesa',
      'Revisar iluminación',
      'Verificar música/sonido',
    ],
  },
  {
    category: 'Personal',
    items: [
      'Briefing de camareros',
      'Confirmar horarios',
      'Asignar mesas finales',
      'Revisar uniformes',
    ],
  },
  {
    category: 'Servicio',
    items: [
      'Cocktail de bienvenida',
      'Primer plato servido',
      'Segundo plato servido',
      'Postre servido',
      'Café y digestivo',
      'Cierre de servicio',
    ],
  },
];

function ChecklistInner() {
  const params = useSearchParams();
  const eventId = params.get('event_id') || '';
  const storageKey = `checklist_${eventId}`;

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!eventId) { setLoaded(true); return; }
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setItems(JSON.parse(saved));
      } else {
        // Generate defaults
        const generated: ChecklistItem[] = [];
        DEFAULT_CATEGORIES.forEach(cat => {
          cat.items.forEach((label, i) => {
            generated.push({
              id: `${cat.category}-${i}`,
              label,
              category: cat.category,
              done: false,
            });
          });
        });
        setItems(generated);
      }
    } catch {
      // fallback
    }
    setLoaded(true);
  }, [eventId, storageKey]);

  useEffect(() => {
    if (loaded && eventId && items.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(items));
    }
  }, [items, loaded, eventId, storageKey]);

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, done: !it.done } : it));
  };

  const categories = useMemo(() => {
    const map: Record<string, ChecklistItem[]> = {};
    items.forEach(it => {
      if (!map[it.category]) map[it.category] = [];
      map[it.category].push(it);
    });
    return Object.entries(map);
  }, [items]);

  const totalDone = items.filter(it => it.done).length;
  const pct = items.length > 0 ? Math.round((totalDone / items.length) * 100) : 0;

  if (!eventId) {
    return (
      <div className="space-y-6">
        <div className="text-center py-20">
          <Icon name="clipboardCheck" className="w-12 h-12 mx-auto text-[#E0D3A8] mb-3"/>
          <p className="text-lg font-serif text-[#1A1A1A]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Selecciona un evento
          </p>
          <p className="text-sm text-[#6B7280] mt-1">Abre el checklist desde el detalle de un evento en Operaciones.</p>
          <Link href="/admin/operations" className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-[#C9A84C] hover:underline">
            <Icon name="arrowLeft" className="w-4 h-4"/> Ir a Operaciones
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/operations" className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
          <Icon name="arrowLeft" className="w-4 h-4"/>
          <span className="text-[12px] font-medium text-[#6B7280]">Volver</span>
        </Link>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-[#1A1A2E] flex items-center gap-2">
            <Icon name="clipboardCheck" className="w-5 h-5 text-[#C9A84C]"/>
            Checklist Día D
          </h2>
          <p className="text-xs text-[#6B7280]">Evento: {eventId}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-[#C9A84C]">{pct}%</div>
          <div className="text-[10px] text-[#9CA3AF]">{totalDone}/{items.length} tareas</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[#F0F0F4] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #C9A84C, #A88A3A)' }}/>
      </div>

      {/* Category sections */}
      <div className="space-y-5">
        {categories.map(([cat, catItems]) => {
          const catDone = catItems.filter(it => it.done).length;
          return (
            <div key={cat} className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden">
              <div className="px-5 py-3 border-b border-[#F0F0F4] flex items-center justify-between">
                <h3 className="font-semibold text-sm text-[#1A1A1A]">{cat}</h3>
                <span className="text-[11px] font-medium text-[#C9A84C]">{catDone}/{catItems.length}</span>
              </div>
              <div className="divide-y divide-[#F2F2F5]">
                {catItems.map(item => (
                  <button key={item.id} onClick={() => toggleItem(item.id)}
                    className={`w-full px-5 py-3 flex items-center gap-3 text-left transition-colors ${item.done ? 'bg-[#F0FDF4]' : 'hover:bg-[#FAFAFC]'}`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${item.done ? 'bg-[#C9A84C] border-[#C9A84C]' : 'border-[#D1D5DB]'}`}>
                      {item.done && <Icon name="check" className="w-3 h-3 text-white"/>}
                    </div>
                    <span className={`text-sm ${item.done ? 'text-[#9CA3AF] line-through' : 'text-[#1A1A1A] font-medium'}`}>
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChecklistPanel() {
  return (
    <Suspense fallback={<div className="p-6 animate-pulse"><div className="h-64 bg-stone-100 rounded-xl" /></div>}>
      <ChecklistInner />
    </Suspense>
  );
}
