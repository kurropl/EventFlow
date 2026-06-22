import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { z } from 'zod';

const createRuleSchema = z.object({
  category: z.string().nullable().optional(),
  catalog_item_id: z.string().uuid().nullable().optional(),
  equipment_id: z.string().uuid(),
  quantity_per_use: z.number().min(0).default(0),
  per_guest: z.boolean().default(false),
  notes: z.string().nullable().optional(),
});

export async function GET(_req: NextRequest) {
  try {
    const pool = getPool();

    const result = await pool.query(
      `SELECT er.id, er.category, er.catalog_item_id, er.equipment_id, er.quantity_per_use,
              er.per_guest, er.notes, er.created_at,
              e.name AS equipment_name
       FROM equipment_rules er
       JOIN equipment e ON e.id = er.equipment_id
       ORDER BY e.name ASC, er.category ASC NULLS LAST`
    );

    return NextResponse.json({ items: result.rows, total: result.rowCount });
  } catch (error) {
    console.error('Error listing equipment rules:', error);
    return NextResponse.json(
      { error: 'Error al listar reglas de equipamiento' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json();
    const parsed = createRuleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { category, catalog_item_id, equipment_id, quantity_per_use, per_guest, notes } =
      parsed.data;

    const result = await pool.query(
      `INSERT INTO equipment_rules (category, catalog_item_id, equipment_id, quantity_per_use, per_guest, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, category, catalog_item_id, equipment_id, quantity_per_use, per_guest, notes, created_at`,
      [
        category ?? null,
        catalog_item_id ?? null,
        equipment_id,
        quantity_per_use,
        per_guest,
        notes ?? null,
      ]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating equipment rule:', error);
    return NextResponse.json(
      { error: 'Error al crear regla de equipamiento' },
      { status: 500 }
    );
  }
}