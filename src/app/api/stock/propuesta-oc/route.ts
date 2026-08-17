import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db'; import { verifyToken } from '@/lib/auth'; import { sanitizeError } from '@/lib/security';
function auth(r: NextRequest) { const t = r.cookies.get('admin_session')?.value || r.cookies.get('eventflow_token')?.value; return t ? verifyToken(t) : null; }
export async function POST(r: NextRequest) {
  try { if (!auth(r)) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const body = await r.json();
    const { event_id, ordenes } = body;
    if (!ordenes?.length) return NextResponse.json({ success: false, error: 'Sin órdenes' }, { status: 400 });
    const pool = getPool(); const creadas = [];
    for (const ord of ordenes) {
      const o = await pool.query(`INSERT INTO supplier_orders (supplier, status, event_id, origin) VALUES ($1,'pending',$2,'propuesta') RETURNING id`,[ord.supplier, event_id||null]);
      const oid = o.rows[0].id;
      for (const item of (ord.items||[])) {
        await pool.query(`INSERT INTO supplier_order_items (order_id, ingredient_id, ingredient_name, quantity, unit_cost, unit) VALUES ($1,$2,$3,$4,0,$5)`,[oid, item.ingredient_id, item.nombre, item.cantidad, item.unidad||'g']);
      }
      creadas.push(oid);
    }
    return NextResponse.json({ success: true, data: { orders_created: creadas } });
  } catch (e) { return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 }); }
}
