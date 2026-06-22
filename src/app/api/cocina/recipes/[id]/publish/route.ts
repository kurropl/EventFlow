/**
 * EventFlow — Publicar receta en catálogo
 * POST /api/cocina/recipes/[id]/publish
 * 
 * Toma la receta, crea un catalog_item con el mismo nombre,
 * vincula recipe_items desde los ingredientes de la receta,
 * marca published=true y catalog_item_id en la receta.
 * 
 * Si ya está publicada, devuelve 409.
 * Si no tiene catalog_item_id, la crea en una transacción.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { z } from 'zod';

const PublishSchema = z.object({
  category: z.string().min(1, 'La categoría del plato es obligatoria'),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pool = getPool();

  try {
    // Validar UUID
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'ID de receta inválido' }, { status: 400 });
    }

    const body = await req.json();
    const parsed = PublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { category } = parsed.data;

    // Obtener la receta
    const recipeResult = await pool.query(
      'SELECT * FROM recipes WHERE id = $1 AND active = true',
      [id]
    );

    if (!recipeResult.rows.length) {
      return NextResponse.json({ error: 'Receta no encontrada' }, { status: 404 });
    }

    const recipe = recipeResult.rows[0];

    // Si ya está publicada
    if (recipe.published && recipe.catalog_item_id) {
      return NextResponse.json({
        error: 'La receta ya está publicada',
        catalog_item_id: recipe.catalog_item_id,
      }, { status: 409 });
    }

    // Si no tiene ingredientes
    if (!recipe.ingredients || !Array.isArray(recipe.ingredients) || !recipe.ingredients.length) {
      return NextResponse.json({ error: 'La receta no tiene ingredientes. Añádelos antes de publicar.' }, { status: 400 });
    }

    // Iniciar transacción
    await pool.query('BEGIN');

    try {
      // 1. Crear catalog_item
      const catResult = await pool.query(
        `INSERT INTO catalog_items (name, category, active, created_at)
         VALUES ($1, $2, true, NOW())
         RETURNING id`,
        [recipe.name, category]
      );
      const catalogItemId = catResult.rows[0].id;

      // 2. Para cada ingrediente de la receta, crear recipe_item
      for (const ing of recipe.ingredients) {
        // Buscar o crear ingredient_id
        let ingId: string | null = null;
        const existing = await pool.query(
          'SELECT id FROM ingredients WHERE name = $1',
          [ing.name]
        );
        if (existing.rows.length) {
          ingId = existing.rows[0].id;
        } else {
          const newIng = await pool.query(
            'INSERT INTO ingredients (name, unit, category) VALUES ($1, $2, NULL) ON CONFLICT (name) DO NOTHING RETURNING id',
            [ing.name, ing.unit || 'g']
          );
          if (newIng.rows.length) ingId = newIng.rows[0].id;
        }

        if (ingId) {
          await pool.query(
            `INSERT INTO recipe_items (catalog_item_id, ingredient_id, quantity, unit, version)
             VALUES ($1, $2, $3, $4, 1)`,
            [catalogItemId, ingId, ing.quantity || 0, ing.unit || 'g']
          );
        }
      }

      // 3. Actualizar receta con catalog_item_id y published
      await pool.query(
        `UPDATE recipes SET catalog_item_id = $1, published = true
         WHERE id = $2`,
        [catalogItemId, id]
      );

      await pool.query('COMMIT');

      return NextResponse.json({
        success: true,
        recipe_id: id,
        catalog_item_id: catalogItemId,
        name: recipe.name,
      });
    } catch (txError) {
      await pool.query('ROLLBACK');
      throw txError;
    }
  } catch (error: any) {
    console.error('Error publishing recipe:', error);
    return NextResponse.json({ error: error.message || 'Error al publicar receta' }, { status: 500 });
  }
}