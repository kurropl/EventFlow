import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { z } from 'zod';

const updateEquipmentSchema = z.object({
  name: z.string().min(1).optional(),
  category: z
    .enum(['utensilio', 'vajilla', 'maquinaria', 'textil', 'mobiliario', 'descartable'])
    .optional(),
  unit: z.string().min(1).optional(),
  stock_quantity: z.number().int().min(0).optional(),
  min_stock: z.number().int().min(0).optional(),
  notes: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;

    const result = await pool.query(
      `SELECT id, name, category, unit, stock_quantity, min_stock, notes, active, created_at, updated_at
       FROM equipment WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting equipment:', error);
    return NextResponse.json(
      { error: 'Error al obtener equipamiento' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;
    const body = await req.json();
    const parsed = updateEquipmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Build dynamic SET query
    const fields = parsed.data;
    const keys = Object.keys(fields) as (keyof typeof fields)[];
    if (keys.length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
    const values = keys.map((k) => (fields[k] ?? undefined === undefined ? null : fields[k]));

    const result = await pool.query(
      `UPDATE equipment SET ${setClauses.join(', ')}, updated_at = NOW()
       WHERE id = $${keys.length + 1}
       RETURNING id, name, category, unit, stock_quantity, min_stock, notes, active, created_at, updated_at`,
      [...values, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating equipment:', error);
    return NextResponse.json(
      { error: 'Error al actualizar equipamiento' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;

    const result = await pool.query(
      `UPDATE equipment SET active = false, updated_at = NOW()
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Equipo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Equipo desactivado correctamente' });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    return NextResponse.json(
      { error: 'Error al eliminar equipamiento' },
      { status: 500 }
    );
  }
}