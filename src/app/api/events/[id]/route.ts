/**
 * EventFlow — Event by ID API Route
 * GET /api/events/[id] — Get single event
 * PUT /api/events/[id] — Update event (status, items, details)
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const event = await querySingle<any>(
      `SELECT * FROM events WHERE id = $1`,
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
    if (items.length > 0 && pvp === 0) {
      const catalogItems = await queryMany<any>(
        `SELECT id, name, pvp, cost FROM catalog_items WHERE active = true`,
        []
      );
      const nameLookup = new Map<string, any>();
      for (const ci of catalogItems) {
        nameLookup.set(ci.name.toLowerCase().trim(), ci);
      }
      for (const item of items) {
        const itemName = (item.name || '').toLowerCase().trim();
        const catItem = nameLookup.get(itemName);
        if (catItem) {
          const qty = Number(item.quantity) || 1;
          pvp += (Number(catItem.pvp) || 0) * qty;
          cost += (Number(catItem.cost) || 0) * qty;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...event, total_pvp: pvp, total_cost: cost },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
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
    const { status, notes, total_pvp, total_cost, bar_hours, selected_items, client_name, client_email, event_type, guest_count, kids_count, event_date } = body;

    // If selected_items is provided, recalculate totals from catalog
    let calculatedPvp = total_pvp;
    let calculatedCost = total_cost;
    if (selected_items && Array.isArray(selected_items)) {
      const catalogItems = await queryMany<any>(
        `SELECT id, name, pvp, cost FROM catalog_items WHERE active = true`,
        []
      );
      const nameLookup = new Map<string, any>();
      for (const ci of catalogItems) {
        nameLookup.set(ci.name.toLowerCase().trim(), ci);
      }
      let pvpSum = 0;
      let costSum = 0;
      for (const item of selected_items) {
        const itemName = (item.name || '').toLowerCase().trim();
        const catItem = nameLookup.get(itemName);
        if (catItem) {
          const qty = Number(item.quantity) || 1;
          pvpSum += (Number(catItem.pvp) || 0) * qty;
          costSum += (Number(catItem.cost) || 0) * qty;
        }
      }
      calculatedPvp = pvpSum;
      calculatedCost = costSum;
    }

    // Build dynamic SET clause
    const setFields: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const addField = (field: string, value: any) => {
      if (value !== undefined) {
        setFields.push(`${field} = $${idx++}`);
        values.push(value);
      }
    };

    addField('status', status ?? null);
    addField('notes', notes ?? null);
    addField('total_pvp', calculatedPvp ?? 0);
    addField('total_cost', calculatedCost ?? 0);
    addField('bar_hours', bar_hours ?? null);
    addField('client_name', client_name ?? null);
    addField('client_email', client_email ?? null);
    addField('event_type', event_type ?? null);
    addField('guest_count', guest_count ?? null);
    addField('kids_count', kids_count ?? null);
    addField('event_date', event_date ?? null);

    // selected_items is JSONB — stringify for DB
    if (selected_items !== undefined) {
      setFields.push(`selected_items = $${idx++}`);
      values.push(JSON.stringify(selected_items));
    }

    if (setFields.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(id);
    const query = `UPDATE events SET ${setFields.join(', ')} WHERE id = $${idx} RETURNING *`;

    const event = await querySingle<any>(query, values);

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: event });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}