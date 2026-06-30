/**
 * EventFlow — Dominio: generación de pedidos a proveedor desde un déficit (G2)
 *
 * Única implementación. Antes vivía embebida en
 * src/app/api/stock/generate-order/route.ts con: (a) una llamada a
 * convert_uom() que no existía en schema.sql (bug real, ver
 * SPEC-Sprint2-Inventory.md), (b) matching de ingrediente por nombre exacto
 * (frágil), (c) sin event_id en el pedido pese a que la columna existe. Los
 * tres se corrigen aquí.
 *
 * E2 (decisión usuario): el pedido queda SIEMPRE en estado 'pending'
 * (borrador) — nunca se envía a nadie. Un humano debe confirmarlo/gestionarlo
 * en StockManager.tsx, igual que uno creado a mano.
 *
 * Idempotente por (event_id, supplier, status='pending', origin=
 * 'auto_accept'): si ya existe un pedido borrador para ese evento+proveedor,
 * se regeneran sus líneas en vez de duplicar el pedido.
 */
import type { PoolClient } from 'pg';
import type { ShortageRow } from './inventoryCommitment';

export async function generateSupplierOrdersForEvent(
  client: PoolClient, eventId: string, shortages: ShortageRow[]
): Promise<{ created: number; orders: any[] }> {
  // E3: solo se pide lo que tiene ingrediente resuelto (no se puede pedir lo
  // que no identifica a un ingrediente real) y proveedor conocido.
  const byProvider = new Map<string, ShortageRow[]>();
  for (const s of shortages) {
    if (!s.ingredient_id || s.deficit <= 0) continue;
    const provider = s.provider_name || 'Sin proveedor';
    if (!byProvider.has(provider)) byProvider.set(provider, []);
    byProvider.get(provider)!.push(s);
  }

  const orders: any[] = [];
  for (const [provider, rows] of byProvider) {
    let order = (await client.query(
      `SELECT * FROM supplier_orders
       WHERE event_id = $1 AND supplier = $2 AND status = 'pending' AND origin = 'auto_accept'
       LIMIT 1`,
      [eventId, provider]
    )).rows[0];

    if (!order) {
      order = (await client.query(
        `INSERT INTO supplier_orders (event_id, supplier, status, origin, ordered_at)
         VALUES ($1, $2, 'pending', 'auto_accept', now())
         RETURNING *`,
        [eventId, provider]
      )).rows[0];
    } else {
      await client.query(`DELETE FROM supplier_order_items WHERE order_id = $1`, [order.id]);
    }

    let totalCost = 0;
    for (const r of rows) {
      const unitCost = (await client.query(
        `SELECT unit_cost FROM ingredients WHERE id = $1`, [r.ingredient_id]
      )).rows[0]?.unit_cost ?? 0;
      const lineCost = r.deficit * Number(unitCost);
      totalCost += lineCost;
      await client.query(
        `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit, unit_cost, cost_per_unit)
         VALUES ($1, $2, $3, $4, $5, $6, $6)`,
        [order.id, r.ingredient_id, r.ingredient_name, r.deficit, r.unit, unitCost]
      );
    }
    await client.query(
      `UPDATE supplier_orders SET total_cost = $1, updated_at = now() WHERE id = $2`,
      [totalCost, order.id]
    );
    orders.push({ ...order, total_cost: totalCost });
  }
  return { created: orders.length, orders };
}
