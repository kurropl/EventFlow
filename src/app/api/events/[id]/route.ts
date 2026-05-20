/**
 * EventFlow — Event Item API Routes (single event)
 * GET /api/events/[id] — Get single event with cost breakdown
 * PATCH /api/events/[id] — Update event status (triggers STATUS_CHANGED webhook if status changes)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { EventStatusSchema } from '@/types/specs';
import { emitWebhook } from '@/lib/webhooks';

// ============================================================
// GET — Single event with cost breakdown
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
        { success: false, error: 'Invalid event ID (must be a UUID)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Fetch the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (eventError) {
      if (eventError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        );
      }
      console.error('[events/[id] GET] Supabase error:', eventError);
      throw new Error(`Failed to fetch event: ${eventError.message}`);
    }

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Fetch cost breakdown (cost_desgloses)
    const { data: costBreakdown, error: costError } = await supabase
      .from('cost_desgloses')
      .select('*')
      .eq('event_id', id)
      .order('created_at', { ascending: true });

    if (costError) {
      console.error('[events/[id] GET] Cost breakdown error:', costError);
      // Don't fail if cost breakdown is unavailable
    }

    return NextResponse.json({
      success: true,
      data: {
        ...event,
        cost_breakdown: costBreakdown ?? [],
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
// PATCH — Update event status (triggers STATUS_CHANGED webhook)
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
        { success: false, error: 'Invalid event ID (must be a UUID)' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Parse and validate body with Zod
    const body = await request.json();
    const validated = z.object({
      status: EventStatusSchema.optional(),
      notes: z.string().max(2000).optional(),
    }).parse(body);

    // Get current event to check for status change
    const { data: currentEvent, error: fetchError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Event not found' },
          { status: 404 }
        );
      }
      console.error('[events/[id] PATCH] Supabase fetch error:', fetchError);
      throw new Error(`Failed to fetch event: ${fetchError.message}`);
    }

    if (!currentEvent) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if (validated.status !== undefined) {
      updateData.status = validated.status;
    }
    if (validated.notes !== undefined) {
      updateData.notes = validated.notes;
    }

    // Apply update
    const { data: updatedEvent, error: updateError } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[events/[id] PATCH] Supabase update error:', updateError);
      throw new Error(`Failed to update event: ${updateError.message}`);
    }

    if (!updatedEvent) {
      return NextResponse.json(
        { success: false, error: 'Failed to update event' },
        { status: 500 }
      );
    }

    // Check if status changed — emit STATUS_CHANGED webhook
    const oldStatus = currentEvent.status;
    const newStatus = updatedEvent.status;

    if (oldStatus !== newStatus) {
      try {
        await emitWebhook('STATUS_CHANGED', updatedEvent, {
          old_status: oldStatus,
          new_status: newStatus,
        });
      } catch (webhookError) {
        console.error('[events/[id] PATCH] Webhook emission failed:', webhookError);
      }
    }

    // Check if status is 'confirmado' — emit BUDGET_CONFIRMED
    if (newStatus === 'confirmado') {
      try {
        await emitWebhook('BUDGET_CONFIRMED', updatedEvent, {
          confirmed_at: new Date().toISOString(),
        });
      } catch (webhookError) {
        console.error('[events/[id] PATCH] BUDGET_CONFIRMED webhook failed:', webhookError);
      }
    }

    // Check if status is 'cancelado' — emit BUDGET_CANCELLED
    if (newStatus === 'cancelado') {
      try {
        await emitWebhook('BUDGET_CANCELLED', updatedEvent, {
          cancelled_at: new Date().toISOString(),
        });
      } catch (webhookError) {
        console.error('[events/[id] PATCH] BUDGET_CANCELLED webhook failed:', webhookError);
      }
    }

    return NextResponse.json({ success: true, data: updatedEvent });
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
