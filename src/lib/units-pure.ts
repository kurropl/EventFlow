/**
 * EventFlow — Unidades Puras (sin dependencia de BD)
 * Funciones de conversión que NO necesitan base de datos
 */

export type Dimension = 'mass' | 'volume' | 'count' | 'currency';

export interface UnitInfo {
  unit: string;
  label: string;
  dimension: Dimension;
  toBase: number;
  fromBase: number;
}

const UNITS: Record<string, UnitInfo> = {
  g:   { unit: 'g',   label: 'g',   dimension: 'mass',    toBase: 1,      fromBase: 1 },
  kg:  { unit: 'kg',  label: 'kg',  dimension: 'mass',    toBase: 1000,   fromBase: 0.001 },
  ml:  { unit: 'ml',  label: 'ml',   dimension: 'volume',  toBase: 1,      fromBase: 1 },
  l:   { unit: 'l',   label: 'L',   dimension: 'volume',  toBase: 1000,   fromBase: 0.001 },
  ud:  { unit: 'ud',  label: 'ud',  dimension: 'count',   toBase: 1,      fromBase: 1 },
  doc: { unit: 'doc', label: 'doc', dimension: 'count',   toBase: 12,     fromBase: 1 / 12 },
};

export function convertUnit(value: number, from: string, to: string): number {
  const fromUnit = UNITS[from];
  const toUnit = UNITS[to];
  if (!fromUnit || !toUnit) throw new Error(`Unidad no soportada: ${from} o ${to}`);
  if (fromUnit.dimension !== toUnit.dimension) throw new Error(`No se puede convertir de ${from} a ${to}`);
  const baseValue = value * fromUnit.toBase;
  return baseValue * toUnit.fromBase;
}

export function normalizeToBase(value: number, unit: string): number {
  const u = UNITS[unit];
  if (!u) return value;
  return value * u.toBase;
}

export function getDimension(unit: string): Dimension | null {
  return UNITS[unit]?.dimension || null;
}

export function areSameDimension(a: string, b: string): boolean {
  return getDimension(a) === getDimension(b);
}

export function formatCantidad(value: number, unit: string): string {
  const u = UNITS[unit];
  if (!u) return `${value} ${unit}`;
  return `${value.toFixed(u.dimension === 'count' ? 0 : 2)} ${u.label}`;
}

/**
 * Normaliza la unidad de PRESENTACIÓN sin tocar el cálculo: 200000 g → 200 kg,
 * 5000 ml → 5 l. Mantiene la cantidad en la unidad base si no llega al umbral
 * de conversión o si la unidad no es convertible (ud, doc, etc.).
 * Devuelve la cantidad y unidad legibles para mostrar en UI.
 */
export function humanizeUnit(value: number, unit: string): { qty: number; unit: string } {
  const u = UNITS[unit];
  if (!u) return { qty: value, unit };
  // masa: g → kg cuando ≥ 1000 g
  if (u.dimension === 'mass' && unit === 'g' && Math.abs(value) >= 1000) {
    return { qty: value / 1000, unit: 'kg' };
  }
  // volumen: ml → l cuando ≥ 1000 ml
  if (u.dimension === 'volume' && unit === 'ml' && Math.abs(value) >= 1000) {
    return { qty: value / 1000, unit: 'l' };
  }
  return { qty: value, unit };
}

export function formatMoney(value: number): string {
  return `${value.toFixed(2)} €`;
}

export function applyConversionFactor(qty: number, factor: number): number {
  return qty * factor;
}
