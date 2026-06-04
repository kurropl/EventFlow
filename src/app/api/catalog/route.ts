/**
 * EventFlow — Catalog API Routes
 * GET /api/catalog — List all active catalog items grouped by category
 * POST /api/catalog — Create a new catalog item (admin only, validated with Zod)
 * PUT /api/catalog — Update a catalog item
 * DELETE /api/catalog — Soft-delete a catalog item
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryMany, querySingle } from '@/lib/db';
import { CatalogItemCreateSchema } from '@/types/specs';

// ============================================================
// GET — Return all active catalog items grouped by category
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const showAll = searchParams.get('all') === 'true';
    const activeFilter = showAll ? '' : 'WHERE active = true';
    // Return ALL items (active + inactive) for admin management
    const items = await queryMany<any>(
      `SELECT id, name, category, subcategory, pvp, cost, ingredients, image_url, active, created_at, updated_at
       FROM catalog_items
       ${activeFilter}
       ORDER BY category, name`
    );

    // Group by category
    const grouped: Record<string, typeof items> = {};
    for (const item of items ?? []) {
      const key = item.category;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return NextResponse.json({ success: true, data: grouped });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// POST — Create a new catalog item
// ============================================================

export async function POST(request: NextRequest) {
  try {
    // Parse and validate body with Zod
    const body = await request.json();
    const validated = CatalogItemCreateSchema.parse(body);

    // Insert into catalog_items
    const item = await querySingle<any>(
      `INSERT INTO catalog_items (name, category, subcategory, pvp, cost, ingredients, image_url, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        validated.name,
        validated.category,
        validated.subcategory ?? null,
        validated.pvp,
        validated.cost,
        JSON.stringify(validated.ingredientes_base || []),
        validated.image_url || null,
        validated.active,
      ]
    );

    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 422 }
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT — Update a catalog item
// ============================================================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, category, pvp, cost, active } = body;
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    const item = await querySingle<any>(
      `UPDATE catalog_items SET name = COALESCE(NULLIF($2, ''), name),
        category = COALESCE(NULLIF($3, ''), category),
        pvp = COALESCE(NULLIF($4, 0)::numeric, pvp),
        cost = COALESCE(NULLIF($5, 0)::numeric, cost),
        active = COALESCE($6, active)
      WHERE id = $7 RETURNING *`,
      [null, name ?? null, category ?? null, pvp ?? null, cost ?? null, active ?? null, id]
    );

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ============================================================
// DELETE — Soft-delete a catalog item
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 });
    }

    await queryMany(
      `UPDATE catalog_items SET active = false WHERE id = $1`,
      [id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
