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

    const result = await pool.query(
      `SELECT p.id, p.name, p.display_order, p.created_at,
              json_agg(
                json_build_object(
                  'category', cpm.category,
                  'pass_id', cpm.pass_id
                )
              ) AS category_mappings
       FROM passes p
       LEFT JOIN category_pass_mapping cpm ON cpm.pass_id = p.id
       GROUP BY p.id, p.name, p.display_order, p.created_at
       ORDER BY p.display_order ASC`
    );

    return NextResponse.json({ items: result.rows, total: result.rowCount });
  } catch (error) {
    console.error('Error listing passes:', error);
    return NextResponse.json(
      { error: 'Error al listar pases' },
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

      // Upsert each mapping
      for (const mapping of parsed.data.mappings) {
        // First ensure the category exists in categories table
        await client.query(
          `INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
          [mapping.category]
        );

        await client.query(
          `INSERT INTO category_pass_mapping (category, pass_id)
           VALUES ($1, $2)
           ON CONFLICT (category, pass_id) DO UPDATE SET pass_id = EXCLUDED.pass_id`,
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