/**
 * EventFlow — API de trazabilidad: Informe APPCC
 * GET /api/trazabilidad/trace/[eventId] — Informe completo APPCC
 *
 * Devuelve por cada plato/ingrediente del evento los lotes consumidos
 * con proveedor, caducidad, temperatura y cantidad.
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      `SELECT id, client_name, event_date, event_type, guest_count, status
       FROM events WHERE id = $1`,
      [eventId]
    );
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Evento no encontrado.' },
        { status: 404 }
      );
    }

    // Obtener trazabilidad: plato/ingrediente → lote → proveedor
    // Se basa en event_shopping_items (platos/ingredientes del evento)
    // y se vincula con lotes consumidos a través de receiving_log
    const traceItems = await queryMany<any>(
      `SELECT
         esi.id AS shopping_item_id,
         esi.ingredient_name,
         esi.provider_name AS shopping_provider,
         esi.total_grams,
         esi.total_units,
         esi.total_ml,
         esi.actual_cost,
         esi.unit_dimension,
         esi.completed,
         lc.id AS consumption_id,
         lc.quantity_consumed,
         lc.unit AS consumption_unit,
         lc.consumed_at,
         rl.lot_number,
         rl.batch_quantity,
         rl.unit AS receiving_unit,
         rl.received_date,
         rl.expiry_date,
         rl.temperature,
         rl.supplier,
         rl.condition_ok,
         rl.qr_code,
         rl.notes AS receiving_notes
       FROM event_shopping_items esi
       LEFT JOIN lot_consumption lc ON lc.event_id = esi.event_id
       LEFT JOIN receiving_log rl ON rl.id = lc.receiving_log_id
         AND (rl.ingredient_id = esi.ingredient_id OR esi.ingredient_id IS NULL)
       WHERE esi.event_id = $1
       ORDER BY esi.ingredient_name, lc.consumed_at DESC`,
      [eventId]
    );

    // Obtener también lotes disponibles (recibidos, no necesariamente consumidos en este evento)
    // que corresponden a ingredientes del evento
    const availableLots = await queryMany<any>(
      `SELECT DISTINCT
         rl.id AS receiving_log_id,
         rl.lot_number,
         rl.batch_quantity,
         rl.unit,
         rl.received_date,
         rl.expiry_date,
         rl.temperature,
         rl.supplier,
         rl.condition_ok,
         i.id AS ingredient_id,
         i.name AS ingredient_name,
         CASE WHEN rl.temperature IS NOT NULL AND rl.temperature > 8 THEN true ELSE false END AS temp_alert
       FROM receiving_log rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       WHERE rl.ingredient_id IN (
         SELECT ingredient_id FROM event_shopping_items WHERE event_id = $1 AND ingredient_id IS NOT NULL
       )
       ORDER BY rl.received_date DESC`,
      [eventId]
    );

    // Calcular alertas de temperatura
    const tempAlerts = traceItems.filter(
      (item: any) => item.temperature !== null && Number(item.temperature) > 8
    );

    return NextResponse.json({
      success: true,
      data: {
        event: {
          id: event.id,
          client_name: event.client_name,
          event_date: event.event_date,
          event_type: event.event_type,
          guest_count: event.guest_count,
          status: event.status,
        },
        trace: traceItems.map((item: any) => ({
          ...item,
          total_grams: item.total_grams !== null ? Number(item.total_grams) : null,
          total_units: item.total_units !== null ? Number(item.total_units) : null,
          total_ml: item.total_ml !== null ? Number(item.total_ml) : null,
          batch_quantity: item.batch_quantity !== null ? Number(item.batch_quantity) : null,
          quantity_consumed: item.quantity_consumed !== null ? Number(item.quantity_consumed) : null,
          temperature: item.temperature !== null ? Number(item.temperature) : null,
          temp_alert: item.temperature !== null && Number(item.temperature) > 8,
        })),
        available_lots: availableLots.map((lot: any) => ({
          ...lot,
          batch_quantity: Number(lot.batch_quantity),
          temperature: lot.temperature !== null ? Number(lot.temperature) : null,
        })),
        alerts: {
          temperature: tempAlerts.length > 0
            ? `${tempAlerts.length} lote(s) con temperatura > 8°C`
            : null,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}