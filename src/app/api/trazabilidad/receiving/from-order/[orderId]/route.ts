/**
 * EventFlow — API de trazabilidad: Recibir pedido completo
 * POST /api/trazabilidad/receiving/from-order/[orderId]
 *
 * Toma un supplier_order con sus items, crea receiving_log para cada item,
 * actualiza inventario y marca el pedido como 'received'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { adjustIngredientStock } from '@/lib/domain/stockLedger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    if (!UUID_REGEX.test(orderId)) {
      return NextResponse.json({ success: false, error: 'ID de pedido inválido.' }, { status: 422 });
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Verificar pedido
      const orderResult = await client.query(
        'SELECT * FROM supplier_orders WHERE id = $1 FOR UPDATE',
        [orderId]
      );
      if (orderResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Pedido no encontrado.' },
          { status: 404 }
        );
      }

      const order = orderResult.rows[0];

      if (order.status === 'received') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Este pedido ya ha sido recibido.' },
          { status: 409 }
        );
      }

      if (order.status === 'cancelled') {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'No se puede recibir un pedido cancelado.' },
          { status: 422 }
        );
      }

      // 2. Obtener items del pedido
      const itemsResult = await client.query(
        'SELECT * FROM supplier_order_items WHERE order_id = $1',
        [orderId]
      );
      const items = itemsResult.rows;

      if (items.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'El pedido no tiene items.' },
          { status: 422 }
        );
      }

      const createdReceivings: any[] = [];
      const errors: string[] = [];
      const tempLotPrefix = `LOTE-PEDIDO-${orderId.slice(0, 8)}`;

      // 3. Para cada item, crear receiving_log y actualizar inventario
      for (const item of items) {
        try {
          const ingredientId = item.ingredient_id;
          const ingredientName = item.ingredient_name;
          const itemQuantity = Number(item.quantity);
          const itemUnit = item.unit || 'g';
          const lotNumber = `${tempLotPrefix}-${ingredientName?.slice(0, 20).replace(/\s+/g, '-') || 'ING'}`;

          if (!ingredientId) {
            errors.push(`Item "${ingredientName}" no tiene ingredient_id asignado. Se omite.`);
            continue;
          }

          // Insertar receiving_log
          const receivingResult = await client.query(
            `INSERT INTO receiving_log
               (supplier_order_id, ingredient_id, lot_number, batch_quantity, unit,
                received_date, supplier, condition_ok, source, notes)
             VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, $6, true, 'api', $7)
             RETURNING *`,
            [
              orderId,
              ingredientId,
              lotNumber,
              itemQuantity,
              itemUnit,
              order.supplier || null,
              `Recibido del pedido ${orderId.slice(0, 8)}`,
            ]
          );
          const receivingRecord = receivingResult.rows[0];

          // G6: antes esto SOLO escribía en `inventory.quantity` — nunca en
          // `ingredients.quantity` (la fuente que consumen escandallo/
          // stockDeduct/inventory_commitments). Bug real confirmado leyendo
          // el código; corregido vía el ledger único.
          await adjustIngredientStock(client, {
            ingredientId,
            delta: itemQuantity,
            reason: 'compra_prevision',
            movementType: 'receipt',
            referenceType: 'receiving_log',
            referenceId: receivingRecord.id,
            notes: `Recepción automática desde pedido ${orderId.slice(0, 8)} para ${ingredientName}`,
          });

          createdReceivings.push(receivingRecord);
        } catch (itemError) {
          const msg = itemError instanceof Error ? itemError.message : 'Error desconocido';
          errors.push(`Error procesando "${item.ingredient_name}": ${msg}`);
        }
      }

      // 4. Marcar pedido como 'received'
      await client.query(
        `UPDATE supplier_orders SET status = 'received', updated_at = now() WHERE id = $1`,
        [orderId]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: {
          order_id: orderId,
          supplier: order.supplier,
          items_processed: createdReceivings.length,
          items_total: items.length,
          receivings: createdReceivings,
          errors: errors.length > 0 ? errors : undefined,
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