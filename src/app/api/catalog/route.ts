/**
 * EventFlow — Catalog API Routes
 * GET /api/catalog — List all active catalog items grouped by category
 * POST /api/catalog — Create a new catalog item (admin only, validated with Zod)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { CatalogItemCreateSchema } from '@/types/specs';

// ============================================================
// GET — Return all active catalog items grouped by category
// ============================================================

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data: items, error } = await (supabase as any).from('catalog_items' as any)
      .select('*')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('[catalog GET] Supabase error:', error);
      throw new Error(`Failed to fetch catalog items: ${error.message}`);
    }

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
// POST — Create a new catalog item (admin only, validated with Zod)
// ============================================================

const handler = { GET };

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseServerClient();

    // Parse and validate body with Zod
    const body = await request.json();
    const validated = CatalogItemCreateSchema.parse(body);

    // Admin check — Supabase RLS handles this, but we also check the role
    // In a real app, you'd verify the JWT role claim here
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      throw new Error('Authentication required');
    }

    // Check admin role (RLS policy also enforces this)
    const userRole = (authData.user?.user_metadata?.role ?? '') as string;
    if (userRole !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Insert into catalog_items
    const { data, error } = await (supabase as any).from('catalog_items' as any)
      .insert({
        name: validated.name,
        category: validated.category,
        subcategory: validated.subcategory ?? null,
        pvp: validated.pvp,
        cost: validated.cost,
        ingredientes_base: validated.ingredientes_base,
        image_url: validated.image_url || null,
        active: validated.active,
      })
      .select()
      .single();

    if (error) {
      console.error('[catalog POST] Supabase error:', error);
      throw new Error(`Failed to create catalog item: ${error.message}`);
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
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
