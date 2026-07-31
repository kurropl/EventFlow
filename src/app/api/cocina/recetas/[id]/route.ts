/**
 * EventFlow — API: Receta individual
 * GET  - Ver detalle de receta con ingredientes
 * DELETE - Eliminar receta
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const recipe = await querySingle<any>(
      "SELECT r.id, r.name, r.description, r.source, r.servings, r.category, r.catalog_item_id, r.published, r.instructions, r.prep_time, r.cook_time, r.difficulty, r.version, r.active, r.created_at, r.updated_at, r.cost_per_serving, r.merma_pct, r.allergens, ci.pvp, ci.cost FROM recipes r LEFT JOIN catalog_items ci ON ci.id = r.catalog_item_id WHERE r.id = $1",
      [params.id]
    );
    if (!recipe) return NextResponse.json({ success: false, error: 'Receta no encontrada' }, { status: 404 });

    const ingredients = await queryMany<any>(
      "SELECT ri.id, ri.ingredient_id, i.name as ingredient_name, ri.quantity, ri.unit, ri.per_guest, ri.cost, COALESCE(i.unit_cost, i.cost_per_unit, 0) as unit_price FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id WHERE ri.recipe_id = $1 ORDER BY ri.id",
      [params.id]
    );

    // Merma por defecto de la receta o 0.2
    const mermaPct = Number(recipe.merma_pct || 0.2);
    const rawCost = ingredients.reduce((s: number, ing: any) => s + Number(ing.cost || 0), 0);
    const totalCost = rawCost * (1 + mermaPct);

    return NextResponse.json({
      success: true,
      data: {
        ...recipe,
        ingredients,
        computed: {
          raw_cost: rawCost,
          merma_pct: mermaPct,
          total_cost: totalCost,
          cost_per_unit: recipe.servings > 0 ? totalCost / recipe.servings : totalCost,
          suggested_price: totalCost * 3,
          profit: (totalCost * 3) - totalCost
        }
      }
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const body = await request.json();
    const { name, category, description, instructions, merma_pct, allergens, servings } = body;

    // Update recipe basic info
    await querySingle(
      `UPDATE recipes SET
        name = COALESCE($1, name),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        instructions = COALESCE($4, instructions),
        merma_pct = COALESCE($5, merma_pct),
        allergens = $6,
        servings = COALESCE($7, servings),
        updated_at = NOW()
       WHERE id = $8`,
      [name, category, description, instructions, merma_pct, allergens ? JSON.stringify(allergens) : null, servings, params.id]
    );

    // Update ingredients if provided
    if (body.ingredients && Array.isArray(body.ingredients)) {
      // Delete existing ingredients
      await querySingle('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [params.id]);

      // Insert new ingredients
      for (const ing of body.ingredients) {
        // Find or create ingredient
        let ingRow = await querySingle<any>(
          'SELECT id, unit_cost FROM ingredients WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [ing.ingrediente]
        );

        let ingredientId: string;
        let unitCost = ing.precio || 0;

        if (ingRow) {
          ingredientId = ingRow.id;
          unitCost = Number(ingRow.unit_cost) || ing.precio || 0;
        } else {
          const newIng = await querySingle<any>(
            `INSERT INTO ingredients (name, unit_cost, cost_per_unit, unit, active, created_at, updated_at)
             VALUES ($1, $2, $2, $3, true, NOW(), NOW()) RETURNING id`,
            [ing.ingrediente, unitCost, ing.medida || 'g']
          );
          ingredientId = newIng.id;
        }

        const quantity = Number(ing.cantidad) || 0;
        const cost = quantity * unitCost;

        await querySingle(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit, cost, per_guest)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [params.id, ingredientId, quantity, ing.medida || 'g', cost]
        );
      }

      // Recalculate total cost
      const totalCost = body.ingredients.reduce((s: number, i: any) => s + (Number(i.cantidad) || 0) * (Number(i.precio) || 0), 0);
      await querySingle('UPDATE recipes SET cost_per_serving = $1, updated_at = NOW() WHERE id = $2', [totalCost, params.id]);
    }

    return NextResponse.json({ success: true, message: 'Receta actualizada' });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    await querySingle('DELETE FROM recipes WHERE id = $1', [params.id]);
    return NextResponse.json({ success: true, message: 'Receta eliminada' });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}