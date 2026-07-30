/**
 * EventFlow — Sistema de Unidades (src/lib/units.ts)
 *
 * Módulo ÚNICO para conversión, normalización y formateo de cantidades y unidades.
 *
 * Principios (ver .hermes/plans/sistema-unidades-v2.md):
 * 1. Cálculo centralizado — todo pasa por aquí, prohibido recalcular en componentes
 * 2. Test-first — los tests fijan los resultados esperados antes de implementar
 * 3. Dimensiones separadas — nunca se suma gramos + ml + ud en un mismo total
 * 4. Redondeo único — ocurre 1 vez en la presentación, nunca en cálculos intermedios
 *
 * WP-01: Añadido convertToBase() que consulta conversiones por ingrediente.
 */

import { getPool } from './db';

// ================================================================
// Tipos y constantes
// ================================================================

/** Dimensiones físicas. Cada una agrupa unidades de la MISMA dimensión. */
export type Dimension = 'mass' | 'volume' | 'count' | 'currency';

/** Unidad de medida con su dimensión asociada. */
export interface UnitInfo {
  unit: string;
  label: string;
  dimension: Dimension;
  /** Factor de conversión a la unidad base de esta dimensión (gramos, mililitros, unidades). */
  toBase: number;
  /** Factor de conversión DESDE la unidad base. */
  fromBase: number;
}

/** Mapa completo de unidades soportadas. */
const UNITS: Record<string, UnitInfo> = {
  // Masa (base: g)
  g:   { unit: 'g',   label: 'g',   dimension: 'mass',    toBase: 1,      fromBase: 1 },
  kg:  { unit: 'kg',  label: 'kg',  dimension: 'mass',    toBase: 1000,   fromBase: 0.001 },

  // Volumen (base: ml)
  ml:  { unit: 'ml',  label: 'ml',  dimension: 'volume',  toBase: 1,      fromBase: 1 },
  l:   { unit: 'l',   label: 'L',   dimension: 'volume',  toBase: 1000,   fromBase: 0.001 },

  // Conteo (base: ud)
  ud:  { unit: 'ud',  label: 'ud',  dimension: 'count',   toBase: 1,      fromBase: 1 },
  doc: { unit: 'doc', label: 'doc', dimension: 'count',   toBase: 12,     fromBase: 1 / 12 },
};

// ================================================================
// Conversión entre unidades de la MISMA dimensión
// ================================================================

/**
 * Convierte un valor entre dos unidades de la MISMA dimensión.
 * Lanza error si las dimensiones no coinciden.
 *
 * @example convertUnit(1500, 'g', 'kg') → 1.5
 * @example convertUnit(750, 'ml', 'l') → 0.75
 * @example convertUnit(24, 'ud', 'doc') → 2
 */
export function convertUnit(value: number, from: string, to: string): number {
  const fromInfo = UNITS[from];
  const toInfo = UNITS[to];

  if (!fromInfo) throw new Error(`Unidad desconocida: "${from}"`);
  if (!toInfo) throw new Error(`Unidad desconocida: "${to}"`);

  if (fromInfo.dimension !== toInfo.dimension) {
    throw new Error(
      `No se puede convertir "${from}" (${fromInfo.dimension}) a "${to}" (${toInfo.dimension}): ` +
      `son dimensiones distintas (${fromInfo.dimension} ≠ ${toInfo.dimension}).`
    );
  }

  // Pasar a base → convertir a destino
  const inBase = value * fromInfo.toBase;
  return inBase * toInfo.fromBase;
}

// ================================================================
// Normalización a unidad base
// ================================================================

/**
 * Normaliza un valor a su unidad base (g, ml, ud).
 * Útil para guardar en DB siempre en la misma unidad canónica.
 */
export function normalizeToBase(value: number, unit: string): number {
  const info = UNITS[unit];
  if (!info) throw new Error(`Unidad desconocida: "${unit}"`);
  return value * info.toBase;
}

/**
 * Convierte desde unidad base a la unidad deseada.
 */
export function fromBaseTo(value: number, targetUnit: string): number {
  const info = UNITS[targetUnit];
  if (!info) throw new Error(`Unidad desconocida: "${targetUnit}"`);
  // La base es la unidad con toBase = 1
  return value * info.fromBase;
}

// ================================================================
// Suma de cantidades (dimension-wise)
// ================================================================

/**
 * Sumas de cantidades AGRUPADAS por dimensión.
 * Devuelve un objeto { mass: number, volume: number, count: number, currency: number }
 * con cada total en su unidad base.
 * 
 * Prohíbe mezclar dimensiones — cada entrada debe tener una dimensión explícita.
 */
export function sumByDimension(items: Array<{ value: number; unit: string }>): Record<Dimension, number> {
  const totals: Record<Dimension, number> = { mass: 0, volume: 0, count: 0, currency: 0 };

  for (const item of items) {
    const info = UNITS[item.unit];
    if (!info) throw new Error(`Unidad desconocida: "${item.unit}"`);

    // Pasar a base
    totals[info.dimension] += item.value * info.toBase;
  }

  return totals;
}

// ================================================================
// Formateo con locale español
// ================================================================

/**
 * Opciones de formato para cada dimensión.
 * - mass: 2 decimales siempre
 * - volume: 2 decimales siempre
 * - count: 0 decimales (entero)
 * - currency: 2 decimales siempre
 */
const DECIMAL_MAP: Record<Dimension, number> = {
  mass: 2,
  volume: 2,
  count: 0,
  currency: 2,
};

/**
 * Formatea una cantidad con el número correcto de decimales según su dimensión.
 * Usa Intl.NumberFormat con locale 'es-ES'.
 *
 * El redondeo a N decimales ocurre ÚNICAMENTE aquí — los cálculos intermedios
 * mantienen toda la precisión de float64.
 */
export function formatCantidad(value: number, unit: string): string {
  const info = UNITS[unit];
  if (!info) throw new Error(`Unidad desconocida: "${unit}"`);

  // Pasar a unidad base primero (el valor está en la unidad solicitada)
  const baseValue = value * info.toBase;
  const decimals = DECIMAL_MAP[info.dimension];

  // Redondear a la unidad destino
  const displayValue = baseValue * info.fromBase;

  // Si tiene decimales significativos (no son todos 0) → usar formato con decimales
  // Si no → usar formato entero
  const fmt = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });

  return fmt.format(displayValue);
}

/**
 * Formatea con sufijo de unidad (ej: "1,5 kg", "750 ml", "24 ud").
 */
export function formatCantidadConUnidad(value: number, unit: string): string {
  const info = UNITS[unit];
  if (!info) throw new Error(`Unidad desconocida: "${unit}"`);

  const baseValue = value * info.toBase;
  const decimals = DECIMAL_MAP[info.dimension];
  const displayValue = baseValue * info.fromBase;

  const fmt = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
    useGrouping: true,
  });

  return `${fmt.format(displayValue)} ${info.label}`;
}

/**
 * Formatea un total de dinero (€) — siempre 2 decimales.
 */
export function formatMoney(value: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// ================================================================
// Validaciones
// ================================================================

/**
 * Verifica que dos unidades pertenecen a la misma dimensión.
 */
export function areSameDimension(a: string, b: string): boolean {
  return UNITS[a]?.dimension === UNITS[b]?.dimension;
}

/**
 * Devuelve la dimensión de una unidad.
 */
export function getDimension(unit: string): Dimension | null {
  return UNITS[unit]?.dimension ?? null;
}

// ================================================================
// WP-01: Conversión por ingrediente desde la BD
// ================================================================

/**
 * Resultado de una conversión de ingrediente.
 */
export interface IngredientConversion {
  ingredient_id: string;
  unit_name: string;
  factor_to_base: number;
  base_unit: string;
}

/**
 * Cache en memoria para conversiones de ingredientes (TTL 5 min).
 * Evita queries a la BD en cada conversión.
 */
const conversionCache = new Map<string, { data: IngredientConversion[]; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Carga las conversiones de un ingrediente desde la BD.
 * WP-01: consulta ingredient_unit_conversions + base_unit de ingredients.
 *
 * @param ingredientId UUID del ingrediente
 * @returns Array de conversiones disponibles + base_unit
 */
export async function loadIngredientConversions(
  ingredientId: string
): Promise<IngredientConversion[]> {
  const cacheKey = ingredientId;
  const cached = conversionCache.get(cacheKey);
  
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  const pool = getPool();
  const result = await pool.query(
    `SELECT 
      c.ingredient_id,
      c.unit_name,
      c.factor_to_base,
      i.base_unit
    FROM ingredient_unit_conversions c
    JOIN ingredients i ON i.id = c.ingredient_id
    WHERE c.ingredient_id = $1`,
    [ingredientId]
  );

  const conversions = result.rows;
  conversionCache.set(cacheKey, { data: conversions, expiry: Date.now() + CACHE_TTL_MS });
  
  return conversions;
}

/**
 * Limpia la cache de conversiones (útil tras inserts/updates).
 */
export function clearConversionCache(ingredientId?: string): void {
  if (ingredientId) {
    conversionCache.delete(ingredientId);
  } else {
    conversionCache.clear();
  }
}

/**
 * Convierte una cantidad de un ingrediente a su unidad base.
 *
 * WP-01: Helper único para conversión de ingredientes.
 * Prohibido convertir inline en otros archivos.
 *
 * Flujo:
 * 1. Si unit == base_unit → no-op (ya está en base)
 * 2. Si existe conversión en ingredient_unit_conversions → usar factor_to_base
 * 3. Si no existe conversión pero la unidad es estándar (kg, l, doc) → usar factor genérico
 * 4. Si no hay conversión → lanzar error
 *
 * @param ingredientId UUID del ingrediente
 * @param qty Cantidad a convertir
n * @param unit Unidad de origen
 * @returns Cantidad en unidad base del ingrediente
 *
 * @example convertToBase('uuid-aceite', 2, 'l') → 2000 (ml)
 * @example convertToBase('uuid-harina', 1.5, 'kg') → 1500 (g)
 * @example convertToBase('uuid-huevos', 12, 'doc') → 144 (ud)
 */
export async function convertToBase(
  ingredientId: string,
  qty: number,
  unit: string
): Promise<number> {
  // 1. Cargar conversiones del ingrediente
  const conversions = await loadIngredientConversions(ingredientId);
  
  if (conversions.length === 0) {
    throw new Error(
      `Ingrediente ${ingredientId} no tiene conversiones configuradas. ` +
      `Ejecute la migración WP-01 o añada conversiones manualmente.`
    );
  }

  const baseUnit = conversions[0].base_unit;

  // 2. Si ya está en unidad base, no-op
  if (unit === baseUnit) {
    return qty;
  }

  // 3. Buscar conversión específica del ingrediente
  const specific = conversions.find(c => c.unit_name === unit);
  if (specific) {
    return qty * Number(specific.factor_to_base);
  }

  // 4. Buscar conversión genérica (kg→g, l→ml, doc→ud)
  const genericFactor = getGenericFactor(unit, baseUnit);
  if (genericFactor !== null) {
    return qty * genericFactor;
  }

  // 5. No hay conversión → error
  throw new Error(
    `No existe conversión de '${unit}' a '${baseUnit}' para ingrediente ${ingredientId}. ` +
    `Añada una conversión en ingredient_unit_conversions.`
  );
}

/**
 * Obtiene el factor de conversión genérico entre unidades estándar.
 * Retorna null si no hay conversión genérica posible.
 */
function getGenericFactor(fromUnit: string, toBaseUnit: string): number | null {
  // Masa: kg → g
  if (fromUnit === 'kg' && toBaseUnit === 'g') return 1000;
  // Volumen: l → ml
  if (fromUnit === 'l' && toBaseUnit === 'ml') return 1000;
  // Conteo: doc → ud
  if (fromUnit === 'doc' && toBaseUnit === 'ud') return 12;
  
  return null;
}

/**
 * Versión síncrona de convertToBase para usar cuando ya se tiene
 * el factor cargado (ej: en loops donde ya se hizo loadIngredientConversions).
 *
 * @param qty Cantidad
 * @param factor Factor a unidad base
 * @returns Cantidad en unidad base
 */
export function applyConversionFactor(qty: number, factor: number): number {
  return qty * factor;
}

/**
 * Devuelve la lista de unidades disponibles para un ingrediente.
 * Útil para formularios de UI.
 *
 * @param ingredientId UUID del ingrediente
 * @returns Array de { unit, label, factor_to_base, isBase }
 */
export async function getAvailableUnits(
  ingredientId: string
): Promise<Array<{ unit: string; label: string; factor_to_base: number; isBase: boolean }>> {
  const conversions = await loadIngredientConversions(ingredientId);
  
  if (conversions.length === 0) {
    return [];
  }

  const baseUnit = conversions[0].base_unit;
  const units: Array<{ unit: string; label: string; factor_to_base: number; isBase: boolean }> = [];

  // Añadir unidad base
  const baseInfo = UNITS[baseUnit];
  if (baseInfo) {
    units.push({
      unit: baseUnit,
      label: baseInfo.label,
      factor_to_base: 1,
      isBase: true,
    });
  }

  // Añadir conversiones del ingrediente
  for (const conv of conversions) {
    if (conv.unit_name !== baseUnit) {
      units.push({
        unit: conv.unit_name,
        label: conv.unit_name,
        factor_to_base: Number(conv.factor_to_base),
        isBase: false,
      });
    }
  }

  // Añadir unidades genéricas no duplicadas
  for (const [unit, info] of Object.entries(UNITS)) {
    if (unit !== baseUnit && !units.find(u => u.unit === unit)) {
      const genericFactor = getGenericFactor(unit, baseUnit);
      if (genericFactor !== null) {
        units.push({
          unit,
          label: info.label,
          factor_to_base: genericFactor,
          isBase: false,
        });
      }
    }
  }

  return units;
}

export default {
  convertUnit,
  normalizeToBase,
  fromBaseTo,
  sumByDimension,
  formatCantidad,
  formatCantidadConUnidad,
  formatMoney,
  areSameDimension,
  getDimension,
};