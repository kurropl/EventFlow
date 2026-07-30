/**
 * WP-01: API de conversiones por ingrediente
 * GET /api/ingredients/[id]/conversions - Listar conversiones
 * POST /api/ingredients/[id]/conversions - Crear/actualizar conversión
 * DELETE /api/ingredients/[id]/conversions/[conversionId] - Eliminar conversión
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { clearConversionCache } from '@/lib/units';

/**
 * GET /api/ingredients/[id]/conversions
 * Lista todas las conversiones de un ingrediente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const pool = getPool();

    // Verificar que el ingrediente existe
    const ingredientCheck = await pool.query(
      'SELECT id, name, base_unit FROM ingredients WHERE id = $1',
      [id]
    );

    if (ingredientCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Ingrediente no encontrado' },
        { status: 404 }
      );
    }

    const ingredient = ingredientCheck.rows[0];

    // Obtener conversiones
    const result = await pool.query(
      `SELECT id, ingredient_id, unit_name, factor_to_base, created_at, updated_at
       FROM ingredient_unit_conversions
       WHERE ingredient_id = $1
       ORDER BY unit_name`,
      [id]
    );

    return NextResponse.json({
      ingredient: {
        id: ingredient.id,
        name: ingredient.name,
        base_unit: ingredient.base_unit,
      },
      conversions: result.rows,
    });
  } catch (error) {
    console.error('Error fetching conversions:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ingredients/[id]/conversions
 * Crea o actualiza una conversión
 * Body: { unit_name: string, factor_to_base: number }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { unit_name, factor_to_base } = body;

    // Validaciones
    if (!unit_name || typeof unit_name !== 'string') {
      return NextResponse.json(
        { error: 'unit_name es requerido y debe ser string' },
        { status: 400 }
      );
    }

    if (factor_to_base === undefined || typeof factor_to_base !== 'number' || factor_to_base <= 0) {
      return NextResponse.json(
        { error: 'factor_to_base es requerido y debe ser un número positivo' },
        { status: 400 }
      );
    }

    const normalizedUnit = unit_name.trim().toLowerCase();

    const pool = getPool();

    // Verificar que el ingrediente existe y obtener su base_unit
    const ingredientCheck = await pool.query(
      'SELECT id, base_unit FROM ingredients WHERE id = $1',
      [id]
    );

    if (ingredientCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Ingrediente no encontrado' },
        { status: 404 }
      );
    }

    const ingredient = ingredientCheck.rows[0];

    // No permitir crear conversión de la unidad base a sí misma
    if (normalizedUnit === ingredient.base_unit) {
      return NextResponse.json(
        { error: `No se puede crear conversión para la unidad base '${ingredient.base_unit}'` },
        { status: 400 }
      );
    }

    // Insertar o actualizar (UPSERT)
    const result = await pool.query(
      `INSERT INTO ingredient_unit_conversions (ingredient_id, unit_name, factor_to_base)
       VALUES ($1, $2, $3)
       ON CONFLICT (ingredient_id, unit_name)
       DO UPDATE SET factor_to_base = $3, updated_at = now()
       RETURNING id, ingredient_id, unit_name, factor_to_base, created_at, updated_at`,
      [id, normalizedUnit, factor_to_base]
    );

    // Limpiar cache
    clearConversionCache(id);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('Error creating/updating conversion:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ingredients/[id]/conversions?unit_name=xxx
 * Elimina una conversión por unit_name
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const unit_name = searchParams.get('unit_name');

    if (!unit_name) {
      return NextResponse.json(
        { error: 'unit_name es requerido como query parameter' },
        { status: 400 }
      );
    }

    const pool = getPool();

    const result = await pool.query(
      `DELETE FROM ingredient_unit_conversions
       WHERE ingredient_id = $1 AND unit_name = $2
       RETURNING id`,
      [id, unit_name.trim().toLowerCase()]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Conversión no encontrada' },
        { status: 404 }
      );
    }

    // Limpiar cache
    clearConversionCache(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting conversion:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
