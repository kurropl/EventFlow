/**
 * EventFlow — Receta por ID API (Módulo Cocina)
 * GET    /api/cocina/recipes/[id] — Detalle receta
 * PUT    /api/cocina/recipes/[id] — Actualizar receta
 * DELETE /api/cocina/recipes/[id] — Soft-delete (active=false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError, isValidUUID } from '@/lib/security';

// ── Auth helper ─────────────────────────────────────────────────────

async function verifyAuth(request: NextRequest) {
  const token =
    request.cookies.get('admin_session')?.value ||
    request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ── GET: Detalle receta ──────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const recipe = await querySingle<any>(
      `SELECT * FROM recipes WHERE id = $1`,
      [id]
    );

    if (!recipe) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    // Parsear ingredients si viene como string JSON
    if (typeof recipe.ingredients === 'string') {
      try {
        recipe.ingredients = JSON.parse(recipe.ingredients);
      } catch {
        recipe.ingredients = [];
      }
    }

    return NextResponse.json({ success: true, data: recipe });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── PUT: Actualizar receta ───────────────────────────────────────────

const UpdateRecipeSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  source: z.string().max(200).optional().nullable(),
  servings: z.number().int().positive().optional().nullable(),
  category: z.string().optional().nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().positive().optional().nullable(),
        unit: z.string().optional().nullable(),
      })
    )
    .optional(),
  instructions: z.string().optional().nullable(),
  prep_time: z.number().int().nonnegative().optional().nullable(),
  cook_time: z.number().int().nonnegative().optional().nullable(),
  difficulty: z.enum(['fácil', 'media', 'difícil']).optional().nullable(),
  active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const existing = await querySingle<any>(
      `SELECT id FROM recipes WHERE id = $1`,
      [id]
    );

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = UpdateRecipeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.issues[0]?.message || 'Validation error',
          details: parsed.error.issues,
        },
        { status: 422 }
      );
    }

    const { name, description, source, servings, category, ingredients, instructions, prep_time, cook_time, difficulty, active } = parsed.data;

    // Build dynamic SET
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) { sets.push(`name = $${idx++}`); values.push(name.trim()); }
    if (description !== undefined) { sets.push(`description = $${idx++}`); values.push(description ?? null); }
    if (source !== undefined) { sets.push(`source = $${idx++}`); values.push(source ?? null); }
    if (servings !== undefined) { sets.push(`servings = $${idx++}`); values.push(servings ?? null); }
    if (category !== undefined) { sets.push(`category = $${idx++}`); values.push(category ?? null); }
    if (ingredients !== undefined) { sets.push(`ingredients = $${idx++}::jsonb`); values.push(JSON.stringify(ingredients)); }
    if (instructions !== undefined) { sets.push(`instructions = $${idx++}`); values.push(instructions ?? null); }
    if (prep_time !== undefined) { sets.push(`prep_time = $${idx++}`); values.push(prep_time ?? null); }
    if (cook_time !== undefined) { sets.push(`cook_time = $${idx++}`); values.push(cook_time ?? null); }
    if (difficulty !== undefined) { sets.push(`difficulty = $${idx++}`); values.push(difficulty ?? null); }
    if (active !== undefined) { sets.push(`active = $${idx++}`); values.push(active); }

    if (sets.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nada que actualizar' },
        { status: 400 }
      );
    }

    sets.push(`updated_at = now()`);
    values.push(id);

    const updated = await querySingle<any>(
      `UPDATE recipes SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    // Parsear ingredients si viene como string JSON
    if (updated && typeof updated.ingredients === 'string') {
      try {
        updated.ingredients = JSON.parse(updated.ingredients);
      } catch {
        updated.ingredients = [];
      }
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── DELETE: Soft-delete con cascada ──────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    if (!isValidUUID(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const recipe = await querySingle<any>(
      `SELECT id, catalog_item_id, published FROM recipes WHERE id = $1`,
      [id]
    );

    if (!recipe) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    // Si está publicada y tiene catalog_item_id, no se puede borrar
    if (recipe.catalog_item_id !== null && recipe.published === true) {
      return NextResponse.json(
        { success: false, error: 'Despublica antes de eliminar' },
        { status: 409 }
      );
    }

    // Cascada: si tiene catalog_item_id, borrar el catalog_item (que cascadea a recipe_items)
    if (recipe.catalog_item_id !== null) {
      await queryMany(
        `DELETE FROM catalog_items WHERE id = $1`,
        [recipe.catalog_item_id]
      );
    }

    // Soft-delete: marcar como inactiva
    const deleted = await querySingle<any>(
      `UPDATE recipes SET active = false, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id]
    );

    return NextResponse.json({ success: true, data: { id: deleted.id, active: deleted.active } });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}