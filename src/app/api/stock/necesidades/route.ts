import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db'; import { verifyToken } from '@/lib/auth'; import { sanitizeError } from '@/lib/security';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function auth(r: NextRequest) { const t = r.cookies.get('admin_session')?.value || r.cookies.get('eventflow_token')?.value; return t ? verifyToken(t) : null; }
export async function POST(r: NextRequest) {
  try { if (!auth(r)) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const { event_id, escandallo_id } = await r.json();
    if (!UUID.test(event_id||'')) return NextResponse.json({ success: false, error: 'event_id inválido' }, { status: 422 });
    const needs = await queryMany(
      `SELECT esi.ingredient_id, i.name, i.base_unit AS unidad, i.supplier,
              SUM(esi.theoretical_qty)::float AS necesario,
              (SELECT COALESCE(SUM(sl.qty_base_remaining),0)::float FROM stock_lots sl WHERE sl.ingredient_id = i.id) AS stock,
              (SELECT COALESCE(SUM(ic.qty_committed),0)::float FROM inventory_commitments ic WHERE ic.ingredient_id = i.id AND ic.event_id <> $1) AS comprometido
       FROM event_shopping_items esi JOIN ingredients i ON i.id = esi.ingredient_id WHERE esi.event_id = $1 GROUP BY esi.ingredient_id, i.name, i.base_unit, i.supplier`,
      [event_id]
    );
    const data = needs.map((n: any) => ({ ...n, faltante: Math.max(0, Number(n.necesario) - Math.max(0, Number(n.stock)-Number(n.comprometido))) }));
    return NextResponse.json({ success: true, data });
  } catch (e) { return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 }); }
}
