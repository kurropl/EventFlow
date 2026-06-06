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
import { sanitizeError } from '@/lib/security';

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

    let query = `SELECT e.*,
      (SELECT COALESCE(SUM(amount), 0)::numeric FROM payments WHERE event_id = e.id AND paid = true) as total_paid,
      (SELECT COUNT(*)::int FROM payments WHERE event_id = e.id AND paid = false) as pending_payments,
      (SELECT COUNT(*)::int FROM payments WHERE event_id = e.id) as total_payments
    FROM events e`
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

    // Calculate real prices from catalog for each event (fallback for events with 0 prices)
    const catalogItems = await queryMany<any>(
      `SELECT id, name, category, pvp, cost FROM catalog_items WHERE active = true`,
      []
    );

    const enrichedEvents = events.map((event: any) => {
      let pvp = Number(event.total_pvp) || 0;
      let cost = Number(event.total_cost) || 0;
      const items = event.selected_items || [];
      if (items.length > 0 && pvp === 0) {
        const nameLookup = new Map<string, any>();
        const catLookup = new Map<string, any[]>();
        for (const ci of catalogItems) {
          nameLookup.set(ci.name.toLowerCase().trim(), ci);
          if (!catLookup.has(ci.category)) catLookup.set(ci.category, []);
          const catArr = catLookup.get(ci.category)!;
          catArr.push(ci);
        }
        for (const item of items) {
          const itemName = (item.name || '').toLowerCase().trim();
          const itemCat = (item.category || '').toLowerCase().trim();
          let catItem = nameLookup.get(itemName);
          if (!catItem && itemCat) {
            const catItems = catLookup.get(itemCat);
            if (catItems && catItems.length > 0) {
              catItem = catItems.reduce((min: any, ci: any) =>
                (Number(ci.pvp) || 0) < (Number(min?.pvp) || Infinity) ? ci : min
              );
            }
          }
          if (catItem) {
            const qty = Number(item.quantity) || 1;
            pvp += (Number(catItem.pvp) || 0) * qty;
            cost += (Number(catItem.cost) || 0) * qty;
          }
        }
      }
      return { ...event, total_pvp: pvp.toFixed(2), total_cost: cost.toFixed(2), total_display: ((pvp + (Number(event.bar_price) || 0)).toFixed(2)) };
    });

    // Get total count
    const countResult = await querySingle<any>(
      `SELECT COUNT(*) as count FROM events${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`,
      params.slice(0, conditions.length)
    );

    return NextResponse.json({
      success: true,
      data: enrichedEvents,
      pagination: {
        total: parseInt(countResult?.count ?? '0'),
        limit,
        offset,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
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
    console.error('[events POST] RAW ERROR:', error);
    console.error('[events POST] ERROR MESSAGE:', error instanceof Error ? error.message : String(error));
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}