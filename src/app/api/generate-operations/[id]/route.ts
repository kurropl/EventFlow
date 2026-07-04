/**
 * EventFlow — Generate event operations from accepted budget
 * POST /api/events/[id]/generate-operations
 *
 * When a budget is accepted, auto-generate:
 * - Guests (guest_count + kids_count placeholder entries)
 * - Table distribution + staff suggestions vía src/lib/operations.ts (fuente única, FR-A05)
 * - Escandallo (shopping_list from catalog ingredients, linked to providers)
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany, transaction } from '@/lib/db';
import { calcMesas, calcCamareros, type ServiceType } from '@/lib/operations';
import { getOperationRatios } from '@/lib/domain/operationRatios';

export async function POST(
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

    // Idempotency: skip if operations already generated
    if (event.operations_generated_at) {
      return NextResponse.json({
        success: true,
        message: 'Operaciones ya generadas previamente',
        data: { guests: 0, tables: 0, menuItems: 0, tablesNeeded: 0, waitersNeeded: 0 },
      });
    }

    const guestCount = Number(event.guest_count) || 0;
    const kidsCount = Number(event.kids_count) || 0;
    const totalGuests = guestCount + kidsCount;
    const selectedItems = event.selected_items || [];

    // 1. Generate guests from selected_items (menu items)
    const guests: any[] = [];
    const menuItems: any[] = [];

    // Generate placeholder guests
    for (let i = 0; i < guestCount; i++) {
      guests.push({
        event_id: id,
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
        event_id: id,
        name: `Niño ${i + 1}`,
        group_name: null,
        rsvp: 'pendiente',
        menu_type: 'nino',
        dietary: [],
        notes: null,
      });
    }

    // Generate menu items for display
    for (const item of selectedItems) {
      menuItems.push({
        event_id: id,
        name: item.name,
        category: item.category,
        quantity: Number(item.quantity) || 0,
        unit_price_pvp: Number(item.unit_price_pvp) || 0,
        subtotal_pvp: Number(item.subtotal_pvp) || 0,
      });
    }

    // 2. Generate shopping_list from catalog ingredients
    // For each menu item, look up its catalog entry, extract ingredients,
    // multiply by quantity, and aggregate by ingredient name
    const ingredientTotals: Record<string, { grams: number; units: number; ml: number; category: string; item_name: string }> = {};

    for (const menuItem of selectedItems) {
      const qty = Number(menuItem.quantity) || 0;
      const itemName = menuItem.name || '';
      const category = menuItem.category || '';

      // Look up the catalog item by name
      const catalog = await querySingle<any>(
        `SELECT ingredients FROM catalog_items WHERE name ILIKE $1 AND active = true`,
        [itemName]
      );

      if (catalog && catalog.ingredients) {
        let ingredients: any[] = [];
        try {
          ingredients = typeof catalog.ingredients === 'string'
            ? JSON.parse(catalog.ingredients)
            : catalog.ingredients;
        } catch {
          // Catalog item exists but ingredients JSON is malformed — skip
          // Log as a direct item instead
          const key = itemName.toLowerCase().trim();
          if (!ingredientTotals[key]) {
            ingredientTotals[key] = { grams: 0, units: 0, ml: 0, category, item_name: itemName };
          }
          ingredientTotals[key].units += 1 * qty;
          continue;
        }

        for (const ing of ingredients) {
          const key = ing.name.toLowerCase().trim();
          if (!ingredientTotals[key]) {
            ingredientTotals[key] = { grams: 0, units: 0, ml: 0, category, item_name: itemName };
          }

          const t = ingredientTotals[key];
          if (ing.grams) t.grams += Number(ing.grams) * qty;
          if (ing.count) t.units += Number(ing.count) * qty;
          if (ing.ml) t.ml += Number(ing.ml) * qty;
        }
      } else {
        // Item not found in catalog → add the item name itself as ingredient (1 unit)
        const key = itemName.toLowerCase().trim();
        if (!ingredientTotals[key]) {
          ingredientTotals[key] = { grams: 0, units: 0, ml: 0, category, item_name: itemName };
        }
        ingredientTotals[key].units += 1 * qty;
      }
    }

    // 3. Calculate table distribution
    const ratios = await getOperationRatios();
    const tablesNeeded = calcMesas(guestCount, ratios);
    const tables: any[] = [];
    const guestsPerTable = Math.floor(guestCount / tablesNeeded);
    const remainder = guestCount % tablesNeeded;

    let guestIdx = 0;
    for (let t = 0; t < tablesNeeded; t++) {
      const count = guestsPerTable + (t < remainder ? 1 : 0);
      tables.push({
        event_id: id,
        table_number: t + 1,
        capacity: count,
        guests: guests.slice(guestIdx, guestIdx + count).map((g: any) => g.id),
      });
      guestIdx += count;
    }

    // Calculate staff
    const serviceType: ServiceType = event.service_type === 'coctel' ? 'coctel' : 'menu';
    const waitersNeeded = calcCamareros(guestCount, serviceType, ratios);

    // Execute all inserts in a single transaction for atomicity
    const result = await transaction(async (client) => {
      // Insert guests
      const insertedGuests: any[] = [];
      for (const guest of guests) {
        const res = await client.query(
          `INSERT INTO guests (event_id, name, group_name, rsvp, menu_type, dietary, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [guest.event_id, guest.name, guest.group_name, guest.rsvp, guest.menu_type, JSON.stringify(guest.dietary), guest.notes]
        );
        if (res.rows[0]) insertedGuests.push(res.rows[0]);
      }

      // Insert tables
      const insertedTables: any[] = [];
      for (const table of tables) {
        const res = await client.query(
          `INSERT INTO tables (event_id, table_number, capacity)
           VALUES ($1, $2, $3) RETURNING *`,
          [table.event_id, table.table_number, table.capacity]
        );
        if (res.rows[0]) insertedTables.push(res.rows[0]);
      }

      // Insert menu items
      const insertedMenuItems: any[] = [];
      for (const item of menuItems) {
        const res = await client.query(
          `INSERT INTO event_menu_items (event_id, name, category, quantity, unit_price_pvp, subtotal_pvp)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [item.event_id, item.name, item.category, item.quantity, item.unit_price_pvp, item.subtotal_pvp]
        );
        if (res.rows[0]) insertedMenuItems.push(res.rows[0]);
      }

      // Mark operations as generated
      await client.query(
        `UPDATE events SET operations_generated_at = now() WHERE id = $1`, [id]
      );

      return { insertedGuests, insertedTables, insertedMenuItems };
    });

    return NextResponse.json({
      success: true,
      message: 'Operaciones generadas correctamente',
      data: {
        guests: result.insertedGuests.length,
        tables: result.insertedTables.length,
        menuItems: result.insertedMenuItems.length,
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
