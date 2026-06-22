/**
 * EventFlow — Recetas API (Módulo Cocina)
 * GET  /api/cocina/recipes — Listar recetas con filtros
 * POST /api/cocina/recipes — Crear receta manual
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

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
  difficulty: z.enum(['fácil', 'media', 'difícil']).optional().nullable(),
  active: z.boolean().optional().default(true),
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
  difficulty: z.enum(['fácil', 'media', 'difícil']).optional().nullable(),
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
    } = parsed.data;

    const created = await querySingle<any>(
      `INSERT INTO recipes
         (name, description, source, servings, category, ingredients, instructions,
          prep_time, cook_time, difficulty, version, active, published)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        name.trim(),
        description ?? null,
        source ?? null,
        servings ?? null,
        category ?? null,
        JSON.stringify(ingredients),
        instructions ?? null,
        prep_time ?? null,
        cook_time ?? null,
        difficulty ?? null,
        1,
        active,
        false,
      ]
    );

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
