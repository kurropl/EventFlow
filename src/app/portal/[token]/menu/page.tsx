'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Icon from '@/components/shared/Icon';
import { formatEUR, formatDate } from '@/lib/format';

interface PortalDish {
  id: string;
  dish_id: string;
  dish_name: string;
  dish_description: string | null;
  variant_tag: string | null;
  dish_allergens: string[] | null;
}

interface PortalSection {
  id: string;
  name: string;
  position: number;
  dishes: PortalDish[];
}

interface PortalMenu {
  id: string;
  name: string;
  version: number;
  price_per_pax: number;
  description: string | null;
  sections: PortalSection[];
  client_name?: string;
  event_date?: string;
  is_frozen?: boolean;
}

const fmtEUR = formatEUR;


export default function PortalMenuPage() {
  const params = useParams();
  const token = params.token as string;
  const [menu, setMenu] = useState<PortalMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch(`/api/portal/${token}/menu`)
      .then(r => r.json())
      .then(d => {
        if (!active) return;
        if (d.success) setMenu(d.data);
        else setError(d.error || 'No se pudo cargar el menú');
      })
      .catch(() => active && setError('Error de conexión'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-white/60 rounded-xl animate-pulse" />
        <div className="h-40 bg-white/60 rounded-xl animate-pulse" />
        <div className="h-40 bg-white/60 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !menu) {
    return (
      <div className="bg-white rounded-xl border border-divider/50 p-6">
        <div className="flex items-center gap-3">
          <Icon name="alertCircle" className="w-5 h-5 text-danger" />
          <p className="text-sm text-ink-soft">{error || 'Menú no disponible'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabecera del menú */}
      <div className="bg-white rounded-xl border border-divider/50 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink mb-1">{menu.name}</h2>
            <p className="text-sm text-ink-soft">
              {menu.client_name || 'Tu evento'} · {menu.event_date ? formatDate(menu.event_date) : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-gold">{fmtEUR(menu.price_per_pax)}</p>
            <p className="text-[11px] text-ink-soft">por persona</p>
          </div>
        </div>
        {menu.description && <p className="mt-3 text-sm text-ink-soft">{menu.description}</p>}
        {menu.is_frozen && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-gold/10 text-gold-dark">
            <Icon name="alertTriangle" className="w-3 h-3" />
            Menú congelado — no se admiten cambios
          </p>
        )}
      </div>

      {/* Secciones del menú */}
      {menu.sections.map(section => (
        <div key={section.id} className="bg-white rounded-xl border border-divider/50 overflow-hidden">
          <div className="px-4 py-2.5 bg-cream/50 border-b border-divider/40">
            <h3 className="text-sm font-semibold text-ink">{section.name}</h3>
          </div>
          <div className="divide-y divide-divider/40">
            {section.dishes.map((dish, idx) => (
              <div key={dish.id || idx} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-ink">{dish.dish_name}</p>
                    {dish.dish_description && <p className="text-xs text-ink-soft mt-0.5">{dish.dish_description}</p>}
                  </div>
                  {dish.variant_tag && dish.variant_tag !== 'default' && (
                    <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold-dark font-medium capitalize">
                      {dish.variant_tag}
                    </span>
                  )}
                </div>
                {dish.dish_allergens && dish.dish_allergens.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {dish.dish_allergens.map((a, i) => (
                      <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-danger/10 text-danger">
                        {a}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {section.dishes.length === 0 && (
              <p className="px-4 py-3 text-xs text-ink-soft">Sin platos en esta sección.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
