/**
 * EventFlow — Auto-generate supplier orders from stock needs
 * POST /api/stock/auto-orders
 * Scans ingredients with low stock and creates supplier orders.
 * Body: { event_id? } — if provided, also checks stock for that event's shopping items.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { event_id } = body;

    // Find ingredients where current_stock < min_stock
    const lowStock = await queryMany<any>(
      `SELECT i.id, i.name, i.unit, i.quantity AS current_stock, i.min_stock, i.supplier
      FROM ingredients i
      WHERE i.active = true
        AND i.supplier IS NOT NULL
        AND i.min_stock IS NOT NULL
        AND i.quantity < i.min_stock
      ORDER BY (i.min_stock - i.quantity) DESC`
    );

    if (lowStock.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay ingredientes por debajo del stock minimo',
        orders_created: 0,
      });
    }

    // Group by supplier
    const bySupplier: Record<string, typeof lowStock> = {};
    lowStock.forEach((item) => {
      const supplier = item.supplier || 'Sin proveedor';
      if (!bySupplier[supplier]) bySupplier[supplier] = [];
      bySupplier[supplier].push(item);
    });

    const createdOrders = [];

    for (const [supplierName, items] of Object.entries(bySupplier)) {
      // Create supplier order
      const order = await querySingle<any>(
        `INSERT INTO supplier_orders (supplier, status, notes)
         VALUES ($1, 'pending', 'Pedido automatico por stock bajo')
         RETURNING *`,
        [supplierName]
      );

      if (!order) continue;

      // Create order items
      for (const item of items) {
        const qtyNeeded = Math.ceil(Number(item.min_stock || 0) - Number(item.current_stock || 0));
        await querySingle(
          `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit)
           VALUES ($1, $2, $3, $4, $5)`,
          [order.id, item.id, item.name, qtyNeeded, item.unit]
        );
      }

      createdOrders.push({
        supplier: supplierName,
        order_id: order.id,
        items: items.map((i) => ({
          name: i.name,
          needed: Math.ceil((i.min_stock || 0) - (i.current_stock || 0)),
          unit: i.unit,
          current: i.current_stock,
          min: i.min_stock,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      orders_created: createdOrders.length,
      orders: createdOrders,
      total_items: lowStock.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
