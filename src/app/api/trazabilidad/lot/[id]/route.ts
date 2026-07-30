/**
 * EventFlow — API de trazabilidad: Lote individual
 * GET /api/trazabilidad/lot/[id] — Trazabilidad completa de un lote
 *
 * Dado un ID de receiving_log (lote), devuelve:
 *   - Datos del lote: proveedor, ingrediente, lote, caducidad, temperatura, etc.
 *   - Todos los eventos que consumieron de este lote (vía lot_consumption)
 *   - Resumen de cantidades: total recibido, total consumido, restante
 */

import { NextRequest, NextResponse } from 'next/server';
import { querySingle, queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: lotId } = params;

    if (!UUID_REGEX.test(lotId)) {
      return NextResponse.json(
        { success: false, error: 'ID de lote inválido.' },
        { status: 422 }
      );
    }

    // 1. Obtener datos del lote (receiving_log)
    const lot = await querySingle<any>(
      `SELECT
         rl.id,
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
         i.id AS ingredient_id,
         i.name AS ingredient_name,
         i.category AS ingredient_category,
         i.unit AS ingredient_unit,
         so.id AS supplier_order_id,
         so.status AS order_status
       FROM receiving_log rl
       JOIN ingredients i ON i.id = rl.ingredient_id
       LEFT JOIN supplier_orders so ON so.id = rl.supplier_order_id
       WHERE rl.id = $1`,
      [lotId]
    );

    if (!lot) {
      return NextResponse.json(
        { success: false, error: 'Lote no encontrado.' },
        { status: 404 }
      );
    }

    // 2. Obtener todos los eventos que consumieron de este lote
    const consumptions = await queryMany<any>(
      `SELECT
         lc.id AS consumption_id,
         lc.quantity_consumed,
         lc.unit AS consumption_unit,
         lc.consumed_at,
         e.id AS event_id,
         e.client_name,
         e.event_date,
         e.event_type,
         e.guest_count,
         e.status AS event_status,
         e.venue_type
       FROM lot_consumption lc
       JOIN events e ON e.id = lc.event_id
       WHERE lc.receiving_log_id = $1
       ORDER BY lc.consumed_at DESC`,
      [lotId]
    );

    // 3. Calcular resumen de cantidades
    const totalConsumed = consumptions.reduce(
      (sum, c) => sum + Number(c.quantity_consumed),
      0
    );
    const batchQty = Number(lot.batch_quantity);
    const remaining = Math.max(0, batchQty - totalConsumed);

    // 4. Calcular alertas
    const tempAlert = lot.temperature !== null && Number(lot.temperature) > 8;
    const expiryDate = lot.expiry_date ? new Date(lot.expiry_date) : null;
    const now = new Date();
    const expiryAlert = expiryDate !== null && expiryDate < now;
    const expiryWarning = expiryDate !== null &&
      expiryDate > now &&
      (expiryDate.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7 días

    return NextResponse.json({
      success: true,
      data: {
        lot: {
          id: lot.id,
          lot_number: lot.lot_number,
          batch_quantity: batchQty,
          unit: lot.unit,
          received_date: lot.received_date,
          received_by: lot.received_by,
          expiry_date: lot.expiry_date,
          temperature: lot.temperature !== null ? Number(lot.temperature) : null,
          supplier: lot.supplier,
          condition_ok: lot.condition_ok,
          source: lot.source,
          qr_code: lot.qr_code,
          notes: lot.notes,
          created_at: lot.created_at,
          ingredient: {
            id: lot.ingredient_id,
            name: lot.ingredient_name,
            category: lot.ingredient_category,
            unit: lot.ingredient_unit,
          },
          supplier_order: lot.supplier_order_id ? {
            id: lot.supplier_order_id,
            status: lot.order_status,
          } : null,
        },
        summary: {
          total_received: batchQty,
          total_consumed: totalConsumed,
          remaining: remaining,
          consumption_count: consumptions.length,
          unit: lot.unit,
        },
        alerts: {
          temperature: tempAlert
            ? `Temperatura ${lot.temperature}°C > 8°C (fuera de rango)`
            : null,
          expiry: expiryAlert
            ? 'Lote caducado'
            : expiryWarning
            ? `Caducidad próxima (${lot.expiry_date})`
            : null,
        },
        consumptions: consumptions.map((c) => ({
          consumption_id: c.consumption_id,
          quantity_consumed: Number(c.quantity_consumed),
          unit: c.consumption_unit,
          consumed_at: c.consumed_at,
          event: {
            id: c.event_id,
            client_name: c.client_name,
            event_date: c.event_date,
            event_type: c.event_type,
            guest_count: c.guest_count,
            status: c.event_status,
            venue_type: c.venue_type,
          },
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
