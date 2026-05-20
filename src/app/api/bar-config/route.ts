/**
 * EventFlow — Bar Config API Route
 * GET /api/bar-config — Return bar prices from bar_config table
 */

import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';

// ============================================================
// GET — Return bar prices
// ============================================================

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();

    const { data: config, error } = await (supabase as any).from('bar_config' as any)
      .select('*')
      .order('hours', { ascending: true });

    if (error) {
      console.error('[bar-config GET] Supabase error:', error);
      throw new Error(`Failed to fetch bar config: ${error.message}`);
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
