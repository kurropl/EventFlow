import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { z } from 'zod';

const passMappingSchema = z.object({
  mappings: z.array(
    z.object({
      category: z.enum([
        'utensilio',
        'vajilla',
        'maquinaria',
        'textil',
        'mobiliario',
        'descartable',
        'catalog_item',
      ]),
      pass_id: z.string().uuid(),
    })
  ),
});

export async function GET(_req: NextRequest) {
  try {
    const pool = getPool();

    // AC5.1: lista los mapeos categoría → pase (forma consumida por PasesTab).
    const result = await pool.query(
      `SELECT cpm.id, cpm.category, cpm.pass_id, sp.name AS pass_name
       FROM category_pass_mapping cpm
       JOIN service_passes sp ON sp.id = cpm.pass_id
       ORDER BY sp.sort_order ASC, cpm.category ASC`
    );

    return NextResponse.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error listing passes:', error);
    return NextResponse.json(
      { success: false, error: 'Error al listar pases' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const pool = getPool();
    const body = await req.json();
    const parsed = passMappingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing mappings for the categories being updated
      const categories = parsed.data.mappings.map((m) => m.category);
      await client.query(
        `DELETE FROM category_pass_mapping WHERE category = ANY($1::text[])`,
        [categories]
      );

      // Upsert each mapping. category_pass_mapping.category es UNIQUE (una
      // categoría → un pase), así que el conflicto se resuelve por (category).
      for (const mapping of parsed.data.mappings) {
        await client.query(
          `INSERT INTO category_pass_mapping (category, pass_id)
           VALUES ($1, $2)
           ON CONFLICT (category) DO UPDATE SET pass_id = EXCLUDED.pass_id`,
          [mapping.category, mapping.pass_id]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({ message: 'Mapeos de pases actualizados correctamente' });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating pass mappings:', error);
    return NextResponse.json(
      { error: 'Error al actualizar mapeos de pases' },
      { status: 500 }
    );
  }
}