/**
 * EventFlow — Gastos varios previos del evento (FR-A06)
 * GET  /api/events/[id]/gastos-previos   — lista los gastos previos
 * POST /api/events/[id]/gastos-previos   — añade un gasto previo (gasolina,
 *                                          desplazamientos, compras puntuales)
 *
 * Se registran como línea de `cost_desglose` (line_type 'extras') y SUMAN al
 * coste total del evento (FR-A06). El concepto se marca con el prefijo
 * "Gasto previo:" para distinguirlos de otros extras.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';

export const dynamic = 'force-dynamic';

const PREFIX = 'Gasto previo:';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await queryMany<any>(
      `SELECT id, description, quantity, unit_price, total, created_at
       FROM cost_desglose
       WHERE event_id = $1 AND line_type = 'extras' AND description LIKE $2
       ORDER BY created_at`,
      [params.id, `${PREFIX}%`]
    );
    const total = rows.reduce((s, r) => s + Number(r.total || 0), 0);
    return NextResponse.json({ success: true, data: rows, total: Math.round(total * 100) / 100 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'event id inválido' }, { status: 422 });
    }
    const { concept, amount, quantity } = await request.json();
    if (!concept || !String(concept).trim()) {
      return NextResponse.json({ success: false, error: 'concept es obligatorio' }, { status: 422 });
    }
    const qty = Number(quantity) > 0 ? Number(quantity) : 1;
    const unit = Number(amount);
    if (!Number.isFinite(unit) || unit < 0) {
      return NextResponse.json({ success: false, error: 'amount debe ser un número >= 0' }, { status: 422 });
    }
    const total = Math.round(unit * qty * 100) / 100;

    const result = await transaction(async (client) => {
      const ev = (await client.query(`SELECT id FROM events WHERE id = $1`, [params.id])).rows[0];
      if (!ev) throw new Error('Evento no encontrado');

      const line = (await client.query(
        `INSERT INTO cost_desglose (event_id, line_type, description, quantity, unit_price, total)
         VALUES ($1, 'extras', $2, $3, $4, $5) RETURNING *`,
        [params.id, `${PREFIX} ${String(concept).trim()}`, qty, unit, total]
      )).rows[0];

      // Suma al coste total del evento (FR-A06).
      const updated = (await client.query(
        `UPDATE events SET total_cost = COALESCE(total_cost, 0) + $2 WHERE id = $1
         RETURNING total_cost`,
        [params.id, total]
      )).rows[0];

      return { line, total_cost: Number(updated.total_cost) };
    });

    return NextResponse.json({ success: true, data: result.line, total_cost: result.total_cost }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
