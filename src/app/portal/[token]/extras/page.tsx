'use client';

/**
 * EventFlow — Portal Extras Page
 * /portal/[token]/extras — Client can view and select extras for their event
 * No login required, uses portal token for authentication.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { 
  Loader2, 
  AlertCircle, 
  Check, 
  X, 
  ShoppingBag,
  Sparkles,
  Info
} from 'lucide-react';

// ============================================================
// Types
// ============================================================

interface PortalExtra {
  id: string;
  category: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  price: number;
  price_unit: string;
  selected: boolean;
  selected_qty: number | null;
  price_snapshot: number | null;
}

interface PortalExtrasData {
  extras: PortalExtra[];
  selected_total: number;
  event_id: string;
  is_frozen: boolean;
}

// ============================================================
// Constants
// ============================================================

const CATEGORY_LABELS: Record<string, string> = {
  'centro_mesa': 'Centros de mesa',
  'manteleria': 'Mantelería',
  'minuta': 'Minuta y papelería',
  'flores': 'Flores',
  'iluminacion': 'Iluminación',
  'sonido': 'Sonido',
  'otro': 'Otros',
};

const CATEGORY_COLORS: Record<string, string> = {
  'centro_mesa': '#D4A574',
  'manteleria': '#9CA3AF',
  'minuta': '#C9A84C',
  'flores': '#F472B6',
  'iluminacion': '#FCD34D',
  'sonido': '#60A5FA',
  'otro': '#A78BFA',
};

const UNIT_LABELS: Record<string, string> = {
  'ud': '/ud',
  'mesa': '/mesa',
  'pax': '/comensal',
  'evento': '/evento',
};

// ============================================================
// Helpers
// ============================================================

function money(v: number) {
  return Number(v).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}

// ============================================================
// Main Component
// ============================================================

export default function PortalExtrasPage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<PortalExtrasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Fetch extras data
  const fetchExtras = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/portal/${token}/extras`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al cargar los extras');
      }

      setData(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchExtras();
    }
  }, [token, fetchExtras]);

  // Handle select/deselect extra
  const handleToggleExtra = async (extraId: string) => {
    try {
      setActionLoading(extraId);
      setError(null);

      const response = await fetch(`/api/portal/${token}/extras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extra_id: extraId, action: 'toggle' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al modificar el extra');
      }

      // Update local state
      if (data) {
        setData({
          ...data,
          selected_total: result.selected_total,
          extras: data.extras.map(e => {
            if (e.id === extraId) {
              const isSelected = result.data.action === 'selected';
              return {
                ...e,
                selected: isSelected,
                selected_qty: isSelected ? 1 : null,
                price_snapshot: isSelected ? result.data.price_snapshot : null,
              };
            }
            return e;
          }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al modificar el extra');
    } finally {
      setActionLoading(null);
    }
  };

  // Group extras by category
  const groupedExtras = useMemo(() => {
    if (!data) return {};
    
    const grouped: Record<string, PortalExtra[]> = {};
    for (const extra of data.extras) {
      if (!grouped[extra.category]) grouped[extra.category] = [];
      grouped[extra.category].push(extra);
    }
    return grouped;
  }, [data]);

  // Get categories with extras
  const categories = useMemo(() => {
    return Object.keys(groupedExtras).filter(
      cat => groupedExtras[cat].length > 0
    );
  }, [groupedExtras]);

  // Count selected items
  const selectedCount = useMemo(() => {
    if (!data) return 0;
    return data.extras.filter(e => e.selected).length;
  }, [data]);

  // ============================================================
  // Loading State
  // ============================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[#C9A84C] animate-spin mx-auto mb-4" />
          <p className="text-[#6B7280]">Cargando catálogo de extras...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // Error State
  // ============================================================

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-[#1A1A1A] mb-2">
            Error al cargar
          </h1>
          <p className="text-[#6B7280] mb-4">{error}</p>
          <button
            onClick={fetchExtras}
            className="px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // ============================================================
  // Main Render
  // ============================================================

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white">
      {/* Header */}
      <div className="bg-white border-b border-[#E5E5EC] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #C9A84C, #A88A3A)' }}>
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-[#1A1A1A]">Extras y Decoración</h1>
                <p className="text-xs text-[#6B7280]">Personaliza tu evento</p>
              </div>
            </div>
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 bg-[#FBF6E9] px-3 py-1.5 rounded-full">
                <ShoppingBag className="w-4 h-4 text-[#C9A84C]" />
                <span className="text-sm font-medium text-[#A88A3A]">
                  {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Frozen notice */}
      {data?.is_frozen && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <p className="text-sm text-amber-800 flex items-center gap-2">
              <Info className="w-4 h-4" />
              El portal está congelado. Ya no se pueden modificar los extras.
            </p>
          </div>
        </div>
      )}

      {/* Error toast */}
      {error && (
        <div className="max-w-4xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Category filter pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[#C9A84C] text-white'
                : 'bg-white text-[#6B7280] border border-[#E5E5EC] hover:border-[#C9A84C]'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? 'text-white'
                  : 'bg-white text-[#6B7280] border border-[#E5E5EC] hover:border-[#C9A84C]'
              }`}
              style={selectedCategory === cat ? { background: CATEGORY_COLORS[cat] || '#C9A84C' } : {}}
            >
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>

        {/* Extras grid */}
        <div className="space-y-8">
          {categories
            .filter(cat => selectedCategory === 'all' || selectedCategory === cat)
            .map(category => (
              <div key={category}>
                <h2 className="text-sm font-semibold text-[#1A1A1A] mb-3 flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: CATEGORY_COLORS[category] || '#C9A84C' }}
                  />
                  {CATEGORY_LABELS[category] || category}
                  <span className="text-xs text-[#9CA3AF] font-normal">
                    ({groupedExtras[category].length})
                  </span>
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedExtras[category].map(extra => (
                    <ExtraCard
                      key={extra.id}
                      extra={extra}
                      isActionLoading={actionLoading === extra.id}
                      isFrozen={data?.is_frozen || false}
                      onToggle={() => handleToggleExtra(extra.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
        </div>

        {/* Empty state */}
        {categories.length === 0 && (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-[#D1D5DB] mx-auto mb-4" />
            <h2 className="text-lg font-medium text-[#1A1A1A] mb-2">
              No hay extras disponibles
            </h2>
            <p className="text-sm text-[#6B7280]">
              El catálogo de extras está vacío en este momento.
            </p>
          </div>
        )}

        {/* Selected total */}
        {data && data.selected_total > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E5EC] p-4 z-20">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-xs text-[#6B7280]">Total extras seleccionados</p>
                <p className="text-lg font-semibold text-[#1A1A1A]">{money(data.selected_total)}</p>
              </div>
              <div className="text-xs text-[#9CA3AF] text-right">
                <p>Se añadirá al presupuesto</p>
                <p>tras la confirmación</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom padding for fixed footer */}
        {data && data.selected_total > 0 && (
          <div className="h-24" />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Extra Card Component
// ============================================================

function ExtraCard({
  extra,
  isActionLoading,
  isFrozen,
  onToggle,
}: {
  extra: PortalExtra;
  isActionLoading: boolean;
  isFrozen: boolean;
  onToggle: () => void;
}) {
  const categoryColor = CATEGORY_COLORS[extra.category] || '#C9A84C';

  return (
    <div
      className={`bg-white rounded-2xl border-2 overflow-hidden transition-all ${
        extra.selected
          ? 'border-[#C9A84C] shadow-md'
          : 'border-[#E5E5EC] hover:border-[#D1D5DB]'
      }`}
    >
      {/* Photo or gradient placeholder */}
      <div
        className="h-32 relative"
        style={{
          background: extra.photo_url
            ? `url(${extra.photo_url}) center/cover`
            : `linear-gradient(135deg, ${categoryColor}40, ${categoryColor}20)`,
        }}
      >
        {extra.selected && (
          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#C9A84C] flex items-center justify-center">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}
        {!extra.photo_url && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-8 h-8" style={{ color: categoryColor + '80' }} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium text-[#1A1A1A] text-sm mb-1 line-clamp-2">
          {extra.name}
        </h3>
        {extra.description && (
          <p className="text-xs text-[#6B7280] mb-2 line-clamp-2">
            {extra.description}
          </p>
        )}
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-lg font-semibold text-[#1A1A1A]">
            {money(extra.price)}
          </span>
          <span className="text-xs text-[#9CA3AF]">
            {UNIT_LABELS[extra.price_unit] || extra.price_unit}
          </span>
        </div>

        {/* Toggle button */}
        <button
          onClick={onToggle}
          disabled={isActionLoading || isFrozen}
          className={`w-full py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
            extra.selected
              ? 'bg-[#FEF3F3] text-[#DC2626] hover:bg-red-100 border border-red-200'
              : 'bg-[#C9A84C] text-white hover:bg-[#A88A3A]'
          }`}
        >
          {isActionLoading ? (
            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          ) : extra.selected ? (
            'Quitar'
          ) : (
            'Seleccionar'
          )}
        </button>
      </div>
    </div>
  );
}
