/**
 * EventFlow — API de trazabilidad: Detalle de recepción
 * GET /api/trazabilidad/receiving/[id] — Detalle de una recepción
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ success: false, error: 'ID de recepción inválido.' }, { status: 422 });
    }

    const receiving = await querySingle<any>(
      `SELECT
         rl.*,
         i.name AS ingredient_name,
         i.unit AS ingredient_unit,
         so.supplier AS order_supplier,
         so.status AS order_status
       FROM receiving_log rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       LEFT JOIN supplier_orders so ON so.id = rl.supplier_order_id
       WHERE rl.id = $1`,
      [id]
    );

    if (!receiving) {
      return NextResponse.json(
        { success: false, error: 'Recepción no encontrada.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...receiving,
        batch_quantity: Number(receiving.batch_quantity),
        temperature: receiving.temperature !== null ? Number(receiving.temperature) : null,
        temp_alert: receiving.temperature !== null && Number(receiving.temperature) > 8,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}