import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { z } from 'zod';

const customPassOrderSchema = z.array(
  z.object({
    item_name: z.string().min(1),
    pass_number: z.number().int().min(0),
  })
);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const pool = getPool();
    const { eventId } = await params;

    // Get event with custom_pass_order (events usa client_name, no name)
    const eventResult = await pool.query(
      `SELECT id, client_name AS name, custom_pass_order
       FROM events WHERE id = $1`,
      [eventId]
    );

    if (eventResult.rowCount === 0) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const event = eventResult.rows[0];
    const customPassOrder: Record<string, number> = event.custom_pass_order ?? {};

    // Get category_pass_mapping to resolve categories -> passes
    const mappingResult = await pool.query(
      `SELECT cpm.category, cpm.pass_id, p.name AS pass_name, p.sort_order AS display_order
       FROM category_pass_mapping cpm
       JOIN service_passes p ON p.id = cpm.pass_id
       ORDER BY p.sort_order ASC`
    );

    // Get all menu items from the event
    const itemsResult = await pool.query(
      `SELECT mi.name, mi.category
       FROM event_menu_items mi
       WHERE mi.event_id = $1
       ORDER BY mi.name ASC`,
      [eventId]
    );

    // Build category -> pass mapping
    const categoryToPass: Record<string, { pass_id: string; pass_name: string; display_order: number }> = {};
    for (const row of mappingResult.rows) {
      categoryToPass[row.category] = {
        pass_id: row.pass_id,
        pass_name: row.pass_name,
        display_order: row.display_order,
      };
    }

    // For each item, assign pass based on category mapping + custom override
    const items = itemsResult.rows.map((item: { name: string; category: string }) => {
      // Default pass from category mapping
      const defaultPass = categoryToPass[item.category] ?? null;
      // Custom override if set
      const customPassNumber = customPassOrder[item.name] ?? null;

      return {
        item_name: item.name,
        category: item.category,
        default_pass: defaultPass
          ? { pass_id: defaultPass.pass_id, pass_name: defaultPass.pass_name }
          : null,
        custom_pass_number: customPassNumber,
      };
    });

    return NextResponse.json({
      event: { id: event.id, name: event.name },
      category_mappings: mappingResult.rows.map((r: { category: string; pass_id: string; pass_name: string; display_order: number }) => ({
        category: r.category,
        pass_id: r.pass_id,
        pass_name: r.pass_name,
        display_order: r.display_order,
      })),
      items,
    });
  } catch (error) {
    console.error('Error getting event passes:', error);
    return NextResponse.json(
      { error: 'Error al obtener pases del evento' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const pool = getPool();
    const { eventId } = await params;
    const body = await req.json();
    const parsed = customPassOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Convert array to JSON object: { item_name: pass_number }
    const customPassOrder: Record<string, number> = {};
    for (const entry of parsed.data) {
      customPassOrder[entry.item_name] = entry.pass_number;
    }

    const result = await pool.query(
      `UPDATE events SET custom_pass_order = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, custom_pass_order`,
      [JSON.stringify(customPassOrder), eventId]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating custom pass order:', error);
    return NextResponse.json(
      { error: 'Error al actualizar orden de pases personalizado' },
      { status: 500 }
    );
  }
}