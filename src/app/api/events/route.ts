/**
 * EventFlow — Events API Routes
 * GET /api/events — List events (filtered by user email or admin)
 * POST /api/events — Create event from wizard submission (validated with Zod, emits BUDGET_CREATED webhook)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { EventSetupCreateSchema } from '@/types/specs';
import { emitWebhook } from '@/lib/webhooks';

// ============================================================
// GET — List events (filtered by user email or admin)
// ============================================================

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const userEmail = searchParams.get('email');
    const status = searchParams.get('status');
    const limit = Math.min(
      parseInt(searchParams.get('limit') ?? '50', 10) || 50,
      200
    );
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;

    // Build query
    let query = supabase
      .from('events' as any)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by user email (RLS also enforces this)
    if (userEmail) {
      query = query.eq('client_email', userEmail);
    }

    // Filter by status
    if (status) {
      query = query.eq('status', status);
    }

    const { data: events, error, count } = await query;

    if (error) {
      console.error('[events GET] Supabase error:', error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total: count ?? 0,
        limit,
        offset,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

// ============================================================
// POST — Create event from wizard submission
// Validates with Zod, emits BUDGET_CREATED webhook
// ============================================================

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseServerClient();

    // Parse and validate body with Zod
    const body = await request.json();
    const validated = EventSetupCreateSchema.parse(body);

    // Get user auth (optional in development)
    let authEmail: string | undefined;
    try {
      const { data: authData } = await supabase.auth.getUser();
      authEmail = authData?.user?.email ?? undefined;
    } catch {
      // Auth not configured — proceed without it (development mode)
    }

    // Insert event into database
    const { data: event, error: insertError } = await (supabase as any).from('events' as any)
      .insert({
        menu_id: validated.menu_id ?? null,
        client_name: validated.client_name,
        client_email: validated.client_email,
        client_phone: validated.client_phone ?? null,
        event_type: validated.event_type,
        guest_count: validated.guest_count,
        kids_count: validated.kids_count,
        event_date: validated.event_date,
        status: validated.status,
        selected_items: validated.selected_items,
        total_pvp: validated.total_pvp,
        total_cost: validated.total_cost,
        bar_hours: validated.bar_hours,
        bar_price: validated.bar_price,
        iva_pct: validated.iva_pct,
        notes: validated.notes ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[events POST] Supabase insert error:', insertError);
      throw new Error(`Failed to create event: ${insertError.message}`);
    }

    if (!event) {
      throw new Error('Failed to create event: no data returned');
    }

    // Emit BUDGET_CREATED webhook
    try {
      await emitWebhook('BUDGET_CREATED', event, {
        created_by: authEmail,
      });
    } catch (webhookError) {
      // Log but don't fail the request if webhook fails
      console.error('[events POST] Webhook emission failed:', webhookError);
    }

    return NextResponse.json({ success: true, data: event }, { status: 201 });
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
