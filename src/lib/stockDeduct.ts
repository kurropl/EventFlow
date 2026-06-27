/**
 * EventFlow — Lógica de deducción de stock al cierre de evento.
 *
 * Extraído de src/app/api/stock/deduct/route.ts: un route.ts de Next.js App
 * Router solo puede exportar handlers HTTP (GET/POST/...) y un puñado de
 * campos especiales — exportar una función auxiliar directamente desde ahí
 * rompe `next build` ("no es un export de Route válido").
 */
import { querySingle, queryMany } from '@/lib/db';

function gramsToUnit(grams: number, ingredientUnit: string): number {
  const u = ingredientUnit.toLowerCase().trim();
  if (u === 'kg') return grams / 1000;
  return grams;
}

function mlToUnit(ml: number, ingredientUnit: string): number {
  const u = ingredientUnit.toLowerCase().trim();
  if (u === 'l') return ml / 1000;
  return ml;
}

function unitsToUnit(units: number, ingredientUnit: string): number {
  const u = ingredientUnit.toLowerCase().trim();
  if (u === 'docena') return units / 12;
  return units;
}

export interface DeductionResult {
  success: boolean;
  deducted: number;
  details: Array<{ ingredient_name: string; deducted_qty: number; unit: string }>;
  skipped?: string[];   // líneas con cantidad pero unidad/dimensión incompatible
  already_deducted?: boolean;
  error?: string;
}

/**
 * Deduct stock for a given event_id.
 * Can be called from other routes (e.g., events PUT) or from the POST handler.
 */
export async function deductStockForEvent(eventId: string): Promise<DeductionResult> {
  // 0. Idempotency check — skip if already deducted
  const event = await querySingle<any>(
    `SELECT id, stock_deducted FROM events WHERE id = $1`, [eventId]
  );
  if (!event) {
    return { success: false, deducted: 0, details: [], error: 'Evento no encontrado' };
  }
  if (event.stock_deducted) {
    return { success: true, deducted: 0, details: [], already_deducted: true };
  }

  // 1. Fetch all shopping items for the event
  const shoppingItems = await queryMany<any>(
    `SELECT id, event_id, ingredient_id, ingredient_name, total_grams, total_units, total_ml, completed
     FROM event_shopping_items
     WHERE event_id = $1`,
    [eventId]
  );

  if (shoppingItems.length === 0) {
    return { success: true, deducted: 0, details: [] };
  }

  const details: DeductionResult['details'] = [];
  let deductedCount = 0;
  const skipped: string[] = [];  // líneas con cantidad pero unidad/dimensión que no casa

  for (const item of shoppingItems) {
    const ingredientName = item.ingredient_name?.trim();

    // 2. Find matching ingredient — preferimos el id único (FR-S05); si no, por nombre.
    let ingredient = null as any;
    if (item.ingredient_id) {
      ingredient = await querySingle<any>(
        `SELECT id, name, unit, quantity FROM ingredients WHERE id = $1 AND active = true LIMIT 1`,
        [item.ingredient_id]
      );
    }
    if (!ingredient && ingredientName) {
      // exact match by name
      ingredient = await querySingle<any>(
        `SELECT id, name, unit, quantity
         FROM ingredients
         WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))
           AND active = true
         LIMIT 1`,
        [ingredientName]
      );
    }

    if (!ingredient && ingredientName) {
      // Fallback: partial match (starts with)
      ingredient = await querySingle<any>(
        `SELECT id, name, unit, quantity
         FROM ingredients
         WHERE name ILIKE $1 || '%'
           AND active = true
         LIMIT 1`,
        [ingredientName]
      );
    }

    if (!ingredient) {
      console.log(`[stock/deduct] No ingredient found for "${ingredientName}", skipping`);
      continue;
    }

    // 3. Calculate deduction amount based on item's consumed quantities
    const totalGrams = Number(item.total_grams) || 0;
    const totalUnits = Number(item.total_units) || 0;
    const totalMl = Number(item.total_ml) || 0;

    const unit = ingredient.unit?.toLowerCase().trim() || 'gr';
    const currentQty = Number(ingredient.quantity) || 0;

    let deductionAmount = 0;

    if (totalGrams > 0 && (unit === 'g' || unit === 'gr' || unit === 'kg')) {
      deductionAmount = gramsToUnit(totalGrams, unit);
    } else if (totalUnits > 0 && (unit === 'ud' || unit === 'docena')) {
      deductionAmount = unitsToUnit(totalUnits, unit);
    } else if (totalMl > 0 && (unit === 'ml' || unit === 'l')) {
      deductionAmount = mlToUnit(totalMl, unit);
    }

    if (deductionAmount <= 0) {
      // Hay cantidad en la línea pero su dimensión no casa con la unidad del
      // ingrediente: no se dedujo nada. Se registra para no ocultar la divergencia.
      if (totalGrams > 0 || totalUnits > 0 || totalMl > 0) {
        skipped.push(`${ingredient.name} (unidad ${unit})`);
        console.warn(`[stock/deduct] línea no deducida (dimensión no casa): ${ingredient.name} unit=${unit}`);
      }
      continue;
    }

    // 4. Idempotent: never go negative
    const newQty = Math.max(0, currentQty - deductionAmount);

    // Round to avoid floating point noise
    const roundedQty = Math.round(newQty * 10000) / 10000;

    await querySingle(
      `UPDATE ingredients SET quantity = $1 WHERE id = $2 RETURNING id`,
      [roundedQty, ingredient.id]
    );

    deductedCount++;
    details.push({
      ingredient_name: ingredient.name,
      deducted_qty: Math.round(deductionAmount * 10000) / 10000,
      unit: ingredient.unit,
    });
  }

  // 5. Mark event as stock_deducted and update status
  await querySingle(
    `UPDATE events SET stock_deducted = true, status = 'completed' WHERE id = $1 AND status != 'completed' RETURNING id`,
    [eventId]
  );
  // If already completed, just mark as deducted
  await querySingle(
    `UPDATE events SET stock_deducted = true WHERE id = $1 AND stock_deducted = false`,
    [eventId]
  );

  return { success: true, deducted: deductedCount, details, skipped: skipped.length ? skipped : undefined };
}
