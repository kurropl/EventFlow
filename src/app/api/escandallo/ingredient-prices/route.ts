/**
 * EventFlow — API de propagación de precios de ingredientes
 * PUT /api/escandallo/ingredient-prices
 * 
 * Cuando cambia el precio de un ingrediente, se propaga a todos
 * los escandallos que lo usan y se registra en el historial.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, querySingle, queryMany } from '@/lib/db';
import { recalcEventEscandallo, freezeEventEscandallo, checkMarginAlerts, propagatePriceToAllEvents } from '@/lib/recalcEscandallo';
import { sanitizeError } from '@/lib/security';

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { ingredientId, newPrice } = body;

    if (!ingredientId || newPrice === undefined) {
      return NextResponse.json(
        { success: false, error: 'Se requiere ingredientId y newPrice.' },
        { status: 400 }
      );
    }

    // Obtener precio actual
    const ing = await querySingle<any>(
      'SELECT id, unit_cost, name FROM ingredients WHERE id = $1',
      [ingredientId]
    );
    if (!ing) {
      return NextResponse.json({ success: false, error: 'Ingrediente no encontrado.' }, { status: 404 });
    }

    const oldPrice = Number(ing.unit_cost);
    const newPriceNum = Number(newPrice);

    // Registrar en historial
    await querySingle(
      `INSERT INTO ingredient_price_history (ingredient_id, old_price, new_price, changed_by)
       VALUES ($1, $2, $3, 'manual')
       RETURNING id`,
      [ingredientId, oldPrice, newPriceNum]
    );

    // Actualizar precio en ingredients
    await querySingle(
      'UPDATE ingredients SET unit_cost = $1 WHERE id = $2 RETURNING id',
      [newPriceNum, ingredientId]
    );

    // Propagar a todos los eventos afectados
    const affectedEvents = await propagatePriceToAllEvents(ingredientId, oldPrice, newPriceNum);

    // Verificar alertas de margen para cada evento
    const pool = getPool();
    const events = await pool.query(
      'SELECT DISTINCT event_id FROM event_shopping_items WHERE ingredient_id = $1 AND frozen = false',
      [ingredientId]
    );

    const alerts: any[] = [];
    for (const row of events.rows) {
      await recalcEventEscandallo(row.event_id, undefined);
      const eventAlerts = await checkMarginAlerts(row.event_id);
      alerts.push(...eventAlerts.map(a => ({ eventId: row.event_id, ...a })));
    }

    return NextResponse.json({
      success: true,
      data: {
        oldPrice,
        newPrice: newPriceNum,
        affectedEvents,
        alerts,
        ingredientName: ing.name,
      },
    });
  } catch (error) {
    console.error('[escandallo prices] Error:', error);
    return NextResponse.json(
      { success: false, error: sanitizeError(error) },
      { status: 500 }
    );
  }
}