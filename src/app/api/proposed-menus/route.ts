/**
 * EventFlow — Proposed Menus API Route
 * GET /api/proposed-menus — Return all proposed menus from proposed_menus table
 */

import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';

// ============================================================
// GET — Return all proposed menus
// ============================================================

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data: menus, error } = await (supabase as any).from('proposed_menus' as any)
      .select('*')
      .order('suggested_price', { ascending: true });

    if (error) {
      console.error('[proposed-menus GET] Supabase error:', error);
      throw new Error(`Failed to fetch proposed menus: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: menus });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
