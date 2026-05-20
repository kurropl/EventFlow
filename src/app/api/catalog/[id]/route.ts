/**
 * EventFlow — Catalog Item API Routes (single item)
 * GET /api/catalog/[id] — Get a single catalog item by ID
 * PATCH /api/catalog/[id] — Update a catalog item (admin only)
 * DELETE /api/catalog/[id] — Soft delete (set active=false, admin only)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { CatalogItemUpdateSchema } from '@/types/specs';

// ============================================================
// GET — Single catalog item by ID
// ============================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid catalog item ID (must be a UUID)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    const { data, error } = await (supabase as any).from('catalog_items' as any)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Catalog item not found' },
          { status: 404 }
        );
      }
      console.error('[catalog/[id] GET] Supabase error:', error);
      throw new Error(`Failed to fetch catalog item: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Catalog item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// PATCH — Update catalog item (admin only, validated with Zod)
// ============================================================

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid catalog item ID (must be a UUID)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Parse and validate body with Zod
    const body = await request.json();
    const validated = CatalogItemUpdateSchema.parse(body);

    // Admin check
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw new Error('Authentication required');
    }

    const userRole = (authData.user?.user_metadata?.role ?? '') as string;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Update the catalog item
    const { data, error } = await (supabase as any)
      .from('catalog_items')
      .update(validated)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[catalog/[id] PATCH] Supabase error:', error);
      throw new Error(`Failed to update catalog item: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Catalog item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
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
// DELETE — Soft delete (set active=false, admin only)
// ============================================================

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid catalog item ID (must be a UUID)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Admin check
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw new Error('Authentication required');
    }

    const userRole = (authData.user?.user_metadata?.role ?? '') as string;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Soft delete: set active=false
    const { data, error } = await (supabase as any).from('catalog_items' as any)
      .update({ active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[catalog/[id] DELETE] Supabase error:', error);
      throw new Error(`Failed to delete catalog item: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Catalog item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { ...data, active: false } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
