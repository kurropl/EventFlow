/**
 * GET /api/hoja-operacion/[eventId] — Hoja de Operación del evento
 *
 * Devuelve todos los datos necesarios para una hoja imprimible:
 * - Datos del evento
 * - Recetas y escandallo
 * - Personal asignado
 * - Cronograma (event_plans)
 * - Checklist
 * - Mapa resumen (event_floorplans)
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const { eventId } = params;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    // 1. Evento
    const eventResult = await query(
      `SELECT e.*, q.total as quote_total, q.items as quote_items,
              (SELECT jsonb_agg(jsonb_build_object('concept', p.concept, 'amount', p.amount, 'paid', p.paid, 'due_date', p.due_date)) FROM payments p WHERE p.event_id = e.id) as payments
       FROM events e
       LEFT JOIN quotes q ON q.id = e.quote_id
       WHERE e.id = $1`,
      [eventId]
    );
    if (!eventResult.rows?.[0]) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }
    const eventData = eventResult.rows[0] as any;

    // 2. Orden asociada
    const orderResult = await query(
      `SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`,
      [eventId]
    );

    // 3. Escandallo (items de compra del evento)
    const escandalloResult = await query(
      `SELECT esi.*, i.name as ingredient_name
       FROM event_shopping_items esi
       LEFT JOIN ingredients i ON i.id = esi.ingredient_id
       WHERE esi.event_id = $1
       ORDER BY esi.ingredient_name ASC`,
      [eventId]
    );

    // 4. Plan de operaciones (cronograma)
    const plansResult = await query(
      `SELECT * FROM event_plans WHERE event_id = $1 ORDER BY sort_order ASC, planned_time ASC`,
      [eventId]
    );

    // 5. Checklist tasks
    const checklistResult = await query(
      `SELECT * FROM checklist_tasks WHERE event_id = $1 ORDER BY sort_order ASC`,
      [eventId]
    );

    // 6. Personal asignado (staffing)
    const staffingResult = await query(
      `SELECT sa.*, w.name as worker_name, w.role
       FROM staffing_assignments sa
       LEFT JOIN workers w ON w.id = sa.worker_id
       WHERE sa.event_id = $1
       ORDER BY w.role, w.name`,
      [eventId]
    );

    // 7. Desglose de costes
    const costResult = await query(
      `SELECT line_type, SUM(total) as total
       FROM cost_desglose WHERE event_id = $1
       GROUP BY line_type ORDER BY total DESC`,
      [eventId]
    );

    // 8. Recetas del evento (desde catálogo)
    const recipesResult = await query(
      `SELECT r.id, r.name, r.category, r.servings, r.version, r.published,
              r.prep_time, r.cook_time, r.difficulty
       FROM recipes r
       JOIN catalog_items ci ON ci.id = r.catalog_item_id
       JOIN event_menu_items emi ON emi.catalog_item_id = ci.id
       WHERE emi.event_id = $1 AND r.active = true
       ORDER BY r.category, r.name`,
      [eventId]
    );

    // 9. Mapa de mesas
    const floorplanResult = await query(
      `SELECT * FROM event_floorplans WHERE event_id = $1 LIMIT 1`,
      [eventId]
    );

    // 10. Alertas APPCC relacionadas
    const appccResult = await query(
      `SELECT ft.id, ft.fridge_name, ft.temperature, ft.status, ft.recorded_at
       FROM fridge_temperature_log ft
       WHERE ft.event_id = $1
       ORDER BY ft.recorded_at DESC LIMIT 5`,
      [eventId]
    );

    // 11. Trazabilidad
    const traceResult = await query(
      `SELECT tl.id, tl.lot_number, i.name as ingredient_name, tl.quantity_used, tl.unit, tl.used_at, tl.used_by
       FROM traceability_log tl
       LEFT JOIN ingredients i ON i.id = tl.ingredient_id
       WHERE tl.event_id = $1
       ORDER BY tl.used_at DESC LIMIT 20`,
      [eventId]
    );

    // Totales
    const totalPayments = await query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE paid = true) as paid,
              COALESCE(SUM(amount), 0) as total_amount, COALESCE(SUM(amount) FILTER (WHERE paid = true), 0) as paid_amount
       FROM payments WHERE event_id = $1`,
      [eventId]
    );

    return NextResponse.json({
      success: true,
      data: {
        event: eventData,
        order: orderResult.rows?.[0] || null,
        escandallo: escandalloResult.rows || [],
        plans: plansResult.rows || [],
        checklist: checklistResult.rows || [],
        staffing: staffingResult.rows || [],
        costs: costResult.rows || [],
        recipes: recipesResult.rows || [],
        floorplan: floorplanResult.rows?.[0] || null,
        appcc: appccResult.rows || [],
        traceability: traceResult.rows || [],
        payments: {
          total: Number((totalPayments.rows[0] as any)?.total || 0),
          paid: Number((totalPayments.rows[0] as any)?.paid || 0),
          totalAmount: Number((totalPayments.rows[0] as any)?.total_amount || 0),
          paidAmount: Number((totalPayments.rows[0] as any)?.paid_amount || 0),
        },
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}