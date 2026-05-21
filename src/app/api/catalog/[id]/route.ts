/**
 * EventFlow — Catalog Item by ID API Route
 * GET /api/catalog/[id] — Get single catalog item
 * PUT /api/catalog/[id] — Update catalog item
 * DELETE /api/catalog/[id] — Delete catalog item
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { querySingle } from '@/lib/db';

// ============================================================
// GET — Single catalog item
// ============================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await querySingle<any>(
      `SELECT * FROM catalog_items WHERE id = $1`,
      [id]
    );

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// PUT — Update catalog item
// ============================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, category, subcategory, pvp, cost, ingredientes_base, image_url, active } = body;

    const item = await querySingle<any>(
      `UPDATE catalog_items
       SET name = COALESCE($1, name),
           category = COALESCE($2, category),
           subcategory = $3,
           pvp = COALESCE($4, pvp),
           cost = COALESCE($5, cost),
           ingredients = COALESCE($6, ingredients),
           image_url = $7,
           active = COALESCE($8, active)
       WHERE id = $9
       RETURNING *`,
      [
        name ?? null,
        category ?? null,
        subcategory ?? null,
        pvp ?? null,
        cost ?? null,
        ingredientes_base ? JSON.stringify(ingredientes_base) : null,
        image_url ?? null,
        active ?? null,
        id,
      ]
    );

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// DELETE — Delete catalog item
// ============================================================

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await querySingle<any>(
      `DELETE FROM catalog_items WHERE id = $1 RETURNING id`,
      [id]
    );

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}