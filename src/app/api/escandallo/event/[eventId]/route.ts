/**
 * EventFlow — API de escandallo del evento
 * GET /api/escandallo/event/[eventId] — Devuelve teórico + real + desviación
 * PUT /api/escandallo/event/[eventId] — Actualiza consumo real
 * POST /api/escandallo/event/[eventId]/freeze — Congela escandallo
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, querySingle, queryMany } from '@/lib/db';
import { recalcEventEscandallo, freezeEventEscandallo, checkMarginAlerts } from '@/lib/recalcEscandallo';
import { sanitizeError } from '@/lib/security';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── GET: Obtener escandallo completo del evento ──

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const eventId = params.eventId;
    if (!UUID_REGEX.test(eventId)) {
      return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 422 });
    }

    const pool = getPool();
    const event = await querySingle<any>('SELECT * FROM events WHERE id = $1', [eventId]);
    if (!event) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado.' }, { status: 404 });
    }

    // Escandallo teórico (no congelado)
    const theoretical = await queryMany<any>(
      `SELECT esi.id AS item_id, esi.ingredient_name,
              esi.theoretical_qty, esi.theoretical_unit,
              esi.estimated_cost, i.unit_cost,
              esi.actual_quantity, esi.actual_unit,
              ri.quantity AS recipe_qty,
              ci.name AS catalog_item_name
       FROM event_shopping_items esi
       LEFT JOIN ingredients i ON i.id = esi.ingredient_id
       LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
       LEFT JOIN catalog_items ci ON ci.id = ri.catalog_item_id
       WHERE esi.event_id = $1
       ORDER BY esi.created_at, ci.name`,
      [eventId]
    );

    // Desviación (calculada en tiempo real)
    const deviations = theoretical.map((item: any) => ({
      ...item,
      deviation_qty: (Number(item.actual_quantity || 0) - Number(item.theoretical_qty || 0)).toFixed(2),
      deviation_cost: (Number(item.actual_quantity || 0) - Number(item.theoretical_qty || 0)) * Number(item.unit_cost || 0),
    }));

    // Alertas de margen (si alguna tiene margen < 15%)
    const alerts = await checkMarginAlerts(eventId);

    return NextResponse.json({
      success: true,
      data: {
        theoretical,
        deviation: deviations,
        alerts,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ── PUT: Registrar consumo real ──

export async function PUT(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const eventId = params.eventId;
    const body = await request.json();
    const { itemId, actualQty, actualUnit, actualCost } = body;

    const pool = getPool();
    await pool.query(
      `UPDATE event_shopping_items
       SET actual_quantity = $1,
           actual_unit = $2,
           actual_cost_total = $3,
           actual_cost_new = $3
       WHERE id = $4 AND event_id = $5`,
      [actualQty, actualUnit, actualCost, itemId, eventId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

// ── POST /freeze: Congelar y calcular desviación ──

export async function POST(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const eventId = params.eventId;
    const result = await freezeEventEscandallo(eventId);

    return NextResponse.json({
      success: true,
      data: {
        deviation_amount: result.deviationAmount,
        deviation_pct: result.deviationPct,
        estimated_total: result.estimatedTotal,
        actual_total: result.actualTotal,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}