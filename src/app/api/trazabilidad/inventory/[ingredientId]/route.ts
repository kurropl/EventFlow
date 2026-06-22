/**
 * EventFlow — API de trazabilidad: Detalle de inventario por ingrediente
 * GET /api/trazabilidad/inventory/[ingredientId] — Detalle + movimientos
 * PUT /api/trazabilidad/inventory/[ingredientId] — Ajustar stock manualmente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET: Detalle de inventario + movimientos ──

export async function GET(
  _request: NextRequest,
  { params }: { params: { ingredientId: string } }
) {
  try {
    const { ingredientId } = params;
    if (!UUID_REGEX.test(ingredientId)) {
      return NextResponse.json({ success: false, error: 'ID de ingrediente inválido.' }, { status: 422 });
    }

    // Obtener inventario
    const inventory = await querySingle<any>(
      `SELECT inv.*, i.name AS ingredient_name, i.unit AS ingredient_unit
       FROM inventory inv
       JOIN ingredients i ON i.id = inv.ingredient_id
       WHERE inv.ingredient_id = $1`,
      [ingredientId]
    );

    if (!inventory) {
      return NextResponse.json(
        { success: false, error: 'No hay inventario para este ingrediente.' },
        { status: 404 }
      );
    }

    // Obtener movimientos
    const movements = await queryMany<any>(
      `SELECT im.*
       FROM inventory_movements im
       WHERE im.inventory_id = $1
       ORDER BY im.created_at DESC
       LIMIT 100`,
      [inventory.id]
    );

    return NextResponse.json({
      success: true,
      data: {
        ...inventory,
        quantity: Number(inventory.quantity),
        min_stock: inventory.min_stock !== null ? Number(inventory.min_stock) : null,
        low_stock: inventory.min_stock !== null && Number(inventory.quantity) < Number(inventory.min_stock),
        movements,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ── PUT: Ajustar stock manualmente ──

export async function PUT(
  request: NextRequest,
  { params }: { params: { ingredientId: string } }
) {
  try {
    const { ingredientId } = params;
    if (!UUID_REGEX.test(ingredientId)) {
      return NextResponse.json({ success: false, error: 'ID de ingrediente inválido.' }, { status: 422 });
    }

    const body = await request.json();
    const { quantity, notes } = body;

    if (quantity === undefined || quantity === null) {
      return NextResponse.json(
        { success: false, error: 'quantity es requerido.' },
        { status: 400 }
      );
    }

    const newQuantity = Number(quantity);
    if (isNaN(newQuantity) || newQuantity < 0) {
      return NextResponse.json(
        { success: false, error: 'quantity debe ser un número válido >= 0.' },
        { status: 422 }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Obtener inventario actual
      const inventory = await client.query(
        `SELECT inv.*, i.name AS ingredient_name
         FROM inventory inv
         JOIN ingredients i ON i.id = inv.ingredient_id
         WHERE inv.ingredient_id = $1
         FOR UPDATE`,
        [ingredientId]
      );

      if (inventory.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'No hay inventario para este ingrediente. Créelo primero con POST.' },
          { status: 404 }
        );
      }

      const inv = inventory.rows[0];
      const oldQuantity = Number(inv.quantity);
      const diff = newQuantity - oldQuantity;

      // Actualizar inventario
      const updated = await client.query(
        `UPDATE inventory
         SET quantity = $1, last_movement_at = now(), notes = $2
         WHERE ingredient_id = $3
         RETURNING *`,
        [newQuantity, notes || null, ingredientId]
      );

      const invRecord = updated.rows[0];

      // Registrar movimiento
      await client.query(
        `INSERT INTO inventory_movements
           (inventory_id, movement_type, quantity, unit, reference_type, previous_stock, new_stock, notes)
         VALUES ($1, 'adjustment', $2, $3, 'manual', $4, $5, $6)`,
        [invRecord.id, diff, inv.unit, oldQuantity, newQuantity, notes || 'Ajuste manual de stock']
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: {
          ...invRecord,
          quantity: Number(invRecord.quantity),
          previous_quantity: oldQuantity,
          difference: diff,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}