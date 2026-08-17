/**
 * EventFlow — API de disponibilidad de stock por escandallo (INFORMATIVA)
 *
 * GET /api/cocina/escandallos/[escandalloId]/disponibilidad
 *
 * Compara las necesidades del evento (event_shopping_items del escandallo)
 * contra el stock disponible:
 *   - necesario:      teórico del escandallo (Σ por ingrediente)
 *   - con_seguridad:  necesario × (1 + escandallo_seguridad_pct)
 *   - stock:          Σ qty_base_remaining de los lotes del ingrediente
 *   - comprometido:   Σ inventory_commitments de OTROS eventos
 *   - disponible:     stock − comprometido (≥ 0)
 *   - faltante:       max(0, con_seguridad − disponible)
 *
 * Es SOLO LECTURA informativa. La compra se gestiona en Stock/Compras
 * (módulo de compras con human-in-the-loop).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany, querySingle } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';
import { calcularDisponibilidad } from '@/lib/domain/disponibilidadStock';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ escandalloId: string }> }
) {
  try {
    const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
    if (!token || !verifyToken(token)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    const { escandalloId } = await params;
    if (!UUID_REGEX.test(escandalloId)) {
      return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 422 });
    }

    const pool = getPool();
    const esc = await pool.query(
      `SELECT id, event_id, pax FROM escandallos WHERE id = $1`, [escandalloId]
    );
    if (!esc.rows.length) {
      return NextResponse.json({ success: false, error: 'Escandallo no encontrado.' }, { status: 404 });
    }
    const eventId = esc.rows[0].event_id;

    // Margen de seguridad configurable (default 5%)
    const settings = await querySingle<any>(
      `SELECT COALESCE(escandallo_seguridad_pct, 5)::float AS pct FROM business_settings LIMIT 1`
    ).catch(() => null);
    const seguridad = Number(settings?.pct ?? 5) / 100;

    // Necesidades del evento desde el escandallo teórico (por ingrediente)
    const neces = await queryMany<any>(
      `SELECT esi.ingredient_id, i.name, i.base_unit AS unidad,
              SUM(esi.theoretical_qty)::float AS necesario
       FROM event_shopping_items esi
       JOIN ingredients i ON i.id = esi.ingredient_id
       WHERE esi.event_id = $1
       GROUP BY esi.ingredient_id, i.name, i.base_unit`,
      [eventId]
    );

    // Stock por lotes
    const stock = await queryMany<any>(
      `SELECT ingredient_id, SUM(qty_base_remaining)::float AS stock
       FROM stock_lots WHERE qty_base_remaining > 0 GROUP BY ingredient_id`
    );
    const stockMap = new Map(stock.map((r: any) => [r.ingredient_id, Number(r.stock) || 0]));

    // Comprometidos de OTROS eventos (el propio evento no se descuenta)
    const comp = await queryMany<any>(
      `SELECT ingredient_id, SUM(qty_committed)::float AS comprometido
       FROM inventory_commitments WHERE event_id <> $1 GROUP BY ingredient_id`,
      [eventId]
    );
    const compMap = new Map(comp.map((r: any) => [r.ingredient_id, Number(r.comprometido) || 0]));

    const data = neces.map((n: any) => {
      const necesario = Number(n.necesario) || 0;
      return {
        ingredient_id: n.ingredient_id,
        nombre: n.name,
        unidad: n.unidad || 'ud',
        ...calcularDisponibilidad({
          necesidad: necesario,
          conSeguridad: necesario * (1 + seguridad),
          stock: stockMap.get(n.ingredient_id) ?? 0,
          comprometido: compMap.get(n.ingredient_id) ?? 0,
        }),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
