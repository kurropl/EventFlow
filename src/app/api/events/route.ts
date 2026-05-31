/**
 * EventFlow — Events API Routes
 * GET /api/events — List events
 * POST /api/events — Create event from wizard submission
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { queryMany, querySingle } from '@/lib/db';
import { EventSetupCreateSchema } from '@/types/specs';
import { emitWebhook } from '@/lib/webhooks';

// ============================================================
// GET — List events
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const email =
      searchParams.get('email') || searchParams.get('client_email');
    const limit = Math.min(
      parseInt(searchParams.get('limit') ?? '50', 10) || 50,
      200
    );
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;

    let query = `SELECT * FROM events`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    if (email) {
      conditions.push(`client_email ILIKE $${params.length + 1}`);
      params.push(`%${email}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const events = await queryMany<any>(query, params);

    // Get total count
    const countResult = await querySingle<any>(
      `SELECT COUNT(*) as count FROM events${conditions.length > 0 ? ' WHERE ' + conditions.map((c, i) => c.replace(`$${i + 1}`, `$${i + 1}`)) : ''}`,
      params.slice(0, conditions.length)
    );

    return NextResponse.json({
      success: true,
      data: events,
      pagination: {
        total: parseInt(countResult?.count ?? '0'),
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
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = EventSetupCreateSchema.parse(body);

    // Insert event into database
    const event = await querySingle<any>(
      `INSERT INTO events (menu_id, client_name, client_email, client_phone, event_type, guest_count, kids_count, event_date, status, selected_items, total_pvp, total_cost, bar_hours, bar_price, iva_pct, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        validated.menu_id ?? null,
        validated.client_name,
        validated.client_email,
        validated.client_phone ?? null,
        validated.event_type,
        validated.guest_count,
        validated.kids_count,
        validated.event_date,
        validated.status,
        JSON.stringify(validated.selected_items),
        validated.total_pvp,
        validated.total_cost,
        validated.bar_hours,
        validated.bar_price,
        validated.iva_pct,
        validated.notes ?? null,
      ]
    );

    if (!event) {
      throw new Error('Failed to create event: no data returned');
    }

    // Best-effort: upsert a CRM client from the booking and link it.
    // Never blocks event creation (e.g. if the clients table isn't migrated yet).
    try {
      const existing = await querySingle<any>(
        `SELECT id FROM clients WHERE lower(email) = lower($1)`,
        [validated.client_email]
      );
      let clientId: string | undefined = existing?.id;
      if (clientId) {
        await querySingle(
          `UPDATE clients SET name = $1, phone = COALESCE($2, phone) WHERE id = $3 RETURNING id`,
          [validated.client_name, validated.client_phone ?? null, clientId]
        );
      } else {
        const created = await querySingle<any>(
          `INSERT INTO clients (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
          [validated.client_name, validated.client_email, validated.client_phone ?? null]
        );
        clientId = created?.id;
      }
      if (clientId) {
        await querySingle(`UPDATE events SET client_id = $1 WHERE id = $2 RETURNING id`, [clientId, event.id]);
        event.client_id = clientId;
      }
    } catch (clientError) {
      console.error('[events POST] client link skipped (non-fatal):', clientError);
    }

    // Emit BUDGET_CREATED webhook
    try {
      await emitWebhook('BUDGET_CREATED', event, {});
    } catch (webhookError) {
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