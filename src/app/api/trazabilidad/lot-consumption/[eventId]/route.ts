/**
 * EventFlow — API de trazabilidad: Consumo de lotes por evento
 * GET  /api/trazabilidad/lot-consumption/[eventId] — Listar lotes consumidos en evento
 * POST /api/trazabilidad/lot-consumption/[eventId] — Registrar consumo de lote
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany, querySingle } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { adjustIngredientStock } from '@/lib/domain/stockLedger';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET: Listar lotes consumidos en el evento ──

export async function GET(
  _request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!UUID_REGEX.test(eventId)) {
      return NextResponse.json({ success: false, error: 'ID de evento inválido.' }, { status: 422 });
    }

    // Verificar evento existe
    const event = await querySingle<any>(
      'SELECT id, client_name, event_date, event_type FROM events WHERE id = $1',
      [eventId]
    );
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado.' },
        { status: 404 }
      );
    }

    const items = await queryMany<any>(
      `SELECT
         lc.id,
         lc.receiving_log_id,
         lc.event_id,
         lc.quantity_consumed,
         lc.unit,
         lc.consumed_at,
         rl.lot_number,
         rl.batch_quantity,
         rl.expiry_date,
         rl.temperature,
         rl.supplier,
         rl.ingredient_id,
         i.name AS ingredient_name
       FROM lot_consumption lc
       JOIN receiving_log rl ON rl.id = lc.receiving_log_id
       JOIN ingredients i ON i.id = rl.ingredient_id
       WHERE lc.event_id = $1
       ORDER BY lc.consumed_at DESC`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      data: {
        event,
        lots: items.map((item: any) => ({
          ...item,
          quantity_consumed: Number(item.quantity_consumed),
          batch_quantity: Number(item.batch_quantity),
          temperature: item.temperature !== null ? Number(item.temperature) : null,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ── POST: Registrar consumo de lote en evento ──

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!UUID_REGEX.test(eventId)) {
      return NextResponse.json({ success: false, error: 'ID de evento inválido.' }, { status: 422 });
    }

    const body = await request.json();
    const { receiving_log_id, quantity_consumed, unit } = body;

    if (!receiving_log_id || !isValidUUID(receiving_log_id)) {
      return NextResponse.json(
        { success: false, error: 'receiving_log_id válido es requerido.' },
        { status: 422 }
      );
    }

    if (quantity_consumed === undefined || quantity_consumed === null || Number(quantity_consumed) <= 0) {
      return NextResponse.json(
        { success: false, error: 'quantity_consumed debe ser un número positivo.' },
        { status: 422 }
      );
    }

    const finalQty = Number(quantity_consumed);

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Verificar evento existe
      const eventResult = await client.query(
        'SELECT id, client_name, event_date FROM events WHERE id = $1',
        [eventId]
      );
      if (eventResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Evento no encontrado.' },
          { status: 404 }
        );
      }

      // 2. Verificar receiving_log existe
      const receivingResult = await client.query(
        `SELECT rl.*, i.name AS ingredient_name
         FROM receiving_log rl
         JOIN ingredients i ON i.id = rl.ingredient_id
         WHERE rl.id = $1`,
        [receiving_log_id]
      );
      if (receivingResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { success: false, error: 'Registro de recepción (lote) no encontrado.' },
          { status: 404 }
        );
      }

      const receivingRecord = receivingResult.rows[0];
      const finalUnit = unit || receivingRecord.unit || 'g';

      // 3. Insertar lot_consumption
      const consumptionResult = await client.query(
        `INSERT INTO lot_consumption (receiving_log_id, event_id, quantity_consumed, unit)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [receiving_log_id, eventId, finalQty, finalUnit]
      );
      const consumptionRecord = consumptionResult.rows[0];

      // 4. G6: deducir el stock CANÓNICO (ingredients.quantity) — antes esto
      // solo tocaba `inventory.quantity` (bug real confirmado), invisible
      // para escandallo/stockDeduct/inventory_commitments.
      const adj = await adjustIngredientStock(client, {
        ingredientId: receivingRecord.ingredient_id,
        delta: -finalQty,
        reason: 'operativo',
        movementType: 'consumption',
        eventId,
        referenceType: 'event',
        referenceId: eventId,
        notes: `Consumo para evento ${eventResult.rows[0].client_name} - ${receivingRecord.ingredient_name}`,
      });
      const invRecord = {
        ingredient_id: receivingRecord.ingredient_id,
        quantity: adj.newQty,
        unit: adj.unit,
      };

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        data: {
          consumption: consumptionRecord,
          inventory: invRecord,
        },
      }, { status: 201 });
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