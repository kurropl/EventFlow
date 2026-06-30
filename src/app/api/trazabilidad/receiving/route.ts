/**
 * EventFlow — API de trazabilidad: Recepción de mercancía
 * GET  /api/trazabilidad/receiving — Listar recepciones con filtros
 * POST /api/trazabilidad/receiving — Registrar recepción (actualiza inventario automáticamente)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID, sanitizeText } from '@/lib/security';
import { convertUnit, areSameDimension } from '@/lib/units';
import { adjustIngredientStock } from '@/lib/domain/stockLedger';

// ── GET: Listar recepciones ──

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const supplier = searchParams.get('supplier');
    const lot = searchParams.get('lot');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (supplier) {
      conditions.push(`rl.supplier ILIKE $${idx++}`);
      params.push(`%${supplier}%`);
    }
    if (lot) {
      conditions.push(`rl.lot_number ILIKE $${idx++}`);
      params.push(`%${lot}%`);
    }
    if (dateFrom) {
      conditions.push(`rl.received_date >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`rl.received_date <= $${idx++}`);
      params.push(dateTo);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const items = await queryMany<any>(
      `SELECT
         rl.id,
         rl.supplier_order_id,
         rl.ingredient_id,
         i.name AS ingredient_name,
         rl.lot_number,
         rl.batch_quantity,
         rl.unit,
         rl.received_date,
         rl.received_by,
         rl.expiry_date,
         rl.temperature,
         rl.supplier,
         rl.condition_ok,
         rl.source,
         rl.qr_code,
         rl.notes,
         rl.created_at,
         CASE WHEN rl.temperature IS NOT NULL AND rl.temperature > 8 THEN true ELSE false END AS temp_alert
       FROM receiving_log rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       ${whereClause}
       ORDER BY rl.received_date DESC, rl.created_at DESC
       LIMIT 500`,
      params
    );

    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ── POST: Registrar recepción ──

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      ingredient_id,
      lot_number,
      batch_quantity,
      unit,
      received_date,
      received_by,
      expiry_date,
      temperature,
      supplier,
      qr_code,
      supplier_order_id,
      condition_ok,
      notes,
    } = body;

    // Validaciones
    if (!ingredient_id || !isValidUUID(ingredient_id)) {
      return NextResponse.json(
        { success: false, error: 'ingredient_id válido es requerido.' },
        { status: 422 }
      );
    }
    if (!lot_number || typeof lot_number !== 'string' || lot_number.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'lot_number es requerido.' },
        { status: 422 }
      );
    }
    if (batch_quantity === undefined || batch_quantity === null || Number(batch_quantity) <= 0) {
      return NextResponse.json(
        { success: false, error: 'batch_quantity debe ser un número positivo.' },
        { status: 422 }
      );
    }

    const finalQuantity = Number(batch_quantity);
    const finalUnit = unit || 'g';
    const finalDate = received_date || new Date().toISOString().split('T')[0];
    const finalCondition = condition_ok !== undefined ? Boolean(condition_ok) : true;

    // Validar supplier_order_id si se proporciona
    if (supplier_order_id && !isValidUUID(supplier_order_id)) {
      return NextResponse.json(
        { success: false, error: 'supplier_order_id inválido.' },
        { status: 422 }
      );
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Verificar ingrediente
      const ingredient = await client.query(
        'SELECT id, name, unit, quantity FROM ingredients WHERE id = $1',
        [ingredient_id]
      );
      if (ingredient.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Ingrediente no encontrado.' },
          { status: 404 }
        );
      }
      const ingUnit = ingredient.rows[0].unit || 'g';
      const previousStock = Number(ingredient.rows[0].quantity) || 0;
      // Convertir lo recibido a la unidad de stock del ingrediente (misma dimensión).
      let addQty = finalQuantity;
      try {
        if (finalUnit !== ingUnit && areSameDimension(finalUnit, ingUnit)) {
          addQty = convertUnit(finalQuantity, finalUnit, ingUnit);
        }
      } catch { /* unidades incompatibles → se suma tal cual */ }

      // 2. Insertar receiving_log
      const receivingResult = await client.query(
        `INSERT INTO receiving_log
           (supplier_order_id, ingredient_id, lot_number, batch_quantity, unit,
            received_date, received_by, expiry_date, temperature, supplier,
            condition_ok, qr_code, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [
          supplier_order_id || null,
          ingredient_id,
          sanitizeText(lot_number, 200),
          finalQuantity,
          finalUnit,
          finalDate,
          received_by || null,
          expiry_date || null,
          temperature !== undefined && temperature !== null ? Number(temperature) : null,
          supplier || null,
          finalCondition,
          qr_code || null,
          notes || null,
        ]
      );
      const receivingRecord = receivingResult.rows[0];

      // 3. Cierre del círculo (FR-C09) vía el ledger único (G6): actualiza
      //    ingredients.quantity (canónico) Y refleja inventory/inventory_movements
      //    (pantallas de Trazabilidad) en la misma transacción.
      const adj = await adjustIngredientStock(client, {
        ingredientId: ingredient_id,
        delta: addQty,
        reason: 'compra_prevision',
        movementType: 'receipt',
        referenceType: 'receiving_log',
        referenceId: receivingRecord.id,
        notes: notes ? `Recepción lote ${lot_number}: ${notes}` : `Recepción lote ${lot_number}`,
      });
      const newStock = adj.newQty;

      await client.query('COMMIT');

      return NextResponse.json(
        {
          success: true,
          data: {
            receiving: receivingRecord,
            inventory: {
              ingredient_id,
              previous_stock: previousStock,
              added: addQty,
              quantity: newStock,
              unit: ingUnit,
            },
            temp_alert: temperature !== null && temperature !== undefined && Number(temperature) > 8,
          },
        },
        { status: 201 }
      );
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