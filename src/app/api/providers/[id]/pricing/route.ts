/**
 * EventFlow — CRUD de datos maestros proveedor × ingrediente
 * GET    /api/providers/[id]/pricing       — Listar precios del proveedor
 * POST   /api/providers/[id]/pricing       — Crear/upsert pricing
 * PUT    /api/providers/[id]/pricing/[pid] — Actualizar
 * DELETE /api/providers/[id]/pricing/[pid] — Desactivar
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError, sanitizeText } from '@/lib/security';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function auth(r: NextRequest) {
  const t = r.cookies.get('admin_session')?.value || r.cookies.get('eventflow_token')?.value;
  return t ? verifyToken(t) : null;
}
export async function GET(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { if (!auth(r)) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 422 });
    const data = await queryMany('SELECT sip.*, i.name as ingredient_name FROM supplier_ingredient_pricing sip JOIN ingredients i ON i.id = sip.ingredient_id WHERE sip.supplier_id = $1 AND sip.activo = true ORDER BY i.name', [id]);
    return NextResponse.json({ success: true, data });
  } catch (e) { return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 }); }
}
export async function POST(r: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { if (!auth(r)) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    const { id } = await params; if (!UUID.test(id)) return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 422 });
    const b = await r.json();
    const row = await querySingle(
      `INSERT INTO supplier_ingredient_pricing (supplier_id, ingredient_id, precio_vigente, unidad_compra, cantidad_por_unidad, unidad_uso, factor_conversion, pedido_minimo, plazo_entrega_dias, preferente)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (supplier_id, ingredient_id) DO UPDATE SET precio_vigente=EXCLUDED.precio_vigente, unidad_compra=EXCLUDED.unidad_compra, cantidad_por_unidad=EXCLUDED.cantidad_por_unidad, factor_conversion=EXCLUDED.factor_conversion, pedido_minimo=EXCLUDED.pedido_minimo, plazo_entrega_dias=EXCLUDED.plazo_entrega_dias, preferente=EXCLUDED.preferente, activo=true, updated_at=now()
       RETURNING *`,
      [id, b.ingredient_id, Number(b.precio_vigente)||0, sanitizeText(b.unidad_compra,50)||'caja', Number(b.cantidad_por_unidad)||1, sanitizeText(b.unidad_uso,50)||'g', Number(b.factor_conversion)||1, Number(b.pedido_minimo)||0, Number(b.plazo_entrega_dias)||0, !!b.preferente]
    );
    return NextResponse.json({ success: true, data: row });
  } catch (e) { return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 }); }
}
