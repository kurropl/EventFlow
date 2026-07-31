'use client';
/**
 * EventFlow — Portal: Menú y Variantes por Invitado (WP-28)
 *
 * /portal/[token]/menu
 *
 * El cliente ve su menú contratado (versión congelada) y asigna
 * variantes (infantil, celíaco, vegetariano, etc.) por invitado.
 *
 * REGLAS:
 * - NO puede cambiar de menú, solo asignar variantes
 * - Si el portal está congelado, solo lectura (423)
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// ============================================================
// Types
// ============================================================

interface PortalMenuDish {
  id: string;
  dish_id: string;
  variant_tag: string | null;
  position: number;
  notes: string | null;
  dish_name: string;
  dish_category: string | null;
  dish_description: string | null;
  dish_allergens: string[] | null;
  dish_pvp: number | null;
}

interface PortalMenuSection {
  id: string;
  name: string;
  position: number;
  dishes: PortalMenuDish[];
}

interface PortalMenuData {
  event_id: string;
  event_menu_id: string;
  menu: {
    id: string;
    name: string;
    version: number;
    price_per_pax: number;
    description: string | null;
    cost_per_pax: number;
  };
  sections: PortalMenuSection[];
  pax: number;
  price_snapshot: number;
  client_name: string;
  event_date: string;
  is_frozen: boolean;
}

interface Guest {
  id: string;
  name: string;
  rsvp: string;
  menu_type: string;
  dietary: string[];
  group_name: string | null;
}

interface GuestVariant {
  id: string;
  guest_id: string;
  variant_type: string;
  section_id: string | null;
  dish_id: string | null;
  notes: string | null;
  guest_name: string;
  guest_rsvp: string;
}

interface VariantOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

// ============================================================
// Constants
// ============================================================

const VARIANT_OPTIONS: VariantOption[] = [
  { id: 'infantil', label: 'Infantil', icon: '🧒', description: 'Porción reducida, sin especias' },
  { id: 'celiaco', label: 'Celíaco', icon: '🌾', description: 'Sin gluten, ingredientes certificados' },
  { id: 'vegetariano', label: 'Vegetariano', icon: '🥗', description: 'Sin carne ni pescado' },
  { id: 'vegano', label: 'Vegano', icon: '🌿', description: 'Sin productos animales' },
  { id: 'sin_lactosa', label: 'Sin lactosa', icon: '🥛', description: 'Sin lácteos' },
  { id: 'sin_frutos_secos', label: 'Sin frutos secos', icon: '🥜', description: 'Sin frutos secos' },
  { id: 'personalizado', label: 'Personalizado', icon: '✏️', description: 'Otras necesidades dietéticas' },
];

const RsvpBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pendiente: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
    confirmado: 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0]',
    rechazado: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${styles[status] || styles.pendiente}`}>
      {status}
    </span>
  );
};

// ============================================================
// Main Component
// ============================================================

export default function PortalMenuPage() {
  const { token } = useParams<{ token: string }>();
  const [menuData, setMenuData] = useState<PortalMenuData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [variants, setVariants] = useState<GuestVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<string | null>(null);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // ============================================================
  // Data Loading
  // ============================================================

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    try {
      // Cargar menú
      const menuRes = await fetch(`/api/portal/${token}/menu`);
      const menuJson = await menuRes.json();

      if (!menuJson.success) {
        setError(menuJson.error || 'No se pudo cargar el menú');
        return;
      }

      setMenuData(menuJson.data);

      // Cargar invitados (usando la misma API con el token)
      const guestsRes = await fetch(`/api/portal/${token}/guests`);
      const guestsJson = await guestsRes.json();
      if (guestsJson.success) {
        setGuests(guestsJson.data || []);
      }

      // Cargar variantes
      const variantsRes = await fetch(`/api/portal/${token}/menu/variants`);
      const variantsJson = await variantsRes.json();
      if (variantsJson.success) {
        setVariants(variantsJson.data || []);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================
  // Variant Management
  // ============================================================

  const assignVariant = async (guestId: string, variantType: string, notes?: string) => {
    if (!menuData || menuData.is_frozen) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/portal/${token}/menu/variants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: guestId,
          variant_type: variantType,
          notes: notes || null,
        }),
      });

      const json = await res.json();
      if (json.success) {
        // Recargar variantes
        await loadData();
        setShowVariantModal(false);
        setSelectedGuest(null);
      } else {
        setError(json.error || 'Error al guardar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const removeVariant = async (guestId: string) => {
    if (!menuData || menuData.is_frozen) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/portal/${token}/menu/variants?guest_id=${guestId}`, {
        method: 'DELETE',
      });

      const json = await res.json();
      if (json.success) {
        await loadData();
      } else {
        setError(json.error || 'Error al eliminar');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // ============================================================
  // Helpers
  // ============================================================

  const getGuestVariant = (guestId: string): GuestVariant | undefined => {
    return variants.find((v) => v.guest_id === guestId);
  };

  const confirmedGuests = guests.filter((g) => g.rsvp === 'confirmado');
  const variantCount = variants.length;

  // ============================================================
  // Render
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280] text-sm">Cargando menú…</p>
        </div>
      </div>
    );
  }

  if (error && !menuData) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#ECECF1] p-8 max-w-md w-full text-center">
          <p className="text-[#DC2626] text-sm mb-4">{error}</p>
          <Link href={`/portal/${token}`} className="text-[#C9A84C] text-sm hover:underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      {/* Header */}
      <div className="bg-white border-b border-[#ECECF1]">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-2xl font-serif text-[#1A1A1A]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Tu Menú
              </h1>
              <p className="text-[#6B7280] text-sm mt-1">
                {menuData?.client_name} · {menuData?.event_date}
              </p>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold text-[#1A1A1A]">
                {menuData?.menu.name}
              </div>
              <div className="text-[12px] text-[#9CA3AF]">
                v{menuData?.menu.version} · {menuData?.menu.price_per_pax}€/pax
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Frozen notice */}
        {menuData?.is_frozen && (
          <div className="bg-[#FFF8E7] border border-[#EFE3BE] rounded-2xl p-4 flex items-start gap-3">
            <span className="text-lg">🔒</span>
            <div>
              <p className="text-sm font-semibold text-[#8A6D1F]">Portal congelado</p>
              <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                El menú está bloqueado. No se pueden hacer cambios.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-3 underline text-xs">
              Cerrar
            </button>
          </div>
        )}

        {/* Menu description */}
        {menuData?.menu.description && (
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-5">
            <p className="text-sm text-[#6B7280]">{menuData.menu.description}</p>
          </div>
        )}

        {/* Menu Sections */}
        <div className="space-y-4">
          {menuData?.sections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-2xl border border-[#ECECF1] overflow-hidden"
            >
              <div className="px-5 py-3 border-b border-[#F2F2F5]">
                <h3 className="font-semibold text-sm text-[#1A1A1A]">{section.name}</h3>
              </div>
              <div className="divide-y divide-[#F2F2F5]">
                {section.dishes.map((dish) => (
                  <div key={dish.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium text-[#1A1A1A]">
                          {dish.dish_name}
                        </span>
                        {dish.variant_tag && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#FBF6E9] text-[#8A6D1F] border border-[#EFE3BE]">
                            {dish.variant_tag}
                          </span>
                        )}
                      </div>
                      {dish.dish_description && (
                        <p className="text-[11px] text-[#9CA3AF] mt-0.5 truncate">
                          {dish.dish_description}
                        </p>
                      )}
                      {dish.dish_allergens && dish.dish_allergens.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {dish.dish_allergens.map((a, i) => (
                            <span
                              key={i}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]"
                            >
                              {a}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Variant Assignment Section */}
        {!menuData?.is_frozen && confirmedGuests.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-[#1A1A1A]">
                  Variantes por invitado
                </h3>
                <p className="text-[12px] text-[#9CA3AF] mt-0.5">
                  Asigna opciones dietéticas a cada confirmado
                </p>
              </div>
              <span className="text-[12px] text-[#C9A84C] font-medium">
                {variantCount}/{confirmedGuests.length} asignadas
              </span>
            </div>

            <div className="space-y-2">
              {confirmedGuests.map((guest) => {
                const variant = getGuestVariant(guest.id);
                return (
                  <div
                    key={guest.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-[#F2F2F5] hover:border-[#E5E7EB] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#FBF6E9] flex items-center justify-center text-[12px] font-semibold text-[#8A6D1F]">
                        {guest.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <span className="text-[13px] font-medium text-[#1A1A1A]">
                          {guest.name}
                        </span>
                        {guest.group_name && (
                          <span className="text-[11px] text-[#9CA3AF] ml-2">
                            {guest.group_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {variant ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] px-2 py-1 rounded-full bg-[#D1FAE5] text-[#065F46] border border-[#A7F3D0]">
                            {VARIANT_OPTIONS.find((v) => v.id === variant.variant_type)?.icon}{' '}
                            {VARIANT_OPTIONS.find((v) => v.id === variant.variant_type)?.label || variant.variant_type}
                          </span>
                          <button
                            onClick={() => removeVariant(guest.id)}
                            disabled={saving}
                            className="text-[11px] text-[#DC2626] hover:underline"
                          >
                            Quitar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedGuest(guest.id);
                            setShowVariantModal(true);
                          }}
                          disabled={saving}
                          className="text-[12px] font-medium text-[#C9A84C] hover:underline"
                        >
                          + Asignar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!menuData?.is_frozen && confirmedGuests.length === 0 && (
          <div className="bg-white rounded-2xl border border-[#ECECF1] p-8 text-center">
            <p className="text-[13px] text-[#9CA3AF]">
              Aún no hay invitados confirmados. Las variantes se asignarán cuando confirmen asistencia.
            </p>
          </div>
        )}
      </div>

      {/* Variant Selection Modal */}
      {showVariantModal && selectedGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#1A1A1A]">
                Seleccionar variante
              </h3>
              <button
                onClick={() => {
                  setShowVariantModal(false);
                  setSelectedGuest(null);
                }}
                className="text-[#9CA3AF] hover:text-[#1A1A1A] text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-[12px] text-[#6B7280]">
              Invitado: <span className="font-medium">{guests.find((g) => g.id === selectedGuest)?.name}</span>
            </p>

            <div className="space-y-2">
              {VARIANT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => assignVariant(selectedGuest, option.id)}
                  disabled={saving}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-[#ECECF1] hover:border-[#C9A84C] hover:bg-[#FBF6E9] transition-all text-left disabled:opacity-50"
                >
                  <span className="text-lg">{option.icon}</span>
                  <div>
                    <div className="text-[13px] font-medium text-[#1A1A1A]">{option.label}</div>
                    <div className="text-[11px] text-[#9CA3AF]">{option.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
