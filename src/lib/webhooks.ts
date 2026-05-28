/**
 * EventFlow — Webhooks Module
 *
 * Emits webhook events to the configured endpoint (n8n, etc.)
 * with retry logic (3 attempts, exponential backoff), Zod validation,
 * and logging to the webhook_logs table.
 *
 * Topics: BUDGET_CREATED, STATUS_CHANGED, BUDGET_CONFIRMED, BUDGET_CANCELLED
 */

import { z } from 'zod';
import { querySingle } from '@/lib/db';
import { WebhookPayloadSchema } from '@/types/specs';

// ============================================================
// Types
// ============================================================

export type WebhookTopic = z.infer<typeof WebhookPayloadSchema>['topic'];

export interface EmitWebhookOptions {
  eventId?: string;
  changes?: Record<string, unknown>;
}

// ============================================================
// Retry helpers
// ============================================================

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  url: string,
  payload: unknown,
  retries: number = MAX_RETRIES
): Promise<{ ok: boolean; status: number; body: string }> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-EventFlow-Source': 'eventflow',
        },
        body: JSON.stringify(payload),
      });

      const body = await response.text();

      if (response.ok) {
        return { ok: true, status: response.status, body };
      }

      lastError = new Error(
        `Webhook delivery failed: ${response.status} ${response.statusText}`
      );
      console.error(
        `[webhook] attempt ${attempt + 1}/${retries} failed: ${response.status} ${response.statusText}`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[webhook] attempt ${attempt + 1}/${retries} error:`, lastError);
    }

    if (attempt < retries - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      console.log(`[webhook] retrying in ${delay}ms...`);
      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Webhook delivery failed after all retries');
}

// ============================================================
// Core: emitWebhook
// ============================================================

export async function emitWebhook(
  topic: string,
  event: Record<string, unknown>,
  _options: Record<string, unknown> = {}
): Promise<void> {
  // Calculate derived fields for the payload
  const ev = event as Record<string, unknown>;
  const pvp = Number(ev.total_pvp) || 0;
  const cost = Number(ev.total_cost) || 0;
  const profit = pvp - cost;
  const marginPct = pvp > 0 ? Math.round((profit / pvp) * 10000) / 100 : 0;

  // Normalize event_date to YYYY-MM-DD (DB returns a full ISO timestamp,
  // but the webhook schema expects a date-only string).
  const rawDate = ev.event_date;
  const eventDate =
    typeof rawDate === 'string' && rawDate.length >= 10
      ? rawDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  // Build and validate payload
  const payload = WebhookPayloadSchema.parse({
    id: crypto.randomUUID(),
    topic,
    timestamp: new Date().toISOString(),
    event: {
      ...event,
      event_date: eventDate,
      profit,
      margin_pct: marginPct,
    },
    changes: (_options as Record<string, unknown>).changes,
    metadata: {
      source: 'eventflow',
      version: '1.0',
    },
  });

  const webhookUrl = process.env.NEXT_PUBLIC_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('[webhook] NEXT_PUBLIC_WEBHOOK_URL not configured, skipping delivery');
    // Still log to DB
    await querySingle(
      `INSERT INTO webhook_logs (event_id, topic, payload, status, retries)
       VALUES ($1, $2, $3, 'pending', 0)`,
      [ev.id ?? null, topic, JSON.stringify(payload)]
    );
    return;
  }

  // Attempt delivery with retry
  let deliveryStatus: 'sent' | 'failed' = 'failed';
  let responseBody: string | null = null;

  try {
    const result = await fetchWithRetry(webhookUrl, payload);
    deliveryStatus = 'sent';
    responseBody = result.body;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[webhook] delivery failed after all retries:', errorMsg);
    deliveryStatus = 'failed';
    responseBody = errorMsg;
  }

  // Log to webhook_logs table
  await querySingle(
    `INSERT INTO webhook_logs (event_id, topic, payload, status, response, retries, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      ev.id ?? null,
      topic,
      JSON.stringify(payload),
      deliveryStatus,
      responseBody,
      deliveryStatus === 'sent' ? 0 : MAX_RETRIES,
      deliveryStatus === 'sent' ? new Date().toISOString() : null,
    ]
  );
}