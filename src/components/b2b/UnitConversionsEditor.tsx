'use client';
/**
 * WP-01: Editor de conversiones de unidades por ingrediente
 *
 * Componente para gestionar las conversiones de unidades de medida
 * de un ingrediente específico. Permite añadir, editar y eliminar
 * conversiones personalizadas.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/shared/Icon';

interface Conversion {
  id: number;
  unit_name: string;
  factor_to_base: number;
}

interface IngredientInfo {
  id: string;
  name: string;
  base_unit: string;
}

interface UnitConversionsEditorProps {
  ingredientId: string;
  baseUnit: string;
  onUpdate?: () => void;
}

const BASE_UNIT_LABELS: Record<string, string> = {
  g: 'gramos (g)',
  ml: 'mililitros (ml)',
  ud: 'unidades (ud)',
};

const COMMON_UNITS = [
  { unit: 'kg', label: 'kilogramos (kg)', defaultFactor: 1000 },
  { unit: 'l', label: 'litros (L)', defaultFactor: 1000 },
  { unit: 'doc', label: 'docenas (doc)', defaultFactor: 12 },
  { unit: 'caja', label: 'cajas', defaultFactor: 1 },
  { unit: 'botella', label: 'botellas', defaultFactor: 1 },
  { unit: 'paquete', label: 'paquetes', defaultFactor: 1 },
  { unit: 'lata', label: 'latas', defaultFactor: 1 },
];

const inputClass = 'w-full px-3 py-2 rounded-lg border border-cream-dark bg-cream text-sm focus:ring-2 focus:ring-gold focus:border-gold transition-all';
const labelClass = 'block text-xs font-medium text-ink-soft mb-1';

export default function UnitConversionsEditor({
  ingredientId,
  baseUnit,
  onUpdate,
}: UnitConversionsEditorProps) {
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [newUnit, setNewUnit] = useState('');
  const [newFactor, setNewFactor] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Cargar conversiones
  const loadConversions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/ingredients/${ingredientId}/conversions`);
      if (!response.ok) throw new Error('Error al cargar conversiones');
      
      const data = await response.json();
      setConversions(data.conversions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ingredientId) {
      loadConversions();
    }
  }, [ingredientId]);

  // Añadir conversión
  const handleAdd = async () => {
    if (!newUnit.trim() || !newFactor) {
      setError('Unidad y factor son requeridos');
      return;
    }

    const factor = parseFloat(newFactor);
    if (isNaN(factor) || factor <= 0) {
      setError('El factor debe ser un número positivo');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(`/api/ingredients/${ingredientId}/conversions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_name: newUnit.trim().toLowerCase(),
          factor_to_base: factor,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar');
      }

      // Limpiar form y recargar
      setNewUnit('');
      setNewFactor('');
      setShowAddForm(false);
      await loadConversions();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar conversión
  const handleDelete = async (unitName: string) => {
    if (!confirm(`¿Eliminar la conversión de "${unitName}"?`)) return;

    try {
      setSaving(true);
      setError(null);

      const response = await fetch(
        `/api/ingredients/${ingredientId}/conversions?unit_name=${encodeURIComponent(unitName)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar');
      }

      await loadConversions();
      onUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar');
    } finally {
      setSaving(false);
    }
  };

  // Añadir conversión rápida de las comunes
  const handleQuickAdd = async (unit: string, factor: number) => {
    setNewUnit(unit);
    setNewFactor(factor.toString());
    setShowAddForm(true);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-ink-soft text-sm py-2">
        <Icon name="loader" className="w-4 h-4 animate-spin" />
        Cargando conversiones...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className={labelClass}>
          Conversiones a {BASE_UNIT_LABELS[baseUnit] || baseUnit}
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs"
        >
          <Icon name="plus" className="w-3 h-3 mr-1" />
          Añadir
        </Button>
      </div>

      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* Lista de conversiones existentes */}
      {conversions.length > 0 ? (
        <div className="space-y-2">
          {conversions.map((conv) => (
            <div
              key={conv.unit_name}
              className="flex items-center justify-between bg-cream-dark/30 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{conv.unit_name}</span>
                <span className="text-xs text-ink-soft">→</span>
                <span className="text-sm">
                  {conv.factor_to_base} {baseUnit}
                </span>
                <span className="text-xs text-ink-soft">
                  (1 {conv.unit_name} = {conv.factor_to_base} {baseUnit})
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(conv.unit_name)}
                disabled={saving}
                className="text-red-500 hover:text-red-700 p-1"
              >
                <Icon name="trash" className="w-3 h-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-soft italic">
          No hay conversiones configuradas. Las unidades estándar (kg→g, l→ml) se aplican automáticamente.
        </p>
      )}

      {/* Formulario para añadir */}
      {showAddForm && (
        <div className="border border-cream-dark rounded-lg p-3 space-y-3 bg-white">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Unidad</label>
              <input
                type="text"
                value={newUnit}
                onChange={(e) => setNewUnit(e.target.value)}
                placeholder="ej: kg, caja, botella"
                className={inputClass}
                list="common-units"
              />
              <datalist id="common-units">
                {COMMON_UNITS.map((u) => (
                  <option key={u.unit} value={u.unit}>
                    {u.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label className={labelClass}>
                Factor a {baseUnit}
              </label>
              <input
                type="number"
                value={newFactor}
                onChange={(e) => setNewFactor(e.target.value)}
                placeholder="ej: 1000"
                min="0.0001"
                step="any"
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-xs text-ink-soft">
            1 {newUnit || '?'} = {newFactor || '?'} {baseUnit}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleAdd}
              disabled={saving || !newUnit || !newFactor}
              className="bg-gold text-white hover:bg-gold/90"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setNewUnit('');
                setNewFactor('');
                setError(null);
              }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Conversiones rápidas sugeridas */}
      {!showAddForm && conversions.length === 0 && (
        <div className="text-xs text-ink-soft">
          <p className="mb-2">Conversiones comunes sugeridas:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_UNITS.filter((u) => {
              // Filtrar según dimensión del base_unit
              if (baseUnit === 'g' && (u.unit === 'kg')) return true;
              if (baseUnit === 'ml' && (u.unit === 'l')) return true;
              if (baseUnit === 'ud' && (u.unit === 'doc')) return true;
              return false;
            }).map((u) => (
              <Button
                key={u.unit}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleQuickAdd(u.unit, u.defaultFactor)}
                className="text-xs"
              >
                + {u.unit} ({u.defaultFactor} → {baseUnit})
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
