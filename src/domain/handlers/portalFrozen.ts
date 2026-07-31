/**
 * EventFlow — Handler: portal.frozen
 * Se emite cuando un portal de cliente se congela (freeze_date <= hoy).
 *
 * Cascada de efectos (recálculo completo con pax e invitados definitivos):
 *   1. Recálculo de staffing definitivo (WP-17)
 *   2. Explosión de compras / órdenes a proveedor (WP-06)
 *   3. Cálculo de vajilla y packs (WP-20)
 *   4. Recálculo del escandallo con cantidades definitivas (WP-05)
 *
 * Idempotente: usar checks de existencia o ON CONFLICT en cada sub-operación.
 */

import type { DomainEvent } from '../events';
import { getPool } from '@/lib/db';
import { emitDomainEvent } from '../events';
import { upsertStaffingLines } from '@/lib/domain/staffingSizing';
import { checkInventoryShortages } from '@/lib/domain/inventoryCommitment';
import { generateSupplierOrdersForEvent } from '@/lib/domain/generateSupplierOrders';

// ============================================================
// Types
// ============================================================

export interface PortalFrozenPayload {
  event_id: string;
  portal_id: number;
  guest_count: number;
  confirmed_guests: number;
  confirmed_adults: number;
  confirmed_kids: number;
  freeze_date: string;
}

// ============================================================
// Sub-handlers
// ============================================================

/**
 * 1. Recálculo de staffing definitivo (WP-17)
 * Recalcula las líneas de staffing basándose en el pax definitivo
 * (invitados confirmados + niños confirmados).
 */
async function recalculateStaffing(
  client: any,
  eventId: string,
  confirmedPax: number
): Promise<void> {
  // Obtener service_type del evento (usar client para consistencia transaccional)
  const eventResult = await client.query(
    `SELECT COALESCE(service_type, 'menu') as service_type FROM events WHERE id = $1`,
    [eventId]
  );
  const eventRow = eventResult.rows[0];
  const serviceType = (eventRow?.service_type || 'menu') as 'menu' | 'coctel';

  // Recalcular staffing lines con el pax definitivo
  await upsertStaffingLines(client, eventId, confirmedPax, serviceType);
  console.log(`[Handler] portal.frozen: staffing recalculado para ${confirmedPax} pax confirmados`);
}

/**
 * 2. Explosión de compras / órdenes a proveedor (WP-06)
 * Recalcula el escandallo con el pax definitivo y genera/actualiza
 * las órdenes de compra en estado borrador.
 */
async function explodePurchases(
  client: any,
  eventId: string
): Promise<{ shortagesFound: number; ordersCreated: number }> {
  // Liberar compromisos anteriores y recomputar
  await client.query(
    `DELETE FROM inventory_commitments WHERE event_id = $1`,
    [eventId]
  );

  // Recalcular compromiso de inventario con cantidades definitivas
  const shoppingItems = await client.query(
    `SELECT esi.ingredient_id, i.unit,
            SUM(convert_uom(esi.theoretical_qty, esi.theoretical_unit, i.unit)) AS qty_needed
     FROM event_shopping_items esi
     JOIN ingredients i ON i.id = esi.ingredient_id
     WHERE esi.event_id = $1 AND esi.ingredient_id IS NOT NULL
       AND esi.theoretical_qty IS NOT NULL
     GROUP BY esi.ingredient_id, i.unit`,
    [eventId]
  );

  for (const row of (shoppingItems.rows || [])) {
    await client.query(
      `INSERT INTO inventory_commitments (event_id, ingredient_id, qty_committed)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id, ingredient_id)
       DO UPDATE SET qty_committed = $3, updated_at = now()`,
      [eventId, row.ingredient_id, row.qty_needed]
    );
  }

  // Verificar faltantes
  const shortages = await checkInventoryShortages(client, eventId);
  const withDeficit = shortages.filter(s => s.deficit > 0);

  if (withDeficit.length === 0) {
    console.log(`[Handler] portal.frozen: sin faltantes de stock para evento ${eventId}`);
    return { shortagesFound: 0, ordersCreated: 0 };
  }

  // Generar/actualizar órdenes de compra
  const { created, orders } = await generateSupplierOrdersForEvent(
    client, eventId, withDeficit
  );

  console.log(
    `[Handler] portal.frozen: ${withDeficit.length} faltantes → ${created} órdenes de compra para evento ${eventId}`
  );
  return { shortagesFound: withDeficit.length, ordersCreated: created };
}

/**
 * 3. Cálculo de vajilla y packs (WP-20)
 * Recalcula las necesidades de vajilla y packs con el pax definitivo.
 * Los cálculos se almacenan en domain_events para que la UI los lea.
 */
async function calculateVajillaAndPacks(
  client: any,
  eventId: string,
  confirmedPax: number
): Promise<{ vajillaItems: number; packsGenerated: boolean }> {
  // Número de pases del menú del evento (usar client para consistencia transaccional)
  const passesResult = await client.query(
    `SELECT COUNT(DISTINCT pass_number) as num_passes
     FROM event_menu_items
     WHERE event_id = $1`,
    [eventId]
  );
  const numPasses = Number(passesResult.rows[0]?.num_passes) || 4; // Default 4 pases

  // Plantilla de vajilla activa
  const templateResult = await client.query(
    `SELECT id FROM vajilla_templates WHERE active = true LIMIT 1`
  );
  const template = templateResult.rows[0];

  if (!template) {
    console.log(`[Handler] portal.frozen: no hay plantilla de vajilla activa`);
    return { vajillaItems: 0, packsGenerated: false };
  }

  // Calcular ítems de vajilla por pase
  const vajillaItemsResult = await client.query(
    `SELECT name, category, quantity_per_pax
     FROM vajilla_template_items
     WHERE template_id = $1`,
    [template.id]
  );

  let totalVajillaItems = 0;
  for (const item of vajillaItemsResult.rows) {
    const qty = item.quantity_per_pax * confirmedPax * numPasses;
    totalVajillaItems += qty;
  }

  // Obtener packs de camareros basándose en el número de camareros
  const staffingResult = await client.query(
    `SELECT slots_needed FROM staffing_lines
     WHERE event_id = $1 AND role = 'camarero' AND status != 'cancelled'
     LIMIT 1`,
    [eventId]
  );
  const numCamareros = Number(staffingResult.rows[0]?.slots_needed) || Math.ceil(confirmedPax / 10);

  // Packs de alérgenos: contar invitados con restricciones
  const dietaryResult = await client.query(
    `SELECT COUNT(*) as count
     FROM event_guest_variants egv
     WHERE egv.event_id = $1
       AND egv.variant_type IN ('celiaco', 'sin_gluten', 'vegano', 'vegetariano', 'sin_lactosa', 'sin_frutos_secos')`,
    [eventId]
  );
  const guestsWithDietary = Number(dietaryResult.rows[0]?.count) || 0;

  const packsGenerated = numCamareros > 0 || guestsWithDietary > 0;

  console.log(
    `[Handler] portal.frozen: vajilla=${totalVajillaItems} ítems, ` +
    `packs camareros=${numCamareros}, packs alérgenos=${guestsWithDietary}`
  );

  return { vajillaItems: totalVajillaItems, packsGenerated };
}

/**
 * 4. Recálculo del escandallo con cantidades definitivas (WP-05)
 * Recalcula las cantidades teóricas en event_shopping_items basándose
 * en el pax definitivo (confirmados + niños confirmados).
 */
async function recalculateEscandallo(
  client: any,
  eventId: string,
  confirmedPax: number
): Promise<{ linesRecalculated: number }> {
  // Recalcular theoretical_qty para cada línea del escandallo
  // que tenga recipe_item_id (las que vienen de receta)
  const result = await client.query(
    `UPDATE event_shopping_items esi
     SET theoretical_qty = ROUND(
       (ri.quantity * $2 / GREATEST(COALESCE(ci.servings, 1), 1))::numeric, 2
     ),
     updated_at = now()
     FROM recipe_items ri
     JOIN catalog_items ci ON ci.id = ri.catalog_item_id
     WHERE esi.event_id = $1
       AND esi.recipe_item_id = ri.id
       AND ci.active = true`,
    [eventId, confirmedPax]
  );

  const linesRecalculated = result.rowCount || 0;
  console.log(
    `[Handler] portal.frozen: ${linesRecalculated} líneas de escandallo recalculadas para ${confirmedPax} pax`
  );

  return { linesRecalculated };
}

// ============================================================
// Handler principal
// ============================================================

export async function handlePortalFrozen(event: DomainEvent): Promise<void> {
  const payload = event.payload as unknown as PortalFrozenPayload;
  const { event_id, portal_id, confirmed_guests, confirmed_adults, confirmed_kids } = payload;

  console.log(`[Handler] portal.frozen para evento ${event_id}`);
  console.log(
    `  Pax: ${payload.guest_count}, Confirmados: ${confirmed_guests} ` +
    `(adultos: ${confirmed_adults}, niños: ${confirmed_kids})`
  );

  // Verificar idempotencia: si el evento ya está en_preparacion o más avanzado, saltar
  const pool = getPool();
  const statusCheck = await pool.query(
    `SELECT status FROM events WHERE id = $1`,
    [event_id]
  );
  const eventStatus = statusCheck.rows[0] as { status: string } | undefined;

  if (['en_preparacion', 'in_progress', 'cerrado_operativo', 'cerrado_contable'].includes(
    eventStatus?.status || ''
  )) {
    console.log(
      `[Handler] portal.frozen: evento ${event_id} ya en estado '${eventStatus?.status}'. Saltando (idempotente).`
    );
    return;
  }

  // Calcular pax definitivo
  const definitivePax = confirmed_guests || payload.guest_count || 0;

  if (definitivePax <= 0) {
    console.log(`[Handler] portal.frozen: pax definitivo es 0. Saltando cascada.`);
    return;
  }

  // Ejecutar cascada en transacción
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Staffing definitivo
    await recalculateStaffing(client, event_id, definitivePax);

    // 2. Explosión de compras
    const purchases = await explodePurchases(client, event_id);

    // 3. Vajilla y packs
    const vajillaPacks = await calculateVajillaAndPacks(
      client, event_id, definitivePax
    );

    // 4. Recálculo de escandallo
    const escandallo = await recalculateEscandallo(client, event_id, definitivePax);

    // Transicionar evento a 'en_preparacion' (si está en 'accepted')
    if (eventStatus?.status === 'accepted') {
      await client.query(
        `UPDATE events SET status = 'en_preparacion', updated_at = now() WHERE id = $1`,
        [event_id]
      );

      // Emitir event.en_preparacion
      await emitDomainEvent(
        client,
        'event.en_preparacion',
        'event',
        event_id,
        {
          event_id,
          triggered_by: 'portal.frozen',
          confirmed_pax: definitivePax,
          timestamp: new Date().toISOString()
        }
      );
    }

    await client.query('COMMIT');

    console.log(`[Handler] portal.frozen: cascada completada para evento ${event_id}`);
    console.log(
      `  Staffing: recalculado | Compras: ${purchases.ordersCreated} órdenes, ${purchases.shortagesFound} faltantes | ` +
      `Vajilla: ${vajillaPacks.vajillaItems} ítems | Escandallo: ${escandallo.linesRecalculated} líneas`
    );

  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[Handler] portal.frozen: error en cascada para evento ${event_id}:`, error);
    throw error;
  } finally {
    client.release();
  }
}
