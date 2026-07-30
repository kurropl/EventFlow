/**
 * EventFlow — WP-09: API de Retornos de Consumibles
 *
 * Gestiona el retorno de ingredientes no consumidos desde Logística.
 * - POST: Registrar un retorno
 * - GET: Listar retornos de un evento
 * - POST con action=close: Cerrar la vuelta y calcular merma
 */

import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import {
  isValidUUID,
  sanitizeText,
  toSafeFloat,
  securityHeaders,
  sanitizeError,
} from '@/lib/security';
import { recordReturn, closeReturn, getConsumptionSummary } from '@/lib/domain/eventConsumption';

// ── GET: Listar retornos de un evento ─────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('event_id');
    const action = searchParams.get('action');

    // Acción especial: obtener resumen de consumo
    if (action === 'summary' && eventId && isValidUUID(eventId)) {
      const summary = await getConsumptionSummary(eventId);
      return NextResponse.json({ success: true, data: summary }, { headers: securityHeaders() });
    }

    if (!eventId || !isValidUUID(eventId)) {
      return NextResponse.json(
        { success: false, error: 'event_id inválido.' },
        { status: 422, headers: securityHeaders() }
      );
    }

    const rows = await queryMany<any>(
      `SELECT r.*, i.unit as ingredient_unit, i.quantity as current_stock
       FROM event_consumable_returns r
       LEFT JOIN ingredients i ON i.id = r.ingredient_id
       WHERE r.event_id = $1
       ORDER BY r.created_at DESC`,
      [eventId]
    );

    return NextResponse.json({ success: true, data: rows }, { headers: securityHeaders() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}

// ── POST: Registrar retorno o cerrar vuelta ──────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Cerrar vuelta (calcular merma) ────────────────────────────
    if (body.action === 'close' && body.event_id) {
      if (!isValidUUID(body.event_id)) {
        return NextResponse.json(
          { success: false, error: 'event_id inválido.' },
          { status: 422, headers: securityHeaders() }
        );
      }

      const summary = await closeReturn({
        eventId: body.event_id,
        userId: body.user_id || null,
      });

      return NextResponse.json(
        { success: true, data: summary, message: 'Vuelta cerrada. Mermas calculadas y registradas.' },
        { headers: securityHeaders() }
      );
    }

    // ── Registrar retorno individual ──────────────────────────────
    if (!body.event_id || !isValidUUID(body.event_id)) {
      return NextResponse.json(
        { success: false, error: 'event_id inválido.' },
        { status: 422, headers: securityHeaders() }
      );
    }

    if (!body.ingredient_id || !isValidUUID(body.ingredient_id)) {
      return NextResponse.json(
        { success: false, error: 'ingredient_id inválido.' },
        { status: 422, headers: securityHeaders() }
      );
    }

    const quantityReturned = toSafeFloat(body.quantity_returned);
    if (quantityReturned <= 0) {
      return NextResponse.json(
        { success: false, error: 'quantity_returned debe ser mayor que 0.' },
        { status: 422, headers: securityHeaders() }
      );
    }

    // Verificar que el ingrediente existe
    const ingredient = await querySingle<any>(
      `SELECT id, name, unit FROM ingredients WHERE id = $1 AND active = true`,
      [body.ingredient_id]
    );

    if (!ingredient) {
      return NextResponse.json(
        { success: false, error: 'Ingrediente no encontrado.' },
        { status: 404, headers: securityHeaders() }
      );
    }

    const result = await recordReturn({
      eventId: body.event_id,
      ingredientId: body.ingredient_id,
      ingredientName: ingredient.name,
      quantityReturned,
      unit: body.unit || ingredient.unit,
      lotId: body.lot_id || null,
      userId: body.user_id || null,
      notes: sanitizeText(body.notes || '', 500) || null,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          returnId: result.returnId,
          movementId: result.movementResult.movementId,
          newStock: result.movementResult.newQty,
        },
        message: `Retorno registrado. Stock actualizado: ${result.movementResult.newQty} ${ingredient.unit}`,
      },
      { status: 201, headers: securityHeaders() }
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500, headers: securityHeaders() }
    );
  }
}
