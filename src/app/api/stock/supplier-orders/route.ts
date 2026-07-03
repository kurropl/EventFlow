/**
 * EventFlow — Supplier Orders API
 * GET    /api/stock/supplier-orders              — List all orders
 * POST   /api/stock/supplier-orders              — Create order with items
 * PUT    /api/stock/supplier-orders              — Update order status/details
 * DELETE /api/stock/supplier-orders?id=X          — Delete order
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, transaction } from '@/lib/db';
import { sanitizeError, sanitizeText, isValidUUID } from '@/lib/security';
import { verifyToken } from '@/lib/auth';
import { adjustIngredientStock } from '@/lib/domain/stockLedger';

function requireAuth(request: NextRequest): { authenticated: boolean; error?: string } {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return { authenticated: false, error: 'No autenticado' };
  const user = verifyToken(token);
  if (!user) return { authenticated: false, error: 'Token inválido' };
  return { authenticated: true };
}

export async function GET(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    let where = '';
    const params: any[] = [];
    if (status && ['pending', 'ordered', 'delivered', 'received', 'cancelled'].includes(status)) {
      where = `WHERE so.status = $1`;
      params.push(status);
    }

    const orders = await queryMany<any>(
      `SELECT so.*, 
              COUNT(soi.id)::int AS item_count,
              COALESCE(SUM(soi.quantity * soi.unit_cost), 0)::numeric AS computed_total
       FROM supplier_orders so
       LEFT JOIN supplier_order_items soi ON soi.order_id = so.id
       ${where}
       GROUP BY so.id
       ORDER BY so.created_at DESC`,
      params
    );

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const body = await request.json();
    const { supplier, notes, expected_date, items } = body;

    if (!supplier) return NextResponse.json({ success: false, error: 'Proveedor es obligatorio' }, { status: 422 });
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ success: false, error: 'Debe incluir al menos un ingrediente' }, { status: 422 });
    }

    // Create order
    const order = await querySingle<any>(
      `INSERT INTO supplier_orders (supplier, notes, expected_date)
       VALUES ($1, $2, $3) RETURNING *`,
      [sanitizeText(supplier, 200), notes ? sanitizeText(notes, 500) : null, expected_date || null]
    );

    // Create items
    let totalCost = 0;
    for (const item of items) {
      const unitCost = Number(item.unit_cost) || 0;
      const qty = Number(item.quantity) || 0;
      totalCost += unitCost * qty;
      await querySingle(
        `INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit_cost, unit)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [order.id, item.ingredient_id || null, item.ingredient_name, qty, unitCost, item.unit || 'ud']
      );
    }

    // Update total
    await querySingle(`UPDATE supplier_orders SET total_cost = $1, updated_at = now() WHERE id = $2`, [totalCost, order.id]);

    return NextResponse.json({ success: true, data: { ...order, total_cost: totalCost } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const body = await request.json();
    const { id, status, notes, expected_date, delivered_date } = body;

    if (!id || !isValidUUID(id)) return NextResponse.json({ success: false, error: 'ID válido requerido' }, { status: 422 });

    const fields: string[] = [];
    const vals: any[] = [];
    let idx = 1;

    if (status) { fields.push(`status = $${idx++}`); vals.push(status); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); vals.push(notes ? sanitizeText(notes, 500) : null); }
    if (expected_date !== undefined) { fields.push(`expected_date = $${idx++}`); vals.push(expected_date || null); }
    if (delivered_date !== undefined) { fields.push(`delivered_date = $${idx++}`); vals.push(delivered_date || null); }

    if (fields.length === 0) return NextResponse.json({ success: false, error: 'Sin cambios' }, { status: 400 });
    fields.push('updated_at = now()');
    vals.push(id);

    const order = await querySingle<any>(
      `UPDATE supplier_orders SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals
    );

    // If delivered, auto-restock ingredients — vía el ledger único (G6): antes
    // era un UPDATE directo sin log alguno (ni stock_entries ni
    // inventory_movements); ahora queda trazado igual que cualquier recepción.
    if (status === 'delivered') {
      const items = await queryMany<any>(
        `SELECT * FROM supplier_order_items WHERE order_id = $1`, [id]
      );
      await transaction(async (client) => {
        for (const item of items) {
          if (item.ingredient_id) {
            await adjustIngredientStock(client, {
              ingredientId: item.ingredient_id,
              delta: Number(item.quantity),
              reason: 'compra_prevision',
              movementType: 'receipt',
              referenceType: 'supplier_order',
              referenceId: id,
              notes: `Pedido a proveedor entregado (${order?.supplier || 'proveedor'})`,
            });
            await querySingle(`UPDATE ingredients SET last_restocked = now() WHERE id = $1`, [item.ingredient_id]);
          }
        }
      });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = requireAuth(request);
    if (!auth.authenticated) return NextResponse.json({ success: false, error: auth.error }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || !isValidUUID(id)) return NextResponse.json({ success: false, error: 'ID válido requerido' }, { status: 422 });

    await querySingle(`DELETE FROM supplier_orders WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
