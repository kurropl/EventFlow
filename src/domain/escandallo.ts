/**
 * EventFlow — Cálculo puro del escandallo de coste (WP-05)
 *
 * Función determinista: sin side-effects, sin acceso a BD.
 * Fórmula: coste_línea = qty_base × pax × coste_unitario_base
 * Separación: food_cost (ingredientes comida) + beverage_cost (bar_service)
 * cost_per_pax = total / pax
 *
 * Integración con motor de bebidas existente:
 *   - bar_service_cost = bar_price × bar_hours (precio barra libre por horas)
 *   - El coste de ingredientes categorizados como 'bebida' se incluye en
 *     beverage_cost para un desglose completo.
 */

// ── Tipos ──────────────────────────────────────────────────────────

export type EscandalloCategory = 'food' | 'beverage' | 'other';

export interface EscandalloLineInput {
  /** Cantidad en unidad base del ingrediente (g, ml, ud). */
  qty_base: number;
  /** Coste por unidad base del ingrediente (€/g, €/ml, €/ud). */
  unit_cost: number;
  /** Categoría del plato de origen ('carne', 'pescado', 'bebida', etc.). */
  dish_category?: string | null;
}

export interface EscandalloLineResult {
  /** Categoría normalizada del ingrediente. */
  category: EscandalloCategory;
  /** Coste de la línea = qty_base × pax × unit_cost. */
  line_cost: number;
}

export interface EscandalloCostResult {
  /** Coste total de ingredientes de comida. */
  food_cost: number;
  /** Coste total: ingredientes bebida + barra libre. */
  beverage_cost: number;
  /** Coste barra libre = bar_price × bar_hours. */
  bar_service_cost: number;
  /** Coste total = food_cost + beverage_cost. */
  total_cost: number;
  /** Coste por comensal = total_cost / pax. */
  cost_per_pax: number;
  /** Líneas individuales con su categoría y coste. */
  lines: EscandalloLineResult[];
}

// ── Constantes ─────────────────────────────────────────────────────

/** Categorías de plato que se consideran bebida. */
const BEVERAGE_CATEGORIES = new Set([
  'bebida',
  'bebidas',
  'bar',
  'vino',
  'cerveza',
  'refresco',
  'agua',
  'coctel',
  'destilado',
]);

/** Redondeo a 2 decimales (céntimos). */
const round2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100;

// ── Funciones puras ────────────────────────────────────────────────

/**
 * Clasifica un ingrediente en food/beverage/other según la categoría del plato.
 */
export function classifyIngredient(
  dishCategory: string | null | undefined
): EscandalloCategory {
  if (!dishCategory) return 'other';
  const norm = dishCategory.toLowerCase().trim();
  if (BEVERAGE_CATEGORIES.has(norm)) return 'beverage';
  return 'food';
}

/**
 * Calcula el coste de UNA línea de escandallo.
 * Fórmula: coste = qty_base × pax × unit_cost
 *
 * @param qtyBase   Cantidad en unidad base del ingrediente
 * @param pax       Número de comensales
 * @param unitCost  Coste por unidad base (€/g, €/ml, €/ud)
 * @returns Coste de la línea redondeado a céntimos
 */
export function computeLineCost(
  qtyBase: number,
  pax: number,
  unitCost: number
): number {
  const q = Number(qtyBase) || 0;
  const p = Math.max(1, Number(pax) || 1);
  const c = Number(unitCost) || 0;
  return round2(q * p * c);
}

/**
 * Calcula el escandallo completo de coste de un evento.
 *
 * Fórmula por línea: coste = qty_base × pax × coste_unitario_base
 * Totales:
 *   food_cost = Σ líneas food
 *   beverage_cost = Σ líneas bebida + bar_service_cost
 *   bar_service_cost = bar_price × bar_hours
 *   total_cost = food_cost + beverage_cost
 *   cost_per_pax = total_cost / pax
 *
 * @param lines           Líneas del escandallo (ingredientes)
 * @param pax             Número de comensales
 * @param barPrice        Precio de barra libre por hora (€/h), default 0
 * @param barHours        Horas de barra libre, default 0
 * @returns Resultado desglosado con food_cost, beverage_cost, cost_per_pax
 */
export function computeEscandalloCost(
  lines: EscandalloLineInput[],
  pax: number,
  barPrice: number = 0,
  barHours: number = 0
): EscandalloCostResult {
  const paxNum = Math.max(1, Number(pax) || 1);

  let foodCost = 0;
  let beverageIngredientsCost = 0;

  const resultLines: EscandalloLineResult[] = lines.map((line) => {
    const category = classifyIngredient(line.dish_category);
    const lineCost = computeLineCost(line.qty_base, paxNum, line.unit_cost);

    if (category === 'beverage') {
      beverageIngredientsCost = round2(beverageIngredientsCost + lineCost);
    } else if (category === 'food') {
      foodCost = round2(foodCost + lineCost);
    }
    // 'other' category → not counted in food_cost or beverage_cost

    return { category, line_cost: lineCost };
  });

  // Barra libre = precio_hora × horas (motor de bebidas existente)
  const barServiceCost = round2(
    (Number(barPrice) || 0) * (Number(barHours) || 0)
  );

  const beverageCost = round2(beverageIngredientsCost + barServiceCost);
  const totalCost = round2(foodCost + beverageCost);
  const costPerPax = round2(totalCost / paxNum);

  return {
    food_cost: foodCost,
    beverage_cost: beverageCost,
    bar_service_cost: barServiceCost,
    total_cost: totalCost,
    cost_per_pax: costPerPax,
    lines: resultLines,
  };
}
