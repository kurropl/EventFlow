/**
 * EventFlow — Lógica de deducción de stock al cierre de evento.
 *
 * Extraído de src/app/api/stock/deduct/route.ts: un route.ts de Next.js App
 * Router solo puede exportar handlers HTTP (GET/POST/...) y un puñado de
 * campos especiales — exportar una función auxiliar directamente desde ahí
 * rompe `next build` ("no es un export de Route válido").
 */
import { querySingle, queryMany, getPool } from '@/lib/db';
import { setEventStatus } from '@/lib/domain/eventState';
import { adjustIngredientStock } from '@/lib/domain/stockLedger';
import { releaseInventoryCommitments } from '@/lib/domain/inventoryCommitment';
import { consumeLotsFEFO, resolveRecipeId } from '@/lib/domain/lotTraceability';

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
  traceGaps?: string[]; // G5: ingredientes cuyo consumo no se pudo trazar a un lote
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
    `SELECT id, stock_deducted, guest_count FROM events WHERE id = $1`, [eventId]
  );
  if (!event) {
    return { success: false, deducted: 0, details: [], error: 'Evento no encontrado' };
  }
  if (event.stock_deducted) {
    return { success: true, deducted: 0, details: [], already_deducted: true };
  }

  // 1. Fetch all shopping items for the event
  const shoppingItems = await queryMany<any>(
    `SELECT id, event_id, ingredient_id, ingredient_name, total_grams, total_units, total_ml, completed, recipe_item_id
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
  const traceGaps: string[] = [];  // G5: consumo sin lote de origen registrado

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

    // 4. G6: deducción vía el ledger único — actualiza ingredients.quantity
    // (canónico, nunca negativo) y refleja inventory/inventory_movements en
    // la misma operación (antes esta deducción real era invisible para los
    // ledgers de movimiento).
    const adj = await adjustIngredientStock(getPool() as any, {
      ingredientId: ingredient.id,
      delta: -deductionAmount,
      reason: 'operativo',
      movementType: 'consumption',
      eventId,
      referenceType: 'event',
      referenceId: eventId,
      notes: `Deducción de cierre de evento`,
    });

    deductedCount++;
    details.push({
      ingredient_name: ingredient.name,
      deducted_qty: Math.round((adj.previousQty - adj.newQty) * 10000) / 10000,
      unit: ingredient.unit,
    });

    // 4.5) G5 (Sprint 3): traza el consumo real a un lote concreto (FEFO).
    // Complementa el ledger (G6): el saldo ya se movió arriba; esto registra
    // QUÉ lote lo cubrió. Si el stock no viene de ningún lote registrado, se
    // reporta como traceGap en vez de inventarse un origen.
    const recipeId = await resolveRecipeId(getPool() as any, item.recipe_item_id ?? null);
    const trace = await consumeLotsFEFO(getPool() as any, {
      ingredientId: ingredient.id,
      eventId,
      quantity: deductionAmount,
      unit: ingredient.unit,
      recipeId,
      guestServed: event.guest_count ?? null,   // aproximación: raciones del evento, no por plato
    });
    if (trace.untracedQty > 0) {
      traceGaps.push(`${ingredient.name}: ${trace.untracedQty}${ingredient.unit} sin lote de origen registrado`);
    }
  }

  // 5. Mark event as stock_deducted and update status
  await setEventStatus(eventId, 'completed', {
    extra: { stock_deducted: true },
    extraWhereSql: `AND status != 'completed'`,
  });
  // If already completed, just mark as deducted
  await querySingle(
    `UPDATE events SET stock_deducted = true WHERE id = $1 AND stock_deducted = false`,
    [eventId]
  );

  // G2: el consumo ya es real (se acaba de deducir) — el compromiso de
  // inventario (una promesa sobre stock futuro) deja de tener sentido.
  // Cubre tanto close/route.ts como transitions::fwd4 (ambos llaman aquí).
  await releaseInventoryCommitments(getPool() as any, eventId);

  return {
    success: true,
    deducted: deductedCount,
    details,
    skipped: skipped.length ? skipped : undefined,
    traceGaps: traceGaps.length ? traceGaps : undefined,
  };
}
