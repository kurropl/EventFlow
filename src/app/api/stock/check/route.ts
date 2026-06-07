/**
 * EventFlow — Stock Check API Route
 * GET /api/stock/check?event_id=... — Compare event shopping items against available stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { verifyToken } from '@/lib/auth';

// ── Auth helper ─────────────────────────────────────────────────────

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) {
    return { authenticated: false, error: 'No autenticado' };
  }
  const user = verifyToken(token);
  if (!user) {
    return { authenticated: false, error: 'Token inválido o expirado' };
  }
  return { authenticated: true };
}

// ── GET: Stock check for an event ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) {
      return NextResponse.json(
        { success: false, error: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'El parámetro "event_id" es obligatorio' },
        { status: 400 }
      );
    }

    // Fetch all shopping items for this event
    const items = await queryMany<any>(
      `SELECT
         esi.ingredient_name,
         esi.total_grams,
         esi.total_units,
         esi.total_ml
       FROM event_shopping_items esi
       WHERE esi.event_id = $1
       ORDER BY esi.ingredient_name ASC`,
      [eventId]
    );

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        data: { sufficient: true, shortages: [] },
      });
    }

    // Collect unique ingredient names for lookup
    const ingredientNames = [...new Set(items.map((i: any) => i.ingredient_name).filter(Boolean))];

    if (ingredientNames.length === 0) {
      return NextResponse.json({
        success: true,
        data: { sufficient: true, shortages: [] },
      });
    }

    // Look up all matching ingredients (ILIKE for each name)
    const ingredientPlaceholders = ingredientNames.map((_, i) => `$${i + 1}`).join(', ');
    const ingredients = await queryMany<any>(
      `SELECT id, name, unit, quantity
       FROM ingredients
       WHERE active = true
         AND name ILIKE ANY(ARRAY[${ingredientPlaceholders}])`,
      ingredientNames
    );

    // Build a lookup map: ingredient_name (lowercased) -> ingredient row
    const ingredientMap: Record<string, any> = {};
    for (const ing of ingredients) {
      ingredientMap[ing.name.toLowerCase()] = ing;
    }

    // Aggregate needed quantities per ingredient name
    const neededByIngredient: Record<string, { grams: number; units: number; ml: number }> = {};

    for (const item of items) {
      const name = item.ingredient_name?.toLowerCase();
      if (!name) continue;

      if (!neededByIngredient[name]) {
        neededByIngredient[name] = { grams: 0, units: 0, ml: 0 };
      }
      neededByIngredient[name].grams += Number(item.total_grams) || 0;
      neededByIngredient[name].units += Number(item.total_units) || 0;
      neededByIngredient[name].ml += Number(item.total_ml) || 0;
    }

    // Compare each ingredient against available stock
    const shortages: Array<{
      ingredient_name: string;
      needed: number;
      available: number;
      unit: string;
      deficit: number;
    }> = [];

    let sufficient = true;

    for (const [name, needed] of Object.entries(neededByIngredient)) {
      const ingredient = ingredientMap[name];

      if (!ingredient) {
        // Ingredient not found in stock — report as shortage with the dominant quantity
        let displayNeeded = 0;
        let displayUnit = 'units';
        if (needed.grams > 0) {
          displayNeeded = needed.grams;
          displayUnit = 'g';
        } else if (needed.ml > 0) {
          displayNeeded = needed.ml;
          displayUnit = 'ml';
        } else if (needed.units > 0) {
          displayNeeded = needed.units;
          displayUnit = 'units';
        }

        shortages.push({
          ingredient_name: name,
          needed: displayNeeded,
          available: 0,
          unit: displayUnit,
          deficit: displayNeeded,
        });
        sufficient = false;
        continue;
      }

      const stockUnit = (ingredient.unit || 'units').toLowerCase().trim();
      const available = Number(ingredient.quantity) || 0;

      // Convert needed amounts to the stock unit for comparison
      let totalNeededInStockUnit = 0;

      if (needed.grams > 0) {
        // grams → stock unit: if stock is in kg, divide by 1000
        totalNeededInStockUnit += stockUnit === 'kg' ? needed.grams / 1000 : needed.grams;
      }
      if (needed.units > 0) {
        // units stay as-is
        totalNeededInStockUnit += needed.units;
      }
      if (needed.ml > 0) {
        // ml → stock unit: if stock is in l, divide by 1000
        totalNeededInStockUnit += stockUnit === 'l' ? needed.ml / 1000 : needed.ml;
      }

      if (totalNeededInStockUnit > available) {
        // Deficit in the stock's unit
        const deficit = totalNeededInStockUnit - available;

        // For the display, report needed/available in the stock unit
        shortages.push({
          ingredient_name: name,
          needed: totalNeededInStockUnit,
          available,
          unit: stockUnit,
          deficit,
        });
        sufficient = false;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        sufficient,
        shortages,
      },
    });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
