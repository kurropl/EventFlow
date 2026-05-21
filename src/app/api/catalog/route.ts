/**
 * EventFlow — Catalog API Routes
 * GET /api/catalog — List all active catalog items grouped by category
 * POST /api/catalog — Create a new catalog item (admin only, validated with Zod)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryMany, querySingle } from '@/lib/db';
import { CatalogItemCreateSchema } from '@/types/specs';

// ============================================================
// GET — Return all active catalog items grouped by category
// ============================================================

export async function GET() {
  try {
    const items = await queryMany<any>(
      `SELECT id, name, category, subcategory, pvp, cost, ingredients, image_url, active, created_at, updated_at
       FROM catalog_items
       WHERE active = true
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
