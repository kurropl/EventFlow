/**
 * GET /api/guest-menus/[eventId] — Menús disponibles para invitados de un evento
 *
 * Devuelve los platos del evento que los invitados pueden seleccionar
 * para personalizar su menú.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;

    // Get menu items for this event (from event_menu_items + recipes + catalog)
    const menuItems = await query(
      `SELECT emi.id, emi.name, emi.category, emi.quantity,
              ci.id AS catalog_item_id, ci.allergens, ci.description
       FROM event_menu_items emi
       LEFT JOIN catalog_items ci ON ci.name = emi.name
       WHERE emi.event_id = $1
       ORDER BY emi.category, emi.name`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      data: menuItems.rows || [],
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}
