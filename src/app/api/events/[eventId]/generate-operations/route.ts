/**
 * EventFlow — Generate event operations from accepted budget
 * POST /api/events/[eventId]/generate-operations
 *
 * When a budget is accepted, auto-generate:
 * - Guests (guest_count + kids_count placeholder entries)
 * - Table distribution (ceil(guest/10) tables, distribute evenly)
 * - Staff suggestions (tables_suggested = ceil(guest/10), waiters_suggested = ceil(guest/15))
 * - Escandallo (menu items with quantities)
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await params;

    const event = await querySingle<any>(
      `SELECT * FROM events WHERE id = $1`,
      [eventId]
    );

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado' },
        { status: 404 }
      );
    }

    if (event.status !== 'accepted') {
      return NextResponse.json(
        { success: false, error: 'Solo se pueden generar operaciones para eventos aceptados' },
        { status: 400 }
      );
    }

    const guestCount = Number(event.guest_count) || 0;
    const kidsCount = Number(event.kids_count) || 0;
    const totalGuests = guestCount + kidsCount;

    // 1. Generate guests from selected_items (menu items)
    const selectedItems = event.selected_items || [];
    const guests: any[] = [];
    const menuItems: any[] = [];

    // Generate placeholder guests
    for (let i = 0; i < guestCount; i++) {
      guests.push({
        event_id: eventId,
        name: `Invitado ${i + 1}`,
        group_name: null,
        rsvp: 'pendiente',
        menu_type: 'adulto',
        dietary: [],
        notes: null,
      });
    }
    for (let i = 0; i < kidsCount; i++) {
      guests.push({
        event_id: eventId,
        name: `Niño ${i + 1}`,
        group_name: null,
        rsvp: 'pendiente',
        menu_type: 'nino',
        dietary: [],
        notes: null,
      });
    }

    // Generate menu items for escandallo
    for (const item of selectedItems) {
      menuItems.push({
        event_id: eventId,
        name: item.name,
        category: item.category,
        quantity: Number(item.quantity) || 0,
        unit_price_pvp: Number(item.unit_price_pvp) || 0,
        subtotal_pvp: Number(item.subtotal_pvp) || 0,
      });
    }

    // Calculate table distribution
    const tablesNeeded = Math.ceil(guestCount / 10); // 10 per table
    const tables: any[] = [];
    const guestsPerTable = Math.floor(guestCount / tablesNeeded);
    const remainder = guestCount % tablesNeeded;

    let guestIdx = 0;
    for (let t = 0; t < tablesNeeded; t++) {
      const count = guestsPerTable + (t < remainder ? 1 : 0);
      tables.push({
        event_id: eventId,
        table_number: t + 1,
        capacity: count,
        guests: guests.slice(guestIdx, guestIdx + count).map((g) => g.id),
      });
      guestIdx += count;
    }

    // Calculate staff
    const waitersNeeded = Math.ceil(guestCount / 15); // 1 waiter per 15 guests

    // Insert guests
    const insertedGuests: any[] = [];
    for (const guest of guests) {
      const inserted = await querySingle<any>(
        `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [guest.event_id, guest.name, guest.group_name, guest.rsvp, guest.menu_type, JSON.stringify(guest.dietary), guest.notes]
      );
      if (inserted) insertedGuests.push(inserted);
    }

    // Insert tables
    const insertedTables: any[] = [];
    for (const table of tables) {
      const inserted = await querySingle<any>(
        `INSERT INTO tables (event_id, table_number, capacity)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [table.event_id, table.table_number, table.capacity]
      );
      if (inserted) insertedTables.push(inserted);
    }

    // Insert menu items
    const insertedMenuItems: any[] = [];
    for (const item of menuItems) {
      const inserted = await querySingle<any>(
        `INSERT INTO event_menu_items (event_id, name, category, quantity, unit_price_pvp, subtotal_pvp)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [item.event_id, item.name, item.category, item.quantity, item.unit_price_pvp, item.subtotal_pvp]
      );
      if (inserted) insertedMenuItems.push(inserted);
    }

    // Update event with operations data
    await querySingle(
      `UPDATE events SET 
         tables_suggested = $1,
         waiters_suggested = $2,
         operations_generated_at = now()
       WHERE id = $3`,
      [tablesNeeded, waitersNeeded, eventId]
    );

    return NextResponse.json({
      success: true,
      message: 'Operaciones generadas correctamente',
      data: {
        guests: insertedGuests.length,
        tables: insertedTables.length,
        menuItems: insertedMenuItems.length,
        tablesNeeded,
        waitersNeeded,
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
