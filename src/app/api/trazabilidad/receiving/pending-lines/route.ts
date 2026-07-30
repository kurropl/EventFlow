/**
 * EventFlow — API de trazabilidad: Líneas de OC pendientes
 * GET /api/trazabilidad/receiving/pending-lines
 *
 * Devuelve las líneas de supplier_order_items con cantidad pendiente de recibir.
 * Se usa como fuente para el selector del formulario de recepción unificada.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplier = searchParams.get('supplier');
    const ingredientId = searchParams.get('ingredient_id');

    const conditions: string[] = [
      `so.status IN ('pending', 'approved', 'delivered', 'partial')`,
      `soi.quantity > COALESCE(soi.received_quantity, 0)`,
    ];
    const params: any[] = [];
    let idx = 1;

    if (supplier) {
      conditions.push(`so.supplier ILIKE $${idx++}`);
      params.push(`%${supplier}%`);
    }
    if (ingredientId) {
      conditions.push(`soi.ingredient_id = $${idx++}`);
      params.push(ingredientId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const lines = await queryMany<any>(
      `SELECT
         soi.id AS line_id,
         soi.order_id,
         so.id AS supplier_order_id,
         so.supplier,
         so.status AS order_status,
         soi.ingredient_id,
         i.name AS ingredient_name,
         soi.quantity AS qty_ordered,
         COALESCE(soi.received_quantity, 0) AS qty_received,
         soi.quantity - COALESCE(soi.received_quantity, 0) AS qty_pending,
         soi.unit,
         soi.unit_cost,
         soi.cost_per_unit,
         so.expected_date
       FROM supplier_order_items soi
       JOIN supplier_orders so ON so.id = soi.order_id
       JOIN ingredients i ON i.id = soi.ingredient_id
       ${whereClause}
       ORDER BY so.expected_date ASC NULLS LAST, so.created_at DESC
       LIMIT 100`,
      params
    );

    return NextResponse.json({ success: true, data: lines });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
