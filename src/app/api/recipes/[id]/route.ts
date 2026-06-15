/**
 * EventFlow — Recipe Template by ID API
 * GET    /api/recipes/[id] — Get a single recipe template with items
 * PUT    /api/recipes/[id] — Update a recipe template + replace items
 * DELETE /api/recipes/[id] — Delete a recipe template (CASCADE deletes items)
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, transaction } from '@/lib/db';
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

// ── Helper: Fetch a recipe template with its items ─────────────────

async function getRecipeWithItems(id: string) {
  return querySingle<any>(
    `SELECT
       rt.*,
       COALESCE(
         json_agg(rti ORDER BY rti.sort_order) FILTER (WHERE rti.id IS NOT NULL),
         '[]'::json
       ) AS items
     FROM recipe_templates rt
     LEFT JOIN recipe_template_items rti ON rti.recipe_id = rt.id
     WHERE rt.id = $1
     GROUP BY rt.id`,
    [id]
  );
}

// ── GET: Get single recipe template with items ──────────────────────

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
    const recipe = await getRecipeWithItems(id);

    if (!recipe) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: recipe });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── PUT: Update recipe template + replace items ─────────────────────

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
    const body = await request.json();
    const { name, category, base_pax, description, is_active, items } = body;

    // Check that the template exists
    const existing = await querySingle<any>(
      `SELECT id FROM recipe_templates WHERE id = $1`,
      [id]
    );
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    // Build dynamic SET clause — only update provided fields
    const sets: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name !== undefined) {
      sets.push(`name = $${idx++}`);
      values.push(String(name).trim());
    }
    if (category !== undefined) {
      sets.push(`category = $${idx++}`);
      values.push(category || null);
    }
    if (base_pax !== undefined) {
      sets.push(`base_pax = $${idx++}`);
      values.push(base_pax || null);
    }
    if (description !== undefined) {
      sets.push(`description = $${idx++}`);
      values.push(description || null);
    }
    if (is_active !== undefined) {
      sets.push(`is_active = $${idx++}`);
      values.push(Boolean(is_active));
    }

    const result = await transaction(async (client) => {
      // Update template fields if any were provided
      if (sets.length > 0) {
        sets.push(`updated_at = now()`);
        values.push(id);
        await client.query(
          `UPDATE recipe_templates SET ${sets.join(', ')} WHERE id = $${idx}`,
          values
        );
      }

      // Replace items if provided
      if (Array.isArray(items)) {
        // Delete old items
        await client.query(
          `DELETE FROM recipe_template_items WHERE recipe_id = $1`,
          [id]
        );

        // Insert new items
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          await client.query(
            `INSERT INTO recipe_template_items
               (recipe_id, ingredient_name, quantity_per_pax, unit, provider_name, sort_order)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              id,
              item.ingredient_name,
              item.quantity_per_pax || 0,
              item.unit || null,
              item.provider_name || null,
              item.sort_order ?? i,
            ]
          );
        }
      }

      // Return the updated template with items
      return getRecipeWithItems(id);
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── DELETE: Delete recipe template (CASCADE deletes items) ──────────

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
    const deleted = await querySingle<any>(
      `DELETE FROM recipe_templates WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Receta no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
