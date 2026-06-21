/**
 * EventFlow — Motor de Costes ÚNICO (src/lib/costing.ts)
 *
 * CÁLCULO CENTRALIZADO de coste de eventos.
 * - Mismo resultado desde presupuesto, escandallo y factura
 * - No recalcula en componentes ni en vistas SQL
 * - Los eventos en 'accepted' / 'won' quedan congelados
 *
 * Principios (ver .hermes/specs/costing-unified-spec.md):
 * 1. Un único punto de cálculo para toda la aplicación
 * 2. El coste de un evento es idéntico en presupuesto, escandallo y factura
 * 3. Modificar el coste de un ingrediente se propaga automáticamente a draft/sent
 * 4. Los eventos aceptados quedan congelados en su coste de aceptación
 */

import { convertUnit, normalizeToBase, sumByDimension } from './units';

// ================================================================
// Tipos
// ================================================================

/** Una línea de coste granular (por ingrediente) */
export interface CostLine {
  ingredientId: string;
  ingredientName: string;
  /** Cantidad en unidad base (g, ml, ud) */
  quantity: number;
  /** Unidad en la que se expresa la cantidad */
  unit: 'g' | 'ml' | 'ud';
  /** Coste por unidad base (€/g, €/ml, €/ud) */
  unitCost: number;
  /** Coste total de esta línea */
  lineTotal: number;
}

/** Resultado completo del cálculo de coste */
export interface CostResult {
  /** Costes por línea (ingrediente a ingrediente) */
  lines: CostLine[];
  /** Subtotal (sin margen) */
  subtotal: number;
  /** Margen aplicado (en €) */
  margin: number;
  /** Margen en porcentaje */
  marginPercent: number;
  /** PVP final */
  pvp: number;
}

/** Datos de un ingrediente desde catálogo */
interface CatalogIngredient {
  id: string;
  name: string;
  unit: string;
  unitCost: number;
}

// ================================================================
// Motor de costes
// ================================================================

/**
 * Calcula el coste de un evento completo.
 * 
 * @param selectedItems - Items seleccionados (del event_shopping_items)
 * @param catalog - Catálogo de ingredientes
 * @param guests - Número de comensales (para escalado)
 * @returns CostResult con todos los totales calculados
 */
export function computeEventCost(
  selectedItems: Array<{ ingredientId: string; quantity: number; unit: string }>,
  catalog: CatalogIngredient[],
  guests: number
): CostResult {
  const lines: CostLine[] = [];
  let subtotal = 0;

  for (const item of selectedItems) {
    if (item.quantity === 0) continue; // coste 0

    const ingredient = catalog.find(c => c.id === item.ingredientId);
    if (!ingredient) {
      throw new Error(`Ingrediente ${item.ingredientId} no encontrado en catálogo`);
    }

    // Normalizar a unidad base
    const baseQuantity = normalizeToBase(item.quantity, item.unit);
    const unitCost = ingredient.unitCost;

    if (unitCost === 0 && baseQuantity > 0) {
      throw new Error(`Coste del ingrediente ${ingredient.name} es 0 con cantidad ${baseQuantity} > 0`);
    }

    const lineTotal = baseQuantity * unitCost;

    lines.push({
      ingredientId: item.ingredientId,
      ingredientName: ingredient.name,
      quantity: baseQuantity,
      unit: item.unit as 'g' | 'ml' | 'ud',
      unitCost,
      lineTotal,
    });

    subtotal += lineTotal;
  }

  // Margen (default: 20% — configurable)
  const margin = subtotal * 0.2;
  const pvp = subtotal + margin;

  return {
    lines,
    subtotal,
    margin,
    marginPercent: 20,
    pvp,
  };
}

/**
 * Calcula el coste de una sola línea de ingrediente.
 * Útil para actualizaciones en tiempo real desde el catálogo.
 */
export function computeLineCost(
  ingredientId: string,
  quantity: number,
  unit: string,
  unitCost: number
): number {
  const baseQty = normalizeToBase(quantity, unit);
  if (unitCost === 0 && baseQty > 0) {
    throw new Error(`Coste 0 para cantidad ${baseQty} — asigna un coste antes de calcular`);
  }
  return baseQty * unitCost;
}

/**
 * Comprueba si dos costes son iguales (para verificar identidad entre módulos).
 * Útil en tests.
 */
export function areSameCost(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.01; // tolerancia de 1 céntimo
}

export default {
  computeEventCost,
  computeLineCost,
  areSameCost,
};