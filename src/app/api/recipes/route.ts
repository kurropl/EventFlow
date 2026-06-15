/**
 * EventFlow — Recipe Templates API
 * GET  /api/recipes — List all recipe templates with their items
 * POST /api/recipes — Create a new recipe template with items
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, transaction } from '@/lib/db';
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

// ── GET: List all recipe templates with items ───────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const rows = await queryMany<any>(
      `SELECT
         rt.*,
         COALESCE(
           json_agg(rti ORDER BY rti.sort_order) FILTER (WHERE rti.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM recipe_templates rt
       LEFT JOIN recipe_template_items rti ON rti.recipe_id = rt.id
       GROUP BY rt.id
       ORDER BY rt.category, rt.name`
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST: Create a new recipe template with items ───────────────────

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
    const { name, category, base_pax, description, items } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'El nombre es obligatorio' },
        { status: 422 }
      );
    }

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { success: false, error: 'items debe ser un array' },
        { status: 422 }
      );
    }

    const result = await transaction(async (client) => {
      // Insert the recipe template
      const templateResult = await client.query(
        `INSERT INTO recipe_templates (name, category, base_pax, description)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          name.trim(),
          category || null,
          base_pax || null,
          description || null,
        ]
      );
      const template = templateResult.rows[0];

      // Insert items
      const insertedItems: any[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemResult = await client.query(
          `INSERT INTO recipe_template_items
             (recipe_id, ingredient_name, quantity_per_pax, unit, provider_name, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [
            template.id,
            item.ingredient_name,
            item.quantity_per_pax || 0,
            item.unit || null,
            item.provider_name || null,
            item.sort_order ?? i,
          ]
        );
        insertedItems.push(itemResult.rows[0]);
      }

      return { ...template, items: insertedItems };
    });

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const message = sanitizeError(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
