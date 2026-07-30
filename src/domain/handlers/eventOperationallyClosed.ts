/**
 * EventFlow — Handler: event.operationally_closed
 *
 * Se activa cuando un evento pasa a estado 'cerrado_operativo' (OPC-3 u OPC-4).
 * Calcula el cierre económico y persiste los datos en event_financial_closures.
 *
 * Fuentes de datos:
 * - food_cost: escandallo (event_shopping_items) — previsto (estimated_cost) y real (actual_cost_total)
 * - staff_cost: worker_event_pay — previsto (total de turnos planificados) y real (nóminas aprobadas)
 * - extras_revenue: event_extras (WP-29) — sum of price_snapshot × qty
 * - total_revenue: events.total_pvp
 *
 * El cierre económico NO congela la fila (frozen=false) hasta que el Gerente
 * ejecute la transición OPC-5 (cerrado_operativo → cerrado_contable).
 */

import { getPool } from '@/lib/db';
import type { DomainEvent } from '../events';

// ============================================================
// Types
// ============================================================

export interface EventOperationallyClosedPayload {
  event_id: string;
}

export interface FinancialClosureData {
  event_id: string;
  planned_food_cost: number;
  real_food_cost: number;
  planned_staff_cost: number;
  real_staff_cost: number;
  extras_revenue: number;
  total_revenue: number;
  real_margin_pct: number;
}

// ============================================================
// Helpers
// ============================================================

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Calcula los datos del cierre económico para un evento.
 */
async function computeFinancialClosure(client: any, eventId: string): Promise<FinancialClosureData> {
  // 1. Datos del evento
  const eventResult = await client.query(
    `SELECT id, guest_count, total_pvp, bar_price, bar_hours
     FROM events WHERE id = $1`,
    [eventId]
  );
  const event = eventResult.rows[0];
  if (!event) throw new Error(`Event not found: ${eventId}`);

  const pax = Math.max(1, Number(event.guest_count) || 1);
  const totalRevenue = Number(event.total_pvp) || 0;

  // 2. Coste de comida (escandallo)
  // Previsto: Σ estimated_cost de event_shopping_items
  // Real: Σ actual_cost_total (si existe), sino estimated_cost
  const foodCostResult = await client.query(
    `SELECT 
       COALESCE(SUM(estimated_cost), 0) AS planned_food_cost,
       COALESCE(SUM(COALESCE(NULLIF(actual_cost_total, 0), estimated_cost, 0)), 0) AS real_food_cost
     FROM event_shopping_items
     WHERE event_id = $1`,
    [eventId]
  );
  const foodCost = foodCostResult.rows[0] || {};
  const plannedFoodCost = round2(Number(foodCost.planned_food_cost) || 0);
  const realFoodCost = round2(Number(foodCost.real_food_cost) || 0);

  // 3. Coste de personal
  // Previsto: Σ total_pay de turnos asignados (worker_event_pay) — estimación
  // Real: Σ total_pay WHERE status = 'paid' (nóminas aprobadas)
  const staffCostResult = await client.query(
    `SELECT 
       COALESCE(SUM(total_pay), 0) AS planned_staff_cost,
       COALESCE(SUM(total_pay) FILTER (WHERE status = 'paid'), 0) AS real_staff_cost
     FROM worker_event_pay
     WHERE event_id = $1`,
    [eventId]
  );
  const staffCost = staffCostResult.rows[0] || {};
  const plannedStaffCost = round2(Number(staffCost.planned_staff_cost) || 0);
  const realStaffCost = round2(Number(staffCost.real_staff_cost) || 0);

  // 4. Ingresos por extras (WP-29: event_extras)
  // Si la tabla no existe aún, retornar 0
  let extrasRevenue = 0;
  try {
    const extrasResult = await client.query(
      `SELECT COALESCE(SUM(price_snapshot * qty), 0) AS extras_revenue
       FROM event_extras
       WHERE event_id = $1`,
      [eventId]
    );
    extrasRevenue = round2(Number(extrasResult.rows[0]?.extras_revenue) || 0);
  } catch {
    // event_extras table might not exist yet (WP-29)
    console.log('[eventOperationallyClosed] event_extras table not found, extras_revenue = 0');
  }

  // 5. Margen real
  // margen = (total_revenue - real_food_cost - real_staff_cost) / total_revenue * 100
  const totalCost = realFoodCost + realStaffCost;
  const realMarginPct = totalRevenue > 0
    ? round2(((totalRevenue - totalCost) / totalRevenue) * 100)
    : 0;

  return {
    event_id: eventId,
    planned_food_cost: plannedFoodCost,
    real_food_cost: realFoodCost,
    planned_staff_cost: plannedStaffCost,
    real_staff_cost: realStaffCost,
    extras_revenue: extrasRevenue,
    total_revenue: totalRevenue,
    real_margin_pct: realMarginPct,
  };
}

// ============================================================
// Handler principal
// ============================================================

export async function handleEventOperationallyClosed(event: DomainEvent): Promise<void> {
  const payload = event.payload as unknown as EventOperationallyClosedPayload;
  const { event_id } = payload;

  console.log(`[Handler] event.operationally_closed para evento ${event_id}`);

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Verificar idempotencia: si ya existe un cierre congelado, no sobreescribir
    const existing = await client.query(
      `SELECT id, frozen FROM event_financial_closures WHERE event_id = $1`,
      [event_id]
    );

    if (existing.rows[0]?.frozen) {
      console.log(`[Handler] Evento ${event_id} ya tiene cierre contable congelado. Saltando (idempotente).`);
      await client.query('ROLLBACK');
      return;
    }

    // 2. Calcular datos del cierre económico
    const closureData = await computeFinancialClosure(client, event_id);

    // 3. Insertar o actualizar el cierre económico
    await client.query(
      `INSERT INTO event_financial_closures (
        event_id, planned_food_cost, real_food_cost,
        planned_staff_cost, real_staff_cost,
        extras_revenue, total_revenue, real_margin_pct,
        frozen, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, now(), now())
      ON CONFLICT (event_id) DO UPDATE
        SET planned_food_cost = EXCLUDED.planned_food_cost,
            real_food_cost = EXCLUDED.real_food_cost,
            planned_staff_cost = EXCLUDED.planned_staff_cost,
            real_staff_cost = EXCLUDED.real_staff_cost,
            extras_revenue = EXCLUDED.extras_revenue,
            total_revenue = EXCLUDED.total_revenue,
            real_margin_pct = EXCLUDED.real_margin_pct,
            updated_at = now()`,
      [
        event_id,
        closureData.planned_food_cost,
        closureData.real_food_cost,
        closureData.planned_staff_cost,
        closureData.real_staff_cost,
        closureData.extras_revenue,
        closureData.total_revenue,
        closureData.real_margin_pct,
      ]
    );

    await client.query('COMMIT');

    console.log(`[Handler] Cierre económico calculado para evento ${event_id}:`);
    console.log(`  - Food cost: ${closureData.planned_food_cost}€ (previsto) → ${closureData.real_food_cost}€ (real)`);
    console.log(`  - Staff cost: ${closureData.planned_staff_cost}€ (previsto) → ${closureData.real_staff_cost}€ (real)`);
    console.log(`  - Extras revenue: ${closureData.extras_revenue}€`);
    console.log(`  - Total revenue: ${closureData.total_revenue}€`);
    console.log(`  - Margin: ${closureData.real_margin_pct}%`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Handler] Error en event.operationally_closed para evento ${event_id}:`, error);
    throw error;
  } finally {
    client.release();
  }
}
