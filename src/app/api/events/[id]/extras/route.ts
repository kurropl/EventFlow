/**
 * EventFlow — Event Extras API
 * GET    /api/events/[id]/extras          — Get extras for an event
 * POST   /api/events/[id]/extras          — Add/toggle extra for event
 * PUT    /api/events/[id]/extras          — Update quantity
 * DELETE /api/events/[id]/extras?extraId=X — Remove extra from event
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { requireAdmin } from '@/lib/auth';

interface EventExtra {
  id: string;
  event_id: string;
  extra_id: string;
  qty: number;
  price_snapshot: number;
  unit: string;
  selected_via: string;
  created_at: string;
  updated_at: string;
  // Joined fields from extras_catalog
  extra_name?: string;
  extra_category?: string;
  extra_photo_url?: string;
}

interface EventExtraWithDetails extends EventExtra {
  extra_name: string;
  extra_category: string;
  extra_photo_url: string | null;
  extra_description: string | null;
}

/**
 * Calculate total extras cost for an event.
 */
export async function calculateExtrasTotal(eventId: string): Promise<number> {
  const result = await querySingle<{ total: number }>(
    `SELECT COALESCE(SUM(price_snapshot * qty), 0) AS total
     FROM event_extras
     WHERE event_id = $1`,
    [eventId]
  );
  return Number(result?.total ?? 0);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;

    const extras = await queryMany<EventExtraWithDetails>(
      `SELECT
        ee.*,
        ec.name AS extra_name,
        ec.category AS extra_category,
        ec.photo_url AS extra_photo_url,
        ec.description AS extra_description
       FROM event_extras ee
       JOIN extras_catalog ec ON ec.id = ee.extra_id
       WHERE ee.event_id = $1
       ORDER BY ec.category, ec.sort_order, ec.name`,
      [eventId]
    );

    // Calculate total
    const total = extras.reduce((sum, e) => sum + (e.price_snapshot * e.qty), 0);

    return NextResponse.json({
      success: true,
      data: extras,
      total: Math.round(total * 100) / 100,
      count: extras.length,
    });
  } catch (error) {
    console.error('[event-extras GET]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const body = await request.json();
    const { extra_id, qty, selected_via } = body;

    if (!extra_id) {
      return NextResponse.json({ error: 'extra_id requerido' }, { status: 400 });
    }

    // Check if event exists and is not frozen
    const event = await querySingle<any>(
      `SELECT e.*, cp.status AS portal_status
       FROM events e
       LEFT JOIN client_portals cp ON cp.event_id = e.id
       WHERE e.id = $1`,
      [eventId]
    );
    if (!event) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    // Check if portal is frozen (if selected_via = portal)
    if (selected_via === 'portal' && event.portal_status === 'congelado') {
      return NextResponse.json(
        { error: 'El portal está congelado. No se pueden modificar extras.' },
        { status: 423 }
      );
    }

    // Get current price from catalog (snapshot)
    const catalogItem = await querySingle<any>(
      'SELECT * FROM extras_catalog WHERE id = $1 AND active = true',
      [extra_id]
    );
    if (!catalogItem) {
      return NextResponse.json(
        { error: 'Extra no encontrado o inactivo' },
        { status: 404 }
      );
    }

    // Upsert: if exists, update qty; otherwise, create
    const existingExtra = await querySingle<EventExtra>(
      'SELECT * FROM event_extras WHERE event_id = $1 AND extra_id = $2',
      [eventId, extra_id]
    );

    let result: EventExtra;

    if (existingExtra) {
      // Update quantity
      const newQty = qty !== undefined ? Math.max(1, parseInt(qty)) : existingExtra.qty + 1;
      result = await querySingle<EventExtra>(
        `UPDATE event_extras SET
          qty = $1,
          price_snapshot = $2,
          unit = $3
         WHERE id = $4
         RETURNING *`,
        [newQty, catalogItem.price, catalogItem.price_unit, existingExtra.id]
      )!;
    } else {
      // Create new
      const insertQty = qty !== undefined ? Math.max(1, parseInt(qty)) : 1;
      result = await querySingle<EventExtra>(
        `INSERT INTO event_extras (event_id, extra_id, qty, price_snapshot, unit, selected_via)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          eventId,
          extra_id,
          insertQty,
          catalogItem.price,
          catalogItem.price_unit,
          selected_via || 'admin',
        ]
      )!;
    }

    // Get the full details for response
    const fullExtra = await querySingle<EventExtraWithDetails>(
      `SELECT
        ee.*,
        ec.name AS extra_name,
        ec.category AS extra_category,
        ec.photo_url AS extra_photo_url,
        ec.description AS extra_description
       FROM event_extras ee
       JOIN extras_catalog ec ON ec.id = ee.extra_id
       WHERE ee.id = $1`,
      [result.id]
    );

    // Calculate new total
    const total = await calculateExtrasTotal(eventId);

    return NextResponse.json({
      success: true,
      data: fullExtra,
      total: Math.round(total * 100) / 100,
    }, { status: existingExtra ? 200 : 201 });
  } catch (error) {
    console.error('[event-extras POST]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const body = await request.json();
    const { extra_id, qty } = body;

    if (!extra_id || qty === undefined) {
      return NextResponse.json({ error: 'extra_id y qty requeridos' }, { status: 400 });
    }

    if (qty < 0) {
      return NextResponse.json({ error: 'qty no puede ser negativo' }, { status: 400 });
    }

    // If qty is 0, remove the extra
    if (qty === 0) {
      await querySingle(
        'DELETE FROM event_extras WHERE event_id = $1 AND extra_id = $2',
        [eventId, extra_id]
      );
      const total = await calculateExtrasTotal(eventId);
      return NextResponse.json({ success: true, removed: true, total: Math.round(total * 100) / 100 });
    }

    const existingExtra = await querySingle<EventExtra>(
      'SELECT * FROM event_extras WHERE event_id = $1 AND extra_id = $2',
      [eventId, extra_id]
    );

    if (!existingExtra) {
      return NextResponse.json({ error: 'Extra no encontrado en el evento' }, { status: 404 });
    }

    const result = await querySingle<EventExtra>(
      'UPDATE event_extras SET qty = $1 WHERE id = $2 RETURNING *',
      [qty, existingExtra.id]
    );

    const total = await calculateExtrasTotal(eventId);

    return NextResponse.json({
      success: true,
      data: result,
      total: Math.round(total * 100) / 100,
    });
  } catch (error) {
    console.error('[event-extras PUT]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    const { searchParams } = new URL(request.url);
    const extraId = searchParams.get('extraId');

    if (!extraId) {
      return NextResponse.json({ error: 'extraId requerido' }, { status: 400 });
    }

    const existing = await querySingle<EventExtra>(
      'SELECT * FROM event_extras WHERE event_id = $1 AND extra_id = $2',
      [eventId, extraId]
    );

    if (!existing) {
      return NextResponse.json({ error: 'Extra no encontrado' }, { status: 404 });
    }

    await querySingle(
      'DELETE FROM event_extras WHERE event_id = $1 AND extra_id = $2',
      [eventId, extraId]
    );

    const total = await calculateExtrasTotal(eventId);

    return NextResponse.json({
      success: true,
      removed: true,
      total: Math.round(total * 100) / 100,
    });
  } catch (error) {
    console.error('[event-extras DELETE]', error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
