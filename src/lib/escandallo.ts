/**
 * EventFlow — Escandallo teórico vs real (versionado)  ·  FR-C01 / FR-C03
 *
 * Fuente ÚNICA del cálculo del escandallo de un evento. No crea un sistema
 * paralelo: opera sobre `event_shopping_items` (las líneas del escandallo del
 * evento) + `ingredients` (coste unitario actual) y persiste el cierre en
 * `event_cost_deviations`.
 *
 * Vistas (FR-C01):
 *   - TEÓRICO: cantidades estándar escaladas por comensales (theoretical_qty).
 *   - REAL:    consumo registrado el día del evento (actual_quantity).
 * Coste (FR-C03):
 *   - estimado = Σ (qty_teórica × coste_actual_del_ingrediente)
 *   - real     = Σ (qty_real    × coste)        [si no se registró, = teórico]
 *   - desviación = real − estimado  (€ y %)
 *
 * Estado del escandallo:
 *   borrador  → el evento aún no está aceptado (no hay compromiso)
 *   activo    → aceptado, editable, recalculable
 *   cerrado   → congelado al cerrar el evento (snapshot inmutable)
 */
import { query } from '@/lib/db';
import { computeEscandalloCost, classifyIngredient } from '@/domain/escandallo';
import type { EscandalloCategory } from '@/domain/escandallo';

export type EscandalloEstado = 'borrador' | 'activo' | 'cerrado';

export interface EscandalloLinea {
  id: string;
  ingredient_id: string | null;
  ingrediente: string;
  unidad: string | null;
  qty_teorica: number;
  qty_real: number | null;
  coste_unitario: number;
  coste_estimado: number;
  coste_real: number | null;
  desviacion_qty: number;
  desviacion_coste: number;
  congelado: boolean;
  /** Categoría normalizada del plato de origen (food/beverage/other). */
  categoria: EscandalloCategory;
  /** Qty en unidad base del ingrediente (g, ml, ud). WP-01. */
  qty_base: number;
}

export interface EscandalloResumen {
  event_id: string;
  estado: EscandalloEstado;
  version: number;
  congelado: boolean;
  lineas: EscandalloLinea[];
  totales: {
    coste_estimado: number;
    coste_real: number;
    desviacion: number;
    desviacion_pct: number;
    /** Coste total de ingredientes de comida. */
    food_cost: number;
    /** Coste total: ingredientes bebida + barra libre. */
    beverage_cost: number;
    /** Coste barra libre = bar_price × bar_hours. */
    bar_service_cost: number;
    /** Coste por comensal = total / pax. */
    cost_per_pax: number;
  };
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Cálculo PURO de coste de una línea de escandallo (FR-C03, testeable).
 *   estimado = qty_teórica × coste_unitario
 *   real     = qty_real × coste_unitario   (null si no se registró consumo)
 *   desviación = (real ?? estimado) − estimado
 */
export function lineCost(qtyTeorica: number, qtyReal: number | null, costeUnit: number) {
  const qt = Number(qtyTeorica) || 0;
  const cu = Number(costeUnit) || 0;
  const estimado = round2(qt * cu);
  const real = qtyReal != null ? round2((Number(qtyReal) || 0) * cu) : null;
  return {
    estimado,
    real,
    desviacion_coste: round2((real != null ? real : estimado) - estimado),
    desviacion_qty: round2((qtyReal != null ? Number(qtyReal) : qt) - qt),
  };
}

/** Calcula el escandallo teórico↔real de un evento (lectura). */
export async function computeEscandallo(eventId: string): Promise<EscandalloResumen | null> {
  const ev = (await query(
    `SELECT id, status, guest_count, COALESCE(bar_price, 0) AS bar_price, COALESCE(bar_hours, 0) AS bar_hours
     FROM events WHERE id = $1`,
    [eventId]
  )).rows?.[0] as any;
  if (!ev) return null;

  const pax = Math.max(1, Number(ev.guest_count) || 1);

  const rows = (await query(
    `SELECT esi.id, esi.ingredient_id, esi.ingredient_name,
            esi.theoretical_qty, esi.theoretical_unit,
            esi.actual_quantity, esi.actual_unit,
            esi.estimated_cost, esi.actual_cost_total,
            esi.recipe_version, esi.frozen, ci.category AS category,
            COALESCE(i.unit_cost, 0) AS unit_cost,
            COALESCE(ri.qty_base, esi.theoretical_qty) AS qty_base
     FROM event_shopping_items esi
     LEFT JOIN ingredients i ON i.id = esi.ingredient_id
     LEFT JOIN recipe_items ri ON ri.id = esi.recipe_item_id
     LEFT JOIN catalog_items ci ON ci.id = ri.catalog_item_id
     WHERE esi.event_id = $1
     ORDER BY esi.ingredient_name ASC`,
    [eventId]
  )).rows as any[];

  const lineas: EscandalloLinea[] = rows.map((r) => {
    const frozen = !!r.frozen;
    const qtyT = Number(r.theoretical_qty) || 0;
    const qtyR = r.actual_quantity != null ? Number(r.actual_quantity) : null;
    const unitCost = Number(r.unit_cost) || 0;
    const qtyBase = Number(r.qty_base) || qtyT;
    const dishCategory = r.category || null;
    const categoria = classifyIngredient(dishCategory);

    // WP-05: coste = qty_base × pax × coste_unitario_base
    const costeEstimadoCalc = round2(qtyBase * pax * unitCost);

    // Congelado → snapshot inmutable. Activo → cálculo vivo (propaga precios, FR-C04).
    const c = frozen
      ? {
          estimado: round2(r.estimated_cost),
          real: round2(r.actual_cost_total),
          desviacion_coste: round2(Number(r.actual_cost_total) - Number(r.estimated_cost)),
          desviacion_qty: round2((qtyR != null ? qtyR : qtyT) - qtyT),
        }
      : {
          estimado: costeEstimadoCalc,
          real: qtyR != null ? round2(qtyBase * pax * unitCost) : null,
          desviacion_coste: 0,
          desviacion_qty: round2((qtyR != null ? qtyR : qtyT) - qtyT),
        };

    // Si no hay coste vivo del ingrediente, caer al estimado almacenado.
    const estimado = unitCost > 0 ? c.estimado : round2(r.estimated_cost);

    return {
      id: r.id,
      ingredient_id: r.ingredient_id || null,
      ingrediente: r.ingredient_name,
      unidad: r.theoretical_unit || r.actual_unit || null,
      qty_teorica: qtyT,
      qty_real: qtyR,
      coste_unitario: unitCost,
      coste_estimado: estimado,
      coste_real: c.real,
      desviacion_qty: c.desviacion_qty,
      desviacion_coste: c.desviacion_coste,
      congelado: frozen,
      categoria,
      qty_base: qtyBase,
    };
  });

  const costeEstimado = round2(lineas.reduce((s, l) => s + l.coste_estimado, 0));
  // Para el total real, asumimos teórico donde aún no hay consumo registrado.
  const costeReal = round2(lineas.reduce((s, l) => s + (l.coste_real != null ? l.coste_real : l.coste_estimado), 0));
  const desviacion = round2(costeReal - costeEstimado);

  const congelado = lineas.some((l) => l.congelado);
  const aceptado = ['accepted', 'aceptado', 'in_progress', 'en_curso', 'completed', 'completado', 'paid', 'pagado'].includes(ev.status);
  const estado: EscandalloEstado = congelado ? 'cerrado' : aceptado && lineas.length > 0 ? 'activo' : 'borrador';
  const version = Math.max(1, ...rows.map((r) => Number(r.recipe_version) || 1));

  // WP-05: desglose food/beverage vía función pura del dominio
  const costBreakdown = computeEscandalloCost(
    rows.map((r) => ({
      qty_base: Number(r.qty_base) || Number(r.theoretical_qty) || 0,
      unit_cost: Number(r.unit_cost) || 0,
      dish_category: r.category || null,
    })),
    pax,
    Number(ev.bar_price) || 0,
    Number(ev.bar_hours) || 0
  );

  return {
    event_id: eventId,
    estado,
    version,
    congelado,
    lineas,
    totales: {
      coste_estimado: costeEstimado,
      coste_real: costeReal,
      desviacion,
      desviacion_pct: costeEstimado > 0 ? round2((desviacion / costeEstimado) * 100) : 0,
      food_cost: costBreakdown.food_cost,
      beverage_cost: costBreakdown.beverage_cost,
      bar_service_cost: costBreakdown.bar_service_cost,
      cost_per_pax: costBreakdown.cost_per_pax,
    },
  };
}

/**
 * Registra el consumo REAL de líneas del escandallo (solo si no está congelado).
 * Recalcula coste real y desviación por línea con el coste actual del ingrediente.
 */
export async function recordActuals(
  eventId: string,
  items: Array<{ id: string; actual_quantity: number; actual_unit?: string }>
): Promise<number> {
  let updated = 0;
  for (const it of items) {
    if (!it.id || it.actual_quantity == null) continue;
    const res = await query(
      `UPDATE event_shopping_items esi
       SET actual_quantity = $3,
           actual_unit = COALESCE($4, theoretical_unit, actual_unit),
           actual_cost_total = ROUND($3 * COALESCE(
             (SELECT unit_cost FROM ingredients WHERE id = esi.ingredient_id), 0), 2),
           deviation_qty = $3 - COALESCE(theoretical_qty, 0),
           deviation_cost = ROUND($3 * COALESCE(
             (SELECT unit_cost FROM ingredients WHERE id = esi.ingredient_id), 0), 2) - COALESCE(estimated_cost, 0),
           updated_at = now()
       WHERE id = $1 AND event_id = $2 AND frozen = false
       RETURNING id`,
      [it.id, eventId, it.actual_quantity, it.actual_unit ?? null]
    );
    if (res.rows?.[0]) updated++;
  }
  return updated;
}

/**
 * Congela el escandallo (cierre del evento, FR-C01): fija el consumo real
 * (= teórico si no se registró), calcula la desviación por línea y persiste el
 * snapshot de totales en `event_cost_deviations`. Idempotente.
 */
export async function freezeEscandallo(eventId: string): Promise<{ estimado: number; real: number; desviacion: number }> {
  // 1. Consolidar real := teórico donde no se registró; congelar líneas.
  await query(
    `UPDATE event_shopping_items
     SET actual_quantity   = COALESCE(actual_quantity, theoretical_qty),
         actual_unit       = COALESCE(actual_unit, theoretical_unit),
         actual_cost_total = COALESCE(NULLIF(actual_cost_total, 0), estimated_cost, 0),
         deviation_qty     = COALESCE(actual_quantity, theoretical_qty) - COALESCE(theoretical_qty, 0),
         deviation_cost    = COALESCE(NULLIF(actual_cost_total, 0), estimated_cost, 0) - COALESCE(estimated_cost, 0),
         frozen            = true,
         frozen_at         = COALESCE(frozen_at, now())
     WHERE event_id = $1`,
    [eventId]
  );

  // 2. Snapshot de totales (columnas canónicas de event_cost_deviations).
  const t = (await query(
    `SELECT COALESCE(SUM(estimated_cost), 0)    AS est,
            COALESCE(SUM(actual_cost_total), 0) AS act
     FROM event_shopping_items WHERE event_id = $1`,
    [eventId]
  )).rows[0] as any;
  const est = round2(t?.est);
  const act = round2(t?.act);
  const dev = round2(act - est);
  // deviation_pct es NUMERIC(5,2): clamp a ±999.99 para no desbordar y romper el cierre.
  const pct = est > 0 ? Math.max(-999.99, Math.min(999.99, round2((dev / est) * 100))) : 0;

  await query(
    `INSERT INTO event_cost_deviations
       (event_id, estimated_total_cost, actual_total_cost, deviation_amount, deviation_pct, closed_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (event_id) DO UPDATE
       SET estimated_total_cost = EXCLUDED.estimated_total_cost,
           actual_total_cost    = EXCLUDED.actual_total_cost,
           deviation_amount     = EXCLUDED.deviation_amount,
           deviation_pct        = EXCLUDED.deviation_pct,
           closed_at            = now()`,
    [eventId, est, act, dev, pct]
  );

  return { estimado: est, real: act, desviacion: dev };
}
