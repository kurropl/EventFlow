/**
 * EventFlow — M1: Alertas de caducidad próxima (FEFO)
 *
 * GET  /api/stock/expiry-alerts  — Lotes próximos a caducar (qty_remaining > 0)
 * POST /api/stock/lots/:id/discard — Dar de baja un lote (caducado)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthRequest } from '@/lib/auth';
import { recordStockMovement } from '@/lib/domain/stockMovements';

// ── GET: Expiry alerts ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuthRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysAhead = Number(searchParams.get('days')) || 7;
    const ingredientName = searchParams.get('search') || '';

    const pool = await import('@/lib/db').then(m => m.getPool());
    const query = ingredientName
      ? `SELECT
           sl.id AS lot_id,
           sl.lot_code,
           sl.expiry_date,
           sl.qty_base_remaining,
           sl.received_at,
           i.name AS ingredient_name,
           i.unit,
           i.base_unit,
           CASE
             WHEN sl.expiry_date <= CURRENT_DATE THEN 'caducado'
             WHEN sl.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'próximo'
             ELSE 'ok'
           END AS status
         FROM stock_lots sl
         JOIN ingredients i ON i.id = sl.ingredient_id
         WHERE sl.qty_base_remaining > 0
           AND sl.expiry_date IS NOT NULL
           AND sl.expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $1
           AND i.name ILIKE $2
         ORDER BY sl.expiry_date ASC, sl.qty_base_remaining DESC`
      : `SELECT
           sl.id AS lot_id,
           sl.lot_code,
           sl.expiry_date,
           sl.qty_base_remaining,
           sl.received_at,
           i.name AS ingredient_name,
           i.unit,
           i.base_unit,
           CASE
             WHEN sl.expiry_date <= CURRENT_DATE THEN 'caducado'
             WHEN sl.expiry_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'próximo'
             ELSE 'ok'
           END AS status
         FROM stock_lots sl
         JOIN ingredients i ON i.id = sl.ingredient_id
         WHERE sl.qty_base_remaining > 0
           AND sl.expiry_date IS NOT NULL
           AND sl.expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $1
         ORDER BY sl.expiry_date ASC, sl.qty_base_remaining DESC`;

    const result = await pool.query(query, ingredientName ? [daysAhead, `%${ingredientName}%`] : [daysAhead]);

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: { daysAhead, count: result.rows.length },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal error' },
      { status: 500 }
    );
  }
}

// ── POST: Discard lot (baja por caducado) ─────────────────────────────

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

      // 1. Leer el lote
      const lotResult = await client.query(
        `SELECT id, lot_code, ingredient_id, qty_base_remaining FROM stock_lots WHERE id = $1`,
        [lot]
      );
      if (lotResult.rows.length === 0) {
        throw new Error('Lote no encontrado');
      }
      const lotRow = lotResult.rows[0];

      if (Number(lotRow.qty_base_remaining) <= 0) {
        throw new Error('El lote ya está consumido (sin stock restante)');
      }

      const qtyToDiscard = Number(lotRow.qty_base_remaining);
      const remaining = 0;

      // 2. Marcar qty_base_remaining = 0 (se "consume" todo el lote)
      await client.query(
        `UPDATE stock_lots SET qty_base_remaining = 0 WHERE id = $1`,
        [lot]
      );

      // 3. Crear stock_movimiento tipo 'merma' con razón 'caducado'
      await recordStockMovement(
        { ingredientId: lotRow.ingredient_id, movementType: 'merma', qtyBase: -qtyToDiscard, lotId: lot, reason: 'caducado', userId: auth.userId },
        client
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: {
          lot_code: lotRow.lot_code,
          qty_discarded: qtyToDiscard,
          remaining: 0,
        },
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