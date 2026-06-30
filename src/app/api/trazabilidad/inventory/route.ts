/**
 * EventFlow — API de trazabilidad: Inventario
 * GET  /api/trazabilidad/inventory — Listar inventario completo con JOIN a ingredientes
 * POST /api/trazabilidad/inventory — Crear fila de inventario para un ingrediente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany, querySingle, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { adjustIngredientStock } from '@/lib/domain/stockLedger';

// ── GET: Listar inventario actual ──

export async function GET(_request: NextRequest) {
  try {
    const items = await queryMany<any>(
      `SELECT
         inv.id,
         inv.ingredient_id,
         i.name AS ingredient_name,
         inv.quantity,
         inv.unit,
         inv.min_stock,
         inv.last_movement_at,
         inv.notes,
         inv.created_at,
         inv.updated_at
       FROM inventory inv
       JOIN ingredients i ON i.id = inv.ingredient_id
       ORDER BY i.name`
    );

    const data = items.map((item: any) => ({
      ...item,
      quantity: Number(item.quantity),
      min_stock: item.min_stock !== null ? Number(item.min_stock) : null,
      low_stock: item.min_stock !== null && Number(item.quantity) < Number(item.min_stock),
    }));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ── POST: Crear fila de inventario para un ingrediente ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ingredient_id, quantity, unit, min_stock, notes } = body;

    if (!ingredient_id || !isValidUUID(ingredient_id)) {
      return NextResponse.json(
        { success: false, error: 'ingredient_id válido es requerido.' },
        { status: 422 }
      );
    }

    // Verificar que el ingrediente existe
    const ingredient = await querySingle<any>(
      'SELECT id, name, unit, quantity FROM ingredients WHERE id = $1',
      [ingredient_id]
    );
    if (!ingredient) {
      return NextResponse.json(
        { success: false, error: 'Ingrediente no encontrado.' },
        { status: 404 }
      );
    }

    const finalUnit = unit || ingredient.unit || 'g';
    const finalQuantity = quantity !== undefined ? Number(quantity) : 0;
    const finalMinStock = min_stock !== undefined ? Number(min_stock) : null;

    // G6: ingredients.quantity es la fuente canónica — "declarar inventario"
    // ahora significa ajustarla a la cantidad indicada (vía el ledger único,
    // que refleja el espejo en `inventory` automáticamente). Es idempotente:
    // declarar la misma cantidad dos veces no genera movimiento adicional.
    const inventory = await transaction(async (client) => {
      if (finalMinStock !== null) {
        await client.query(`UPDATE ingredients SET min_stock = $1 WHERE id = $2`, [finalMinStock, ingredient_id]);
      }
      const currentQty = Number(ingredient.quantity) || 0;
      const delta = finalQuantity - currentQty;
      if (delta !== 0) {
        await adjustIngredientStock(client, {
          ingredientId: ingredient_id,
          delta,
          reason: 'inventario_inicial',
          movementType: 'adjustment',
          notes: notes || 'Declaración de inventario',
        });
      } else {
        // Garantiza que exista el espejo aunque no haya cambio de cantidad.
        await client.query(
          `INSERT INTO inventory (ingredient_id, quantity, unit, min_stock, notes)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (ingredient_id) DO UPDATE SET notes = $5`,
          [ingredient_id, currentQty, finalUnit, finalMinStock, notes || null]
        );
      }
      return (await client.query(`SELECT * FROM inventory WHERE ingredient_id = $1`, [ingredient_id])).rows[0];
    });

    return NextResponse.json({ success: true, data: inventory }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}