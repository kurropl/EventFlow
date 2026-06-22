/**
 * EventFlow — API de trazabilidad: Historial de movimientos
 * GET /api/trazabilidad/movements — Historial paginado con filtros
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const ingredientId = searchParams.get('ingredient_id');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (type) {
      const validTypes = ['receipt', 'consumption', 'adjustment', 'expiry', 'transfer'];
      if (validTypes.includes(type)) {
        conditions.push(`im.movement_type = $${idx++}`);
        params.push(type);
      } else {
        return NextResponse.json(
          { success: false, error: `Tipo inválido. Válidos: ${validTypes.join(', ')}` },
          { status: 422 }
        );
      }
    }

    if (ingredientId) {
      if (!isValidUUID(ingredientId)) {
        return NextResponse.json(
          { success: false, error: 'ingredient_id inválido.' },
          { status: 422 }
        );
      }
      conditions.push(`inv.ingredient_id = $${idx++}`);
      params.push(ingredientId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Obtener total de registros
    const countResult = await querySingle<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM inventory_movements im
       JOIN inventory inv ON inv.id = im.inventory_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Obtener movimientos paginados
    const movements = await queryMany<any>(
      `SELECT
         im.id,
         im.inventory_id,
         im.movement_type,
         im.quantity,
         im.unit,
         im.reference_type,
         im.reference_id,
         im.previous_stock,
         im.new_stock,
         im.notes,
         im.created_at,
         inv.ingredient_id,
         i.name AS ingredient_name,
         i.unit AS ingredient_unit
       FROM inventory_movements im
       JOIN inventory inv ON inv.id = im.inventory_id
       JOIN ingredients i ON i.id = inv.ingredient_id
       ${whereClause}
       ORDER BY im.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        movements: movements.map((m: any) => ({
          ...m,
          quantity: Number(m.quantity),
          previous_stock: Number(m.previous_stock),
          new_stock: Number(m.new_stock),
        })),
        pagination: {
          page,
          limit,
          total,
          total_pages: totalPages,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}