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
import { computeFichaTotales } from '@/lib/fichaTecnica';

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

    // WP-11: leer de catalog_items (tabla canónica unificada)
    const recipe = await querySingle<any>(
      `SELECT id, name, description, source, source_file, servings, category,
              catalog_item_id, published, ingredients, instructions,
              prep_time, cook_time, difficulty, version, active,
              created_at, updated_at, merma_pct, peso_racion,
              author, allergens::text as allergens, photo_url
       FROM catalog_items WHERE id = $1`,
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

    // Ficha técnica: líneas de ingrediente + precio/coste del catalog_item +
    // multiplicador de precio mínimo, todo en una sola llamada para el editor.
    let catalogItem = null;
    let lineas: any[] = [];
    if (recipe.catalog_item_id) {
      catalogItem = await querySingle<any>(
        `SELECT id, pvp, cost, category FROM catalog_items WHERE id = $1`,
        [recipe.catalog_item_id]
      );
      lineas = await queryMany<any>(
        `SELECT ri.id, ri.ingredient_id, i.name AS ingredient_name, ri.quantity, ri.unit,
                COALESCE(i.unit_cost, 0) AS unit_cost, ri.notes
         FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
         WHERE ri.catalog_item_id = $1
         ORDER BY i.name ASC`,
        [recipe.catalog_item_id]
      );
    }
    const settings = await querySingle<any>(`SELECT min_price_multiplier FROM business_settings LIMIT 1`);
    const minPriceMultiplier = Number(settings?.min_price_multiplier) || 3;
    const totales = computeFichaTotales(
      lineas.map((l) => ({ quantity: Number(l.quantity), unitCost: Number(l.unit_cost) })),
      Number(recipe.merma_pct) || 0,
      recipe.peso_racion != null ? Number(recipe.peso_racion) : null,
      minPriceMultiplier,
      catalogItem?.pvp != null ? Number(catalogItem.pvp) : null
    );

    return NextResponse.json({
      success: true,
      data: {
        ...recipe,
        catalogItem: catalogItem ? { ...catalogItem, pvp: Number(Number(catalogItem.pvp).toFixed(2)), cost: Number(Number(catalogItem.cost).toFixed(2)) } : null,
        lineas: (lineas || []).map((l: any) => ({
          ...l,
          quantity: Number(Number(l.quantity).toFixed(2)),
          unit_cost: Number(Number(l.unit_cost).toFixed(2)),
        })),
        minPriceMultiplier,
        totales: totales ? {
          ...totales,
          costeTotal: Number(totales.costeTotal.toFixed(2)),
          costeMateriaPrima: Number(totales.costeMateriaPrima.toFixed(2)),
          costeUnitario: totales.costeUnitario !== null ? Number(totales.costeUnitario.toFixed(2)) : null,
          precioMinimo: totales.precioMinimo !== null ? Number(totales.precioMinimo.toFixed(2)) : null,
          beneficioUnitario: totales.beneficioUnitario !== null ? Number(totales.beneficioUnitario.toFixed(2)) : null,
          beneficioTotal: totales.beneficioTotal !== null ? Number(totales.beneficioTotal.toFixed(2)) : null,
        } : null,
      },
    });
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
  difficulty: z.enum(['facil', 'media', 'dificil']).optional().nullable(),
  active: z.boolean().optional(),
  published: z.boolean().optional(),
  // Ficha técnica
  merma_pct: z.number().min(0).max(99).optional(),
  peso_racion: z.number().positive().optional().nullable(),
  author: z.string().max(200).optional().nullable(),
  allergens: z.string().max(2000).optional().nullable(),
  photo_url: z.string().max(2000).optional().nullable(),
  // Vive en catalog_items, no en recipes — se sincroniza aparte en el PUT.
  pvp: z.number().min(0).optional(),
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

    // WP-11: verificar en catalog_items (tabla canónica)
    const existing = await querySingle<any>(
      `SELECT id FROM catalog_items WHERE id = $1`,
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

    const {
      name, description, source, servings, category, ingredients, instructions,
      prep_time, cook_time, difficulty, active, published,
      merma_pct, peso_racion, author, allergens, photo_url, pvp,
    } = parsed.data;

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
    // "published" nunca fue un campo reconocido por este schema — el botón
    // Publicar/Retirar de CocinaPanel.tsx enviaba solo {published} y zod lo
    // descartaba en silencio, dejando `sets` vacío → 400 "Nada que
    // actualizar" en todos los casos. Ahora sí es un campo válido.
    if (published !== undefined) { sets.push(`published = $${idx++}`); values.push(published); }
    if (merma_pct !== undefined) { sets.push(`merma_pct = $${idx++}`); values.push(merma_pct); }
    if (peso_racion !== undefined) { sets.push(`peso_racion = $${idx++}`); values.push(peso_racion ?? null); }
    if (author !== undefined) { sets.push(`author = $${idx++}`); values.push(author ?? null); }
    if (allergens !== undefined) { sets.push(`allergens = $${idx++}`); values.push(allergens ?? null); }
    if (photo_url !== undefined) { sets.push(`photo_url = $${idx++}`); values.push(photo_url ?? null); }

    if (sets.length === 0 && pvp === undefined) {
      return NextResponse.json(
        { success: false, error: 'Nada que actualizar' },
        { status: 400 }
      );
    }

    // WP-11: actualizar directamente en catalog_items (tabla unificada)
    const result = await transaction(async (client) => {
      if (sets.length > 0) {
        sets.push(`updated_at = now()`);
        values.push(id);
        await client.query(`UPDATE catalog_items SET ${sets.join(', ')} WHERE id = $${idx}`, values);
      }

      if (pvp !== undefined) {
        await client.query(`UPDATE catalog_items SET pvp = $1 WHERE id = $2`, [pvp, id]);
      }

      // Recompute ficha técnica
      const recipe = (await client.query(
        `SELECT merma_pct, peso_racion FROM catalog_items WHERE id = $1`, [id]
      )).rows[0];

      const lineas = (await client.query(
        `SELECT ri.quantity, COALESCE(i.unit_cost, 0) AS unit_cost
         FROM recipe_items ri JOIN ingredients i ON i.id = ri.ingredient_id
         WHERE ri.catalog_item_id = $1`, [id]
      )).rows;

      const settings = (await client.query(`SELECT min_price_multiplier FROM business_settings LIMIT 1`)).rows[0];
      const { computeFichaTotales } = await import('@/lib/fichaTecnica');
      const totales = computeFichaTotales(
        lineas.map((l: any) => ({ quantity: Number(l.quantity), unitCost: Number(l.unit_cost) })),
        Number(recipe?.merma_pct) || 0,
        recipe?.peso_racion != null ? Number(recipe.peso_racion) : null,
        Number(settings?.min_price_multiplier) || 3,
        pvp != null ? pvp : null
      );

      await client.query(`UPDATE catalog_items SET servings = $1 WHERE id = $2`,
        [Math.max(1, Math.round(totales.raciones ?? 1)), id]);

      const updated = (await client.query(
        `SELECT id, name, description, source, servings, category,
                catalog_item_id, published, ingredients, instructions,
                prep_time, cook_time, difficulty, version, active,
                created_at, updated_at, merma_pct, peso_racion,
                author, allergens::text as allergens, photo_url
         FROM catalog_items WHERE id = $1`, [id]
      )).rows[0];

      return { recipe: updated, catalogItem: { id, pvp: totales.precioMinimo, cost: totales.costeTotal }, totales };
    });

    // Parsear ingredients si viene como string JSON
    if (result?.recipe && typeof result.recipe.ingredients === 'string') {
      try {
        result.recipe.ingredients = JSON.parse(result.recipe.ingredients);
      } catch {
        result.recipe.ingredients = [];
      }
    }

    return NextResponse.json({ success: true, data: result });
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

    // WP-11: trabajar con catalog_items (tabla canónica)
    const dish = await querySingle<any>(
      `SELECT id, published FROM catalog_items WHERE id = $1`,
      [id]
    );

    if (!dish) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    // Si está publicada, no se puede borrar
    if (dish.published === true) {
      return NextResponse.json(
        { success: false, error: 'Despublica antes de eliminar' },
        { status: 409 }
      );
    }

    // Soft-delete: marcar como inactiva
    const deleted = await querySingle<any>(
      `UPDATE catalog_items SET active = false, updated_at = now() WHERE id = $1 RETURNING id, active`,
      [id]
    );

    return NextResponse.json({ success: true, data: { id: deleted.id, active: deleted.active } });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}