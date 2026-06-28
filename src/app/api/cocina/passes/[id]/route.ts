import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { z } from 'zod';

const updatePassMappingSchema = z.object({
  pass_id: z.string().uuid(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const pool = getPool();
    const { id } = await params;
    const body = await req.json();
    const parsed = updatePassMappingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `UPDATE category_pass_mapping SET pass_id = $1 WHERE id = $2
       RETURNING id, category, pass_id`,
      [parsed.data.pass_id, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ success: false, error: 'Mapeo no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating pass mapping:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar el mapeo de pase' },
      { status: 500 }
    );
  }
}
