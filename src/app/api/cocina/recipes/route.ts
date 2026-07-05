/**
 * EventFlow — Recetas API (Módulo Cocina)
 * GET  /api/cocina/recipes — Listar recetas con filtros
 * POST /api/cocina/recipes — Crear receta manual
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryMany, transaction } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { normalizeCategory } from '@/lib/recipeImport';
import { recomputeFicha } from '@/lib/domain/fichaTecnicaSync';

// ── Auth helper ─────────────────────────────────────────────────────

async function verifyAuth(request: NextRequest) {
  const token =
    request.cookies.get('admin_session')?.value ||
    request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ── Zod schemas ─────────────────────────────────────────────────────

const CreateRecipeSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
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
    .optional()
    .default([]),
  instructions: z.string().optional().nullable(),
  prep_time: z.number().int().nonnegative().optional().nullable(),
  cook_time: z.number().int().nonnegative().optional().nullable(),
  difficulty: z.enum(['facil', 'media', 'dificil']).optional().nullable(),
  active: z.boolean().optional().default(true),
  // Ficha técnica (PLANTILLA_FICHA_TECNICA_AUTOMATIZADA): merma agregada de
  // receta (reemplaza al merma_pct por-ingrediente), peso objetivo por
  // ración (las raciones se derivan de él), autor, alérgenos y foto.
  merma_pct: z.number().min(0).max(99).optional().default(20),
  peso_racion: z.number().positive().optional().nullable(),
  author: z.string().max(200).optional().nullable(),
  allergens: z.string().max(2000).optional().nullable(),
  photo_url: z.string().max(2000).optional().nullable(),
});

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
  difficulty: z.enum(['facil', 'media', 'dificil']).optional().nullable(),
  active: z.boolean().optional(),
});

// ── GET: Listar recetas ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const active = searchParams.get('active');
    const search = searchParams.get('search');

    const conditions: string[] = [];
    const values: (string | boolean)[] = [];
    let idx = 1;

    if (category) {
      conditions.push(`category = $${idx++}`);
      values.push(category);
    }

    if (active !== null && active !== '') {
      conditions.push(`active = $${idx++}`);
      values.push(active === 'true');
    }

    if (search) {
      conditions.push(`(name ILIKE $${idx} OR description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await queryMany<any>(
      `SELECT * FROM recipes ${where} ORDER BY updated_at DESC`,
      values
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST: Crear receta manual ───────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreateRecipeSchema.safeParse(body);

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

    const {
      name,
      description,
      source,
      servings,
      category,
      ingredients,
      instructions,
      prep_time,
      cook_time,
      difficulty,
      active,
      merma_pct,
      peso_racion,
      author,
      allergens,
      photo_url,
    } = parsed.data;

    const catCategory = normalizeCategory(category);

    // La ficha técnica ya no pasa por un "publicar" aparte: el catalog_item
    // se crea a la vez que la receta, para que las líneas de ingrediente
    // (recipe_items) tengan dónde engancharse desde el primer guardado.
    const created = await transaction(async (client) => {
      const recipe = (await client.query(
        `INSERT INTO recipes
           (name, description, source, servings, category, ingredients, instructions,
            prep_time, cook_time, difficulty, version, active, published,
            merma_pct, peso_racion, author, allergens, photo_url)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         RETURNING *`,
        [
          name.trim(),
          description ?? null,
          source ?? null,
          servings ?? null,
          catCategory,
          JSON.stringify(ingredients),
          instructions ?? null,
          prep_time ?? null,
          cook_time ?? null,
          difficulty ?? null,
          1,
          active,
          false,
          merma_pct,
          peso_racion ?? null,
          author ?? null,
          allergens ?? null,
          photo_url ?? null,
        ]
      )).rows[0];

      const catalogItem = (await client.query(
        `INSERT INTO catalog_items (name, category, pvp, cost, ingredients, active)
         VALUES ($1, $2, 0, 0, '[]'::jsonb, true) RETURNING id`,
        [recipe.name, catCategory]
      )).rows[0];
      await client.query(`UPDATE recipes SET catalog_item_id = $1 WHERE id = $2`, [catalogItem.id, recipe.id]);
      recipe.catalog_item_id = catalogItem.id;

      return recipe;
    });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
