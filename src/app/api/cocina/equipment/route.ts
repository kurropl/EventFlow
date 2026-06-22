import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { z } from 'zod';

const EQUIPMENT_CATEGORIES = [
  'utensilio',
  'vajilla',
  'maquinaria',
  'textil',
  'mobiliario',
  'descartable',
] as const;

const createEquipmentSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  category: z.enum(EQUIPMENT_CATEGORIES),
  unit: z.string().min(1, 'La unidad es obligatoria'),
  stock_quantity: z.number().int().min(0).default(0),
  min_stock: z.number().int().min(0).default(0),
  notes: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    const pool = getPool();
    const { searchParams } = req.nextUrl;
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = `
      SELECT id, name, category, unit, stock_quantity, min_stock, notes, active, created_at, updated_at
      FROM equipment
      WHERE active = true
    `;
    const params: (string | number)[] = [];
    let paramIndex = 0;

    if (category) {
      paramIndex += 1;
      query += ` AND category = $${paramIndex}`;
      params.push(category);
    }

    if (search) {
      paramIndex += 1;
      query += ` AND (name ILIKE $${paramIndex} OR notes ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
    }

    query += ' ORDER BY name ASC';

    const result = await pool.query(query, params);
    return NextResponse.json({ items: result.rows, total: result.rowCount });
  } catch (error) {
    console.error('Error listing equipment:', error);
    return NextResponse.json(
      { error: 'Error al listar equipamiento' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json();
    const parsed = createEquipmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, category, unit, stock_quantity, min_stock, notes, active } =
      parsed.data;

    const result = await pool.query(
      `INSERT INTO equipment (name, category, unit, stock_quantity, min_stock, notes, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, category, unit, stock_quantity, min_stock, notes, active, created_at, updated_at`,
      [name, category, unit, stock_quantity ?? 0, min_stock ?? 0, notes ?? null, active ?? true]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating equipment:', error);
    return NextResponse.json(
      { error: 'Error al crear equipamiento' },
      { status: 500 }
    );
  }
}