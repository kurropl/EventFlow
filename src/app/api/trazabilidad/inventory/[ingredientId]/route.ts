/**
 * EventFlow — API de trazabilidad: Detalle de inventario por ingrediente
 * GET /api/trazabilidad/inventory/[ingredientId] — Detalle + movimientos
 * PUT /api/trazabilidad/inventory/[ingredientId] — Ajustar stock manualmente
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { adjustIngredientStock } from '@/lib/domain/stockLedger';

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

    // G6: el ajuste manual ahora pasa por el ledger único — actualiza
    // ingredients.quantity (canónico) y refleja inventory/inventory_movements
    // en la misma transacción, sin que esta ruta pierda su contrato HTTP.
    const result = await transaction(async (client) => {
      const ing = (await client.query(
        `SELECT i.id, i.quantity, i.unit, i.name
         FROM inventory inv JOIN ingredients i ON i.id = inv.ingredient_id
         WHERE inv.ingredient_id = $1 FOR UPDATE`,
        [ingredientId]
      )).rows[0];
      if (!ing) return null;

      const oldQuantity = Number(ing.quantity);
      const diff = newQuantity - oldQuantity;

      const adj = await adjustIngredientStock(client, {
        ingredientId,
        delta: diff,
        reason: 'ajuste_inventario',
        movementType: 'adjustment',
        referenceType: 'manual',
        notes: notes || 'Ajuste manual de stock',
      });

      const invRecord = (await client.query(`SELECT * FROM inventory WHERE ingredient_id = $1`, [ingredientId])).rows[0];
      return { invRecord, oldQuantity: adj.previousQty, diff };
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'No hay inventario para este ingrediente. Créelo primero con POST.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result.invRecord,
        quantity: Number(result.invRecord.quantity),
        previous_quantity: result.oldQuantity,
        difference: result.diff,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}