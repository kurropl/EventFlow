/**
 * EventFlow — Webhook Test API Route
 * GET /api/webhooks/test — Test endpoint that sends a sample webhook
 */

import { NextResponse } from 'next/server';
import { emitWebhook } from '@/lib/webhooks';

export async function GET() {
  try {
    const sampleEvent = {
      id: crypto.randomUUID(),
      client_name: 'Test Cliente',
      client_email: 'test@example.com',
      event_type: 'boda',
      guest_count: 100,
      kids_count: 10,
      total_pvp: 8500.00,
      total_cost: 5500.00,
      status: 'draft',
    };

    await emitWebhook('BUDGET_CREATED', sampleEvent, {
      changes: { created_by: 'test-script' },
    });

    return NextResponse.json({
      success: true,
      message: 'Test webhook emitted successfully',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}