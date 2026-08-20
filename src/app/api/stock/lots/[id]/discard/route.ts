/**
 * EventFlow — M1: Descartar lote (baja por caducado)
 * POST /api/stock/lots/:id/discard
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRequest } from '@/lib/auth';
import { recordStockMovement } from '@/lib/domain/stockMovements';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const { lotId } = await request.json();
    const lot = lotId || params.id;

    if (!lot) {
      return NextResponse.json({ success: false, error: 'Se requiere lot ID' }, { status: 400 });
    }

    const pool = await import('@/lib/db').then(m => m.getPool());
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const lotResult = await client.query(
        `SELECT id, lot_code, ingredient_id, qty_base_remaining FROM stock_lots WHERE id = $1`,
        [lot]
      );
      if (lotResult.rows.length === 0) {
        throw new Error('Lote no encontrado');
      }
      const lotRow = lotResult.rows[0];

      if (Number(lotRow.qty_base_remaining) <= 0) {
        throw new Error('El lote ya está consumido');
      }

      const qtyToDiscard = Number(lotRow.qty_base_remaining);

      // Marcar qty_base_remaining = 0
      await client.query(
        `UPDATE stock_lots SET qty_base_remaining = 0 WHERE id = $1`,
        [lot]
      );

      // stock_movimiento tipo 'merma'
      await recordStockMovement(
        { ingredientId: lotRow.ingredient_id, movementType: 'merma', qtyBase: -qtyToDiscard, lotId: lot, reason: 'caducado', userId: auth.userId },
        client
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: { lot_code: lotRow.lot_code, qty_discarded: qtyToDiscard },
      });
    } finally {
      client.release();
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}