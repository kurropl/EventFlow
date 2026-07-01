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

    // G13 (Sprint 4): assigned_to derivado por join events.quote_id ->
    // quotes.lead_id -> leads.assigned_to (fuente única, sin columna propia).
    let query = `SELECT e.*,
      COALESCE(pay.total_paid, 0)::numeric AS total_paid,
      COALESCE(pay.pending_payments, 0)::int AS pending_payments,
      COALESCE(pay.total_payments, 0)::int AS total_payments,
      l.assigned_to, a.name AS assigned_to_name
    FROM events e
    LEFT JOIN LATERAL (
      SELECT
        SUM(amount) FILTER (WHERE paid = true) AS total_paid,
        COUNT(*) FILTER (WHERE paid = false) AS pending_payments,
        COUNT(*) AS total_payments
      FROM payments WHERE event_id = e.id
    ) pay ON true
    LEFT JOIN quotes q ON q.id = e.quote_id
    LEFT JOIN leads l ON l.id = q.lead_id
    LEFT JOIN admins a ON a.id = l.assigned_to`
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`e.status = $${params.length + 1}`);
      params.push(status);
    }
    if (email) {
      // Escape % and _ to prevent ILIKE wildcard injection
      const safeEmail = email.replace(/[%_]/g, (ch) => '\\' + ch);
      conditions.push(`e.client_email ILIKE $${params.length + 1}`);
      params.push(`%${safeEmail}%`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const events = await queryMany<any>(query, params);

    // Calculate real prices from catalog for each event (fallback for events with 0 prices)
    const catalogItems = await queryMany<any>(
      `SELECT id, name, category, pvp, cost FROM catalog_items WHERE active = true`,
      []
    );

    // Build catalog lookup Maps ONCE (not per event)
    const nameLookup = new Map<string, any>();
    const catLookup = new Map<string, any[]>();
    for (const ci of catalogItems) {
      nameLookup.set(ci.name.toLowerCase().trim(), ci);
      if (!catLookup.has(ci.category)) catLookup.set(ci.category, []);
      catLookup.get(ci.category)!.push(ci);
    }

    const enrichedEvents = events.map((event: any) => {
      let pvp = Number(event.total_pvp) || 0;
      let cost = Number(event.total_cost) || 0;
      const items = event.selected_items || [];
      if (items.length > 0 && pvp === 0) {
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
      `SELECT COUNT(*) as count FROM events e${conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : ''}`,
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

    // Auto-crear/vincular lead (R4/T4.1): el configurador es la entrada del
    // funnel comercial — todo evento creado aquí debe ser visible en el CRM.
    let leadId: string | undefined;
    try {
      const existingLead = await querySingle<any>(
        `SELECT id FROM leads WHERE lower(email) = lower($1) ORDER BY created_at DESC LIMIT 1`,
        [validated.client_email]
      );
      if (existingLead?.id) {
        leadId = existingLead.id;
      } else {
        const lead = await querySingle<any>(
          `INSERT INTO leads (name, email, source, event_type, guest_count, event_date)
           VALUES ($1, $2, 'configurador', $3, $4, $5)
           RETURNING id`,
          [validated.client_name, validated.client_email, validated.event_type, validated.guest_count, validated.event_date]
        );
        leadId = lead?.id;
      }
      if (leadId) {
        await emitWebhook('LEAD_CREATED', event, {});
      }
    } catch (leadError) {
      console.error('[events POST] lead creation/link skipped (non-fatal):', leadError);
    }

    // Auto-crear quote implícito (presupuesto raíz) para el evento
    try {
      const quote = await querySingle<any>(
        `INSERT INTO quotes (event_id, status, items, base_pvp, base_cost, total_pvp, total_cost, notes, lead_id)
         VALUES ($1, 'historical', $2::jsonb, $3, $4, $3, $4, 'Presupuesto implícito del configurador web', $5)
         RETURNING id`,
        [event.id, JSON.stringify(validated.selected_items || []), validated.total_pvp || 0, validated.total_cost || 0, leadId || null]
      );
      if (quote?.id) {
        await querySingle(
          `UPDATE events SET quote_id = $1 WHERE id = $2`,
          [quote.id, event.id]
        );
        event.quote_id = quote.id;
      }
    } catch (quoteError) {
      // Non-fatal — el quote implícito es opcional para eventos históricos
      console.error('[events POST] implicit quote creation skipped:', quoteError);
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