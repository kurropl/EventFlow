/**
 * EventFlow — Logistica API (CORREGIDA)
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { verifyToken, verifyAuth } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';


export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const tipo = new URL(request.url).searchParams.get('tipo') || 'pedidos';

    if (tipo === 'pedidos') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT so.id, so.event_id, e.client_name as evento_nombre, so.status, so.supplier, so.created_at, so.expected_date, COALESCE((SELECT SUM(soi.quantity * soi.unit_cost) FROM supplier_order_items soi WHERE soi.order_id = so.id), 0) as total FROM supplier_orders so LEFT JOIN events e ON e.id = so.event_id ORDER BY so.created_at DESC LIMIT 50", []
      )});
    }

    if (tipo === 'alertas') {
      return NextResponse.json({ success: true, data: await queryMany<any>(
        "SELECT i.id, i.name, i.unit, i.quantity, i.min_stock, i.supplier, (i.min_stock - i.quantity) as deficit FROM ingredients i WHERE i.quantity <= i.min_stock AND i.min_stock > 0 ORDER BY (i.quantity::numeric / NULLIF(i.min_stock, 0)) ASC LIMIT 20", []
      )});
    }

    return NextResponse.json({ success: true, data: await queryMany<any>(
      "SELECT COUNT(*)::int as total, COUNT(*) FILTER (WHERE status = 'pending')::int as pendientes FROM supplier_orders", []
    )});
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}