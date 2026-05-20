/**
 * EventFlow — Webhooks Test API Route
 * POST /api/webhooks/test — Accept webhook payloads, validate with Zod, log to webhook_logs
 *
 * This endpoint is used for testing webhook integration and can receive
 * payloads from external systems (n8n, Stripe, etc.).
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@/lib/supabase';
import { WebhookPayloadSchema } from '@/types/specs';

// ============================================================
// POST — Accept and validate webhook payloads
// ============================================================

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseServerClient();

    // Parse body
    const body = await request.json();

    // Validate with Zod WebhookPayloadSchema
    const validated = WebhookPayloadSchema.parse(body);

    // Log to webhook_logs table
    const { data: logEntry, error: logError } = await (supabase as any).from('webhook_logs' as any)
      .insert({
        event_id: validated.event?.id ?? null,
        topic: validated.topic,
        payload: validated,
        status: 'sent',
        response: 'Received via test endpoint',
        retries: 0,
        sent_at: new Date().toISOString(),
      } as any)
      .select()
      .single();

    if (logError) {
      console.error('[webhooks/test POST] Supabase log error:', logError);
      // Don't fail the request if logging fails — the payload was still validated
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Webhook payload received and logged',
        data: {
          topic: validated.topic,
          timestamp: validated.timestamp,
          event_id: validated.event.id,
          log_id: logEntry?.id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors,
        },
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
