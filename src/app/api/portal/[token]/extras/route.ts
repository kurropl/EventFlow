/**
 * EventFlow — Portal Extras API
 * GET    /api/portal/[token]/extras       — Get available extras + current selections
 * POST   /api/portal/[token]/extras       — Select/deselect extra
 *
 * Public endpoint: authenticated by portal token (client_token from events).
 * The token is resolved to event_id and used for all queries.
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, getPool } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

// ============================================================
// Types
// ============================================================

interface PortalExtra {
  id: string;
  category: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  price: number;
  price_unit: string;
  // Selection info (null if not selected)
  selected_qty: number | null;
  selected: boolean;
  selection_id: string | null;
  price_snapshot: number | null;
}

interface PortalExtrasResponse {
  success: boolean;
  data: {
    extras: PortalExtra[];
    selected_total: number;
    event_id: string;
  };
}

// ============================================================
// Helpers
// ============================================================

async function resolveTokenToEventId(token: string): Promise<string | null> {
  // First check client_portals table (WP-25)
  const portal = await querySingle<any>(
    `SELECT event_id FROM client_portals WHERE access_token = $1 AND status = 'activo'`,
    [token]
  );
  if (portal) return portal.event_id;

  // Fallback: check events.client_token for backward compatibility
  const event = await querySingle<any>(
    `SELECT id FROM events WHERE client_token = $1`,
    [token]
  );
  return event?.id ?? null;
}

function calculateUnitTotal(price: number, qty: number, priceUnit: string): number {
  // For 'pax' pricing, we don't multiply here - it's per-pax
  // The total calculation depends on how the billing is done
  return Math.round(price * qty * 100) / 100;
}

// ============================================================
// GET: Fetch available extras + current selections
// ============================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Token inválido.' },
        { status: 400 }
      );
    }

    const eventId = await resolveTokenToEventId(token);
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Portal no encontrado o token inválido.' },
        { status: 404 }
      );
    }

    // Check portal status
    const portal = await querySingle<any>(
      `SELECT status, freeze_date FROM client_portals WHERE event_id = $1`,
      [eventId]
    );
    
    const isFrozen = portal?.status === 'congelado';

    // Get all active extras
    const catalogExtras = await queryMany<any>(
      `SELECT * FROM extras_catalog WHERE active = true ORDER BY category, sort_order, name`
    );

    // Get current selections for this event
    const selectedExtras = await queryMany<any>(
      `SELECT * FROM event_extras WHERE event_id = $1`,
      [eventId]
    );

    // Create a map of selected extras
    const selectedMap = new Map<string, any>();
    for (const sel of selectedExtras) {
      selectedMap.set(sel.extra_id, sel);
    }

    // Merge catalog with selections
    const extras: PortalExtra[] = catalogExtras.map((item) => {
      const selection = selectedMap.get(item.id);
      return {
        id: item.id,
        category: item.category,
        name: item.name,
        description: item.description,
        photo_url: item.photo_url,
        price: Number(item.price),
        price_unit: item.price_unit,
        selected_qty: selection?.qty ?? null,
        selected: !!selection,
        selection_id: selection?.id ?? null,
        price_snapshot: selection ? Number(selection.price_snapshot) : null,
      };
    });

    // Calculate selected total
    const selectedTotal = selectedExtras.reduce(
      (sum, e) => sum + Number(e.price_snapshot) * e.qty,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        extras,
        selected_total: Math.round(selectedTotal * 100) / 100,
        event_id: eventId,
        is_frozen: isFrozen,
      },
    });
  } catch (error) {
    console.error('[portal-extras GET]', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ============================================================
// POST: Select or deselect an extra
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = await params;

    if (!token || token.length < 10) {
      return NextResponse.json(
        { success: false, error: 'Token inválido.' },
        { status: 400 }
      );
    }

    const eventId = await resolveTokenToEventId(token);
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Portal no encontrado o token inválido.' },
        { status: 404 }
      );
    }

    // Check if portal is frozen
    const portal = await querySingle<any>(
      `SELECT status FROM client_portals WHERE event_id = $1`,
      [eventId]
    );
    if (portal?.status === 'congelado') {
      return NextResponse.json(
        { success: false, error: 'El portal está congelado. No se pueden modificar extras.' },
        { status: 423 }
      );
    }

    const body = await request.json();
    const { extra_id, action } = body;

    if (!extra_id) {
      return NextResponse.json(
        { success: false, error: 'extra_id requerido.' },
        { status: 400 }
      );
    }

    const validAction = action || 'toggle';

    // Get catalog item
    const catalogItem = await querySingle<any>(
      'SELECT * FROM extras_catalog WHERE id = $1 AND active = true',
      [extra_id]
    );
    if (!catalogItem) {
      return NextResponse.json(
        { success: false, error: 'Extra no encontrado o inactivo.' },
        { status: 404 }
      );
    }

    // Check current selection
    const existingSelection = await querySingle<any>(
      'SELECT * FROM event_extras WHERE event_id = $1 AND extra_id = $2',
      [eventId, extra_id]
    );

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let result: any;
      let isDeselected = false;

      if (validAction === 'deselect' || (validAction === 'toggle' && existingSelection)) {
        // Remove selection
        if (existingSelection) {
          await client.query(
            'DELETE FROM event_extras WHERE event_id = $1 AND extra_id = $2',
            [eventId, extra_id]
          );
        }
        isDeselected = true;
        result = null;
      } else {
        // Add or update selection
        if (existingSelection) {
          // Update quantity
          const newQty = existingSelection.qty + 1;
          result = (await client.query(
            `UPDATE event_extras SET qty = $1, price_snapshot = $2, unit = $3
             WHERE event_id = $4 AND extra_id = $5
             RETURNING *`,
            [newQty, catalogItem.price, catalogItem.price_unit, eventId, extra_id]
          )).rows[0];
        } else {
          // Insert new selection
          result = (await client.query(
            `INSERT INTO event_extras (event_id, extra_id, qty, price_snapshot, unit, selected_via)
             VALUES ($1, $2, 1, $3, $4, 'portal')
             RETURNING *`,
            [eventId, extra_id, catalogItem.price, catalogItem.price_unit]
          )).rows[0];
        }
      }

      // Calculate new total
      const totalResult = await client.query(
        `SELECT COALESCE(SUM(price_snapshot * qty), 0) AS total
         FROM event_extras WHERE event_id = $1`,
        [eventId]
      );
      const newTotal = Math.round(Number(totalResult.rows[0].total) * 100) / 100;

      await client.query('COMMIT');

      // Emit portal.updated domain event (best-effort)
      try {
        const { emitDomainEventStandalone } = await import('@/domain/events');
        await emitDomainEventStandalone(
          'portal.updated',
          'event',
          eventId,
          {
            section: 'extras',
            summary: isDeselected
              ? `Extra "${catalogItem.name}" deseleccionado`
              : `Extra "${catalogItem.name}" seleccionado`,
          }
        );
      } catch (eventError) {
        console.error('[portal-extras] Failed to emit domain event:', eventError);
      }

      return NextResponse.json({
        success: true,
        data: {
          action: isDeselected ? 'deselected' : 'selected',
          extra_id,
          extra_name: catalogItem.name,
          price: Number(catalogItem.price),
          price_unit: catalogItem.price_unit,
          qty: result?.qty ?? 0,
          price_snapshot: result ? Number(result.price_snapshot) : null,
        },
        selected_total: newTotal,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('[portal-extras POST]', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
