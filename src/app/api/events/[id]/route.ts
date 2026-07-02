/**
 * EventFlow — Event by ID API Route
 * GET /api/events/[id] — Get single event
 * PUT /api/events/[id] — Update event (status, items, details)
 *
 * When status changes to 'accepted', auto-creates:
 *   - Quote (accepted)
 *   - Event order with table/staff calculation
 *   - 2 payments: 40% deposit (due 7d), 60% final (due event_date)
 * DELETE /api/events/[id] — Delete event
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { deductStockForEvent } from '@/lib/stockDeduct';
import { acceptQuote, AcceptQuoteError } from '@/lib/domain/acceptQuote';
import { setEventStatus, VALID_EVENT_STATUSES } from '@/lib/domain/eventState';
import { reserveVenue, resolveVenueId, VenueConflictError, toDateStr } from '@/lib/domain/venueBooking';

const BAR_PRICE_PER_HOUR = 15; // € per person per hour

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await querySingle<any>(
      `SELECT e.*, v.slug AS venue_slug
       FROM events e
       LEFT JOIN venues v ON v.id = e.venue_id
       WHERE e.id = $1`,
      [id]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Enrich with real prices from catalog
    const items = event.selected_items || [];
    let pvp = Number(event.total_pvp) || 0;
    let cost = Number(event.total_cost) || 0;
    let costing: { lines: any[]; subtotal: number; margin: number; marginPercent: number; pvp: number } = { lines: [], subtotal: 0, margin: 0, marginPercent: 0, pvp: 0 };

    // Centralized costing from event_costs (same for budget/escandallo/invoice)
    if (event.status === 'draft' || event.status === 'sent') {
      // Recalcular desde catálogo
      if (items.length > 0 && pvp === 0) {
        const catalogItems = await queryMany<any>(
          `SELECT id, name, pvp, cost, category FROM catalog_items WHERE active = true`,
          []
        );
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
    } else if (event.status === 'accepted' || event.status === 'won') {
      // Coste congelado desde event_costs
      const eventLines = await queryMany<any>(
        `SELECT ingredient_name, quantity, unit, unit_cost, line_total FROM event_costs WHERE event_id = $1`,
        [event.id]
      );
      const subtotal = eventLines.reduce((s: number, l: any) => s + Number(l.line_total || 0), 0);
      costing = {
        lines: eventLines,
        subtotal,
        margin: subtotal * 0.2,
        marginPercent: 20,
        pvp: subtotal * 1.2,
      };
    }

    return NextResponse.json({
      success: true,
      data: { ...event, total_pvp: pvp, total_cost: cost, total_display: pvp + (Number(event.bar_price) || 0), costing },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, notes, total_pvp, bar_hours, selected_items,
            client_name, client_email, event_type, guest_count, kids_count, event_date,
            linen_type, centerpiece } = body;

    // G17/B6: whitelist — antes se aceptaba cualquier string como status,
    // sin validar valor ni transición.
    if (status !== undefined && !VALID_EVENT_STATUSES.has(status)) {
      return NextResponse.json(
        { success: false, error: `status inválido: '${status}'` },
        { status: 400 }
      );
    }

    // If selected_items provided, recalculate total_pvp from catalog.
    // total_cost NO se calcula aquí: antes de la aceptación no existe escandallo
    // y, tras ella, su única fuente es recalcEventCost (R2/Opción B) — GET ya
    // sirve una estimación en vivo (events/[id] GET) sin persistirla.
    let calculatedPvp = total_pvp;
    if (selected_items && Array.isArray(selected_items)) {
      const catalogItems = await queryMany<any>(
        `SELECT id, name, pvp, cost, category FROM catalog_items WHERE active = true`,
        []
      );
      const nameLookup = new Map<string, any>();
      const catLookup = new Map<string, any[]>();
      for (const ci of catalogItems) {
        nameLookup.set(ci.name.toLowerCase().trim(), ci);
        if (!catLookup.has(ci.category)) catLookup.set(ci.category, []);
        const catArr = catLookup.get(ci.category)!;
        catArr.push(ci);
      }
      let pvpSum = 0;
      for (const item of selected_items) {
        const itemName = (item.name || '').toLowerCase().trim();
        const itemCat = (item.category || '').toLowerCase().trim();
        let catItem = nameLookup.get(itemName);
        // Fallback: if name doesn't match, try category match (take cheapest in category)
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
          pvpSum += (Number(catItem.pvp) || 0) * qty;
        }
      }
      calculatedPvp = pvpSum;
    }

    const result = await transaction(async (client) => {
      const fields: string[] = [];
      const vals: any[] = [];
      let p = 1;

      const push = (f: string, v: any) => {
        if (v !== undefined) {
          fields.push(`${f} = $${p++}`);
          vals.push(v);
        }
      };
      const pushIfInBody = (f: string, key: string) => {
        if (key in body) {
          push(f, body[key] ?? null);
        }
      };

      // status se gestiona aparte vía domain/eventState (R3, única escritura)
      pushIfInBody('notes', 'notes');
      pushIfInBody('bar_hours', 'bar_hours');
      pushIfInBody('bar_price', 'bar_price');
      pushIfInBody('client_name', 'client_name');
      pushIfInBody('client_email', 'client_email');
      pushIfInBody('event_type', 'event_type');
      pushIfInBody('guest_count', 'guest_count');
      pushIfInBody('kids_count', 'kids_count');
      pushIfInBody('event_date', 'event_date');
      pushIfInBody('linen_type', 'linen_type');
      pushIfInBody('centerpiece', 'centerpiece');
      pushIfInBody('service_type', 'service_type');
      // venue_type explícito solo si NO se envía `venue`/`venue_id` (que lo
      // derivan abajo) — evita doble asignación de la misma columna en el SET.
      if (!('venue' in body) && !('venue_id' in body)) pushIfInBody('venue_type', 'venue_type');
      pushIfInBody('location', 'location');
      pushIfInBody('venue_pdf_url', 'venue_pdf_url');

      // G1 (Sprint 1): asignación de salón por slug (`venue`: 'salon-arriba'|
      // 'salon-abajo'|'externo') o por `venue_id`. Deriva venue_type coherente
      // para Cocina (con salón → 'benitez'; sin salón → 'externo').
      let venueOrDateTouched = ('event_date' in body);
      if ('venue' in body || 'venue_id' in body) {
        const venueId = 'venue_id' in body
          ? (body.venue_id ?? null)
          : await resolveVenueId(client, body.venue);
        push('venue_id', venueId);
        push('venue_type', venueId ? 'benitez' : 'externo');
        venueOrDateTouched = true;
      }

      if (calculatedPvp !== undefined) {
        fields.push(`total_pvp = $${p++}`);
        vals.push(calculatedPvp);
      }
      if (selected_items !== undefined) {
        fields.push(`selected_items = $${p++}::jsonb`);
        vals.push(JSON.stringify(selected_items));
      }

      if (fields.length === 0 && status === undefined) {
        return { event: null };
      }

      let event: any = null;
      if (status !== undefined) {
        event = await setEventStatus(client, id, status);
      }
      if (fields.length > 0) {
        vals.push(id);
        event = (await client.query(
          `UPDATE events SET ${fields.join(', ')} WHERE id = $${p} RETURNING *`,
          vals
        )).rows[0];
      }

      if (!event) return { event: null };

      // G1: tras asignar salón o cambiar fecha, re-sincroniza la reserva en la
      // MISMA transacción (atómico). Externo (venue_id NULL) → libera. Conflicto
      // de salón+día → VenueConflictError revierte el UPDATE completo.
      if (venueOrDateTouched) {
        await reserveVenue(client, id, event.venue_id ?? null, toDateStr(event.event_date));
      }

      // Si el status pasa a 'accepted', necesitamos un quoteId para delegar
      // en acceptQuote (fuera de esta transacción: domain/acceptQuote abre
      // la suya propia). Buscamos o creamos el quote aquí dentro.
      let acceptQuoteId: string | null = null;
      if (status === 'accepted') {
        let quote = (await client.query(
          `SELECT id FROM quotes WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [id]
        )).rows[0];

        if (!quote) {
          const pvpTotal = Number(event.total_pvp) || 0;
          const costTotal = Number(event.total_cost) || 0;
          const marginPct = pvpTotal > 0 ? Math.round(((pvpTotal - costTotal) / pvpTotal) * 100 * 100) / 100 : 0;
          quote = (await client.query(
            `INSERT INTO quotes (event_id, status, base_pvp, base_cost, total_pvp, total_cost,
              bar_price, iva_pct, margin_pct, sent_at)
             VALUES ($1, 'sent', $2, $3, $2, $3, $4, $5, $6, now())
             RETURNING id`,
            [id, pvpTotal, costTotal, Number(event.bar_price) || 0, Number(event.iva_pct) || 10, marginPct]
          )).rows[0];
        }
        acceptQuoteId = quote.id;
      }

      return { event, acceptQuoteId };
    });

    if (!result.event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // ── Aceptación: delegar en el dominio (única implementación, R1/D1) ──
    let stockWarnings: unknown;
    if (result.acceptQuoteId) {
      try {
        const accepted = await acceptQuote(result.acceptQuoteId);
        result.event = accepted.event;
        stockWarnings = accepted.stockWarnings;
      } catch (err) {
        if (err instanceof AcceptQuoteError) {
          return NextResponse.json({ success: false, error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // ── R2/AC2.2: cambiar guest_count rescala el escandallo y total_cost ──
    if ('guest_count' in body && !result.acceptQuoteId) {
      try {
        const { recalcEventEscandallo } = await import('@/lib/recalcEscandallo');
        await recalcEventEscandallo(id, Number(guest_count) || undefined);
        result.event = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [id]);
      } catch (e) {
        console.error('[events PUT] recalcEventEscandallo failed (non-fatal):', e);
      }
    }

    // ── Auto-deduct stock when event moves to 'completed' or 'paid' ──
    if (status === 'completed' || status === 'paid') {
      try {
        const deductionResult = await deductStockForEvent(id);
        console.log(
          `[events PUT] Stock deducted for event ${id}: ${deductionResult.deducted} items`,
          deductionResult.details
        );
      } catch (deductError) {
        // Don't fail the event update if stock deduction fails — log and continue
        console.error('[events PUT] Stock deduction failed (non-fatal):', deductError);
      }
    }

    // ── Auto-update lead status when event is sent ──
    if (status === 'sent' && result.event?.client_email) {
      try {
        await querySingle(
          `UPDATE leads SET status = 'presupuestado', updated_at = now()
           WHERE lower(email) = lower($1) AND status IN ('nuevo', 'contactado')`,
          [result.event.client_email]
        );
      } catch (e) {
        console.error('[events PUT] Lead status update failed (non-fatal):', e);
      }
    }

    return NextResponse.json({ success: true, data: result.event, stockWarnings });
  } catch (error) {
    if (error instanceof VenueConflictError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}