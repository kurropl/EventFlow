/**
 * EventFlow — Handler: ingredient.price_changed
 * WP-13 Coste Vivo y Alertas de Margen
 *
 * Cuando cambia el precio de un ingrediente:
 * 1. Recalcular coste de platos afectados (vía recipe_items)
 * 2. Actualizar menus afectados (vía menu_section_dishes)
 * 3. Si margen < umbral configurable → alerta dashboard + email Gerente
 *
 * Umbral configurable en business_settings.margin_alert_threshold (default 20%)
 */

import type { PoolClient } from 'pg';
import type { DomainEvent } from '../events';
import { query, querySingle, queryMany, transaction } from '@/lib/db';
import { sendEmail, queueEmail } from '@/lib/email';

// ============================================================
// Tipos
// ============================================================

export interface IngredientPriceChangedPayload {
  ingredient_id: string;
  old_price: number;
  new_price: number;
}

interface DishCostRow {
  catalog_item_id: string;
  dish_name: string;
  dish_category: string | null;
  old_cost: number;
  new_cost: number;
}

interface MenuInfo {
  menu_id: number;
  menu_name: string;
  version: number;
  price_per_pax: number;
  old_cost_per_pax: number;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Recalcula el coste de un plato (catalog_item) basado en sus recipe_items.
 * Retorna el nuevo coste total.
 */
async function recalcDishCost(
  client: PoolClient,
  catalogItemId: string
): Promise<number> {
  const result = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(ri.quantity * i.unit_cost), 0)::numeric AS total
     FROM recipe_items ri
     JOIN ingredients i ON i.id = ri.ingredient_id
     WHERE ri.catalog_item_id = $1`,
    [catalogItemId]
  );
  return Number(result.rows[0]?.total) || 0;
}

/**
 * Obtiene el umbral de alerta de margen desde business_settings.
 */
async function getMarginThreshold(): Promise<number> {
  const row = await querySingle<{ margin_alert_threshold: string }>(
    `SELECT margin_alert_threshold FROM business_settings LIMIT 1`
  );
  return Number(row?.margin_alert_threshold) || 20;
}

/**
 * Obtiene el email del Gerente para notificaciones.
 */
async function getManagerEmail(): Promise<string | null> {
  const row = await querySingle<{ email: string }>(
    `SELECT email FROM admins WHERE role IN ('admin', 'gerente') AND email IS NOT NULL LIMIT 1`
  );
  return row?.email || null;
}

/**
 * Crea una alerta de margen en la tabla menu_cost_alerts.
 */
async function createMarginAlert(
  client: PoolClient,
  params: {
    menu_id: number;
    alert_type: 'margen_bajo' | 'coste_subido';
    old_margin: number;
    new_margin: number;
    old_cost: number;
    new_cost: number;
    ingredient_id: string;
    threshold: number;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO menu_cost_alerts
       (menu_id, alert_type, old_margin, new_margin, old_cost, new_cost,
        ingredient_id, threshold)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      params.menu_id,
      params.alert_type,
      params.old_margin,
      params.new_margin,
      params.old_cost,
      params.new_cost,
      params.ingredient_id,
      params.threshold,
    ]
  );
}

/**
 * Envía email de alerta de margen al Gerente.
 */
async function sendMarginAlertEmail(
  menuName: string,
  menuVersion: number,
  ingredientName: string,
  oldMargin: number,
  newMargin: number,
  threshold: number,
  oldCost: number,
  newCost: number
): Promise<void> {
  const managerEmail = await getManagerEmail();
  if (!managerEmail) {
    console.warn('[Handler] No se encontró email de Gerente para alerta de margen.');
    return;
  }

  const subject = `⚠️ Alerta de margen: Menú "${menuName}" v${menuVersion}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
      <h2 style="color: #DC2626;">⚠️ Alerta de Margen Bajo</h2>
      <p>El coste del menú <strong>"${menuName}" (v${menuVersion})</strong> ha cambiado
         debido a una variación de precio en el ingrediente <strong>${ingredientName}</strong>.</p>
      <div style="background: #FEF2F2; border-radius: 12px; padding: 20px; margin: 16px 0; border: 1px solid #FECACA;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px; color: #6B7280;">Coste anterior</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">${oldCost.toFixed(2)} €/pax</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #6B7280;">Coste nuevo</td>
            <td style="padding: 8px; text-align: right; font-weight: bold; color: #DC2626;">${newCost.toFixed(2)} €/pax</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #6B7280;">Margen anterior</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">${oldMargin.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #6B7280;">Margen nuevo</td>
            <td style="padding: 8px; text-align: right; font-weight: bold; color: #DC2626;">${newMargin.toFixed(1)}%</td>
          </tr>
          <tr>
            <td style="padding: 8px; color: #6B7280;">Umbral mínimo</td>
            <td style="padding: 8px; text-align: right;">${threshold.toFixed(1)}%</td>
          </tr>
        </table>
      </div>
      <p>Revisa el menú en el panel de administración para ajustar precios o recetas.</p>
      <a href="https://eventcater.duckdns.org/admin/menus"
         style="display: inline-block; background: #C9A84C; color: white; padding: 12px 32px;
                border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0;">
        Ver Menús
      </a>
    </div>
  `;

  await queueEmail({
    recipient_email: managerEmail,
    subject,
    body: html,
    email_type: 'margin_alert',
  });
}

// ============================================================
// Handler principal
// ============================================================

export async function handleIngredientPriceChanged(event: DomainEvent): Promise<void> {
  const payload = event.payload as unknown as IngredientPriceChangedPayload;
  const { ingredient_id, old_price, new_price } = payload;

  console.log(
    `[Handler] ingredient.price_changed para ingrediente ${ingredient_id}` +
    ` (${old_price.toFixed(4)} → ${new_price.toFixed(4)} €/ud base)`
  );

  // 1. Obtener nombre del ingrediente para logs y emails
  const ingredient = await querySingle<{ id: string; name: string }>(
    `SELECT id, name FROM ingredients WHERE id = $1`,
    [ingredient_id]
  );
  if (!ingredient) {
    console.warn(
      `[Handler] ingredient.price_changed: ingrediente ${ingredient_id} no encontrado, ignorando.`
    );
    return;
  }

  // 2. Obtener umbral de alerta
  const threshold = await getMarginThreshold();

  // 3. Encontrar platos afectados (catalog_items que usan este ingrediente)
  const affectedDishes = await queryMany<DishCostRow>(
    `SELECT DISTINCT
       ri.catalog_item_id,
       ci.name AS dish_name,
       ci.category AS dish_category,
       ci.cost AS old_cost,
       0::numeric AS new_cost
     FROM recipe_items ri
     JOIN catalog_items ci ON ci.id = ri.catalog_item_id
     WHERE ri.ingredient_id = $1`,
    [ingredient_id]
  );

  if (affectedDishes.length === 0) {
    console.log(
      `[Handler] ingredient.price_changed: ingrediente "${ingredient.name}" no está en ningún plato.`
    );
    return;
  }

  console.log(
    `[Handler] ${affectedDishes.length} plato(s) afectado(s) por cambio de precio de "${ingredient.name}".`
  );

  // 4. Recalcular coste de cada plato afectado y encontrar menús que lo contienen
  await transaction(async (client: PoolClient) => {
    for (const dish of affectedDishes) {
      // Recalcular coste del plato
      const newDishCost = await recalcDishCost(client, dish.catalog_item_id);

      // Actualizar coste en catalog_items
      await client.query(
        `UPDATE catalog_items SET cost = $1, updated_at = NOW() WHERE id = $2`,
        [newDishCost, dish.catalog_item_id]
      );

      // Encontrar menús publicados que contienen este plato
      const menusWithDish = await client.query<MenuInfo>(
        `SELECT DISTINCT
           m.id AS menu_id,
           m.name AS menu_name,
           m.version,
           m.price_per_pax,
           m.cost_per_pax AS old_cost_per_pax
         FROM menus m
         JOIN menu_sections ms ON ms.menu_id = m.id
         JOIN menu_section_dishes msd ON msd.section_id = ms.id
         WHERE msd.dish_id = $1
           AND m.status = 'publicado'`,
        [dish.catalog_item_id]
      );

      for (const menu of menusWithDish.rows) {
        // Recalcular coste total del menú: Σ coste de todos sus platos
        const newMenuCostResult = await client.query<{ total: string }>(
          `SELECT COALESCE(SUM(
             (SELECT COALESCE(SUM(ri2.quantity * i2.unit_cost), 0)
              FROM recipe_items ri2
              JOIN ingredients i2 ON i2.id = ri2.ingredient_id
              WHERE ri2.catalog_item_id = msd.dish_id)
           ), 0)::numeric AS total
           FROM menu_section_dishes msd
           JOIN menu_sections ms2 ON ms2.id = msd.section_id
           WHERE ms2.menu_id = $1`,
          [menu.menu_id]
        );

        const newMenuCost = Number(newMenuCostResult.rows[0]?.total) || 0;
        const oldMenuCost = Number(menu.old_cost_per_pax) || 0;

        // Actualizar coste del menú
        await client.query(
          `UPDATE menus SET cost_per_pax = $1, updated_at = NOW() WHERE id = $2`,
          [newMenuCost, menu.menu_id]
        );

        // Calcular margen: (PVP - coste) / PVP × 100
        const pricePerPax = Number(menu.price_per_pax) || 0;
        const oldMargin = pricePerPax > 0
          ? ((pricePerPax - oldMenuCost) / pricePerPax) * 100
          : 100;
        const newMargin = pricePerPax > 0
          ? ((pricePerPax - newMenuCost) / pricePerPax) * 100
          : 100;

        console.log(
          `[Handler] Menú "${menu.menu_name}" v${menu.version}: ` +
          `coste ${oldMenuCost.toFixed(2)}→${newMenuCost.toFixed(2)} €/pax, ` +
          `margen ${oldMargin.toFixed(1)}%→${newMargin.toFixed(1)}%`
        );

        // 5. Si el margen nuevo está por debajo del umbral → alerta
        if (newMargin < threshold) {
          console.warn(
            `[Handler] ⚠️ ALERTA: Menú "${menu.menu_name}" v${menu.version} ` +
            `tiene margen ${newMargin.toFixed(1)}% < umbral ${threshold}%`
          );

          // Crear alerta en BD
          await createMarginAlert(client, {
            menu_id: menu.menu_id,
            alert_type: 'margen_bajo',
            old_margin: oldMargin,
            new_margin: newMargin,
            old_cost: oldMenuCost,
            new_cost: newMenuCost,
            ingredient_id,
            threshold,
          });

          // Enviar email al Gerente (async, sin await para no bloquear)
          sendMarginAlertEmail(
            menu.menu_name,
            menu.version,
            ingredient.name,
            oldMargin,
            newMargin,
            threshold,
            oldMenuCost,
            newMenuCost
          ).catch((err) => {
            console.error('[Handler] Error enviando email de alerta de margen:', err);
          });
        }
      }
    }
  });

  console.log(
    `[Handler] ingredient.price_changed procesado para "${ingredient.name}". ` +
    `${affectedDishes.length} plato(s) recalculado(s).`
  );
}

// ============================================================
// Helpers para UI (dashboard de alertas)
// ============================================================

/**
 * Cuenta alertas de margen pendientes (no resueltas).
 * Usado por el badge en el dashboard.
 */
export async function countPendingMarginAlerts(): Promise<number> {
  const result = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM menu_cost_alerts
     WHERE resolved = false`
  );
  return Number(result.rows[0]?.count || 0);
}

/**
 * Obtiene alertas de margen pendientes para el dashboard.
 */
export async function getPendingMarginAlerts(limit = 20): Promise<any[]> {
  return queryMany(
    `SELECT
       mca.*,
       m.name AS menu_name,
       m.version AS menu_version,
       i.name AS ingredient_name
     FROM menu_cost_alerts mca
     JOIN menus m ON m.id = mca.menu_id
     LEFT JOIN ingredients i ON i.id = mca.ingredient_id
     WHERE mca.resolved = false
     ORDER BY mca.created_at DESC
     LIMIT $1`,
    [limit]
  );
}
