/**
 * EventFlow — API de líneas de escandallo (edición)
 *
 * PUT /api/cocina/escandallos/[escandalloId]/lines
 *   Body: { lines: [{ line_id, cantidad, unit, cost_unit }] }
 *   Actualiza las líneas del escandallo y RECALCULA los totales:
 *     - cost_total de cada línea = cantidad × cost_unit
 *     - total_cost del escandallo = Σ líneas
 *     - cost_per_pax = total_cost / pax (del evento)
 *
 * Este módulo está CONGELADO por decisión de usuario: no modificar la
 * semántica de cálculo ni el contrato de esta API sin autorización expresa.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { sanitizeError } from '@/lib/security';

async function verifyAuth(request: NextRequest) {
  const token = request.cookies.get('admin_session')?.value || request.cookies.get('eventflow_token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ escandalloId: string }> }
) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });

    const { escandalloId } = await params;
    if (!UUID_REGEX.test(escandalloId)) {
      return NextResponse.json({ success: false, error: 'ID inválido.' }, { status: 422 });
    }

    const body = await request.json();
    const lines = Array.isArray(body?.lines) ? body.lines : [];
    if (!lines.length) {
      return NextResponse.json({ success: false, error: 'Sin líneas para actualizar' }, { status: 400 });
    }

    const pool = getPool();

    // Verificar que el escandallo existe y obtener pax del evento
    const esc = await pool.query(
      `SELECT e.id, e.total_cost, ev.guest_count
       FROM escandallos e
       JOIN events ev ON ev.id = e.event_id
       WHERE e.id = $1`,
      [escandalloId]
    );
    if (!esc.rows.length) {
      return NextResponse.json({ success: false, error: 'Escandallo no encontrado.' }, { status: 404 });
    }
    const pax = Number(esc.rows[0].guest_count) || 0;

    // Actualizar cada línea en una transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const line of lines) {
        if (!line?.line_id || !UUID_REGEX.test(String(line.line_id))) continue;
        const cantidad = line.cantidad != null && line.cantidad !== '' ? Number(line.cantidad) : null;
        const unit = typeof line.unit === 'string' && line.unit.trim() ? line.unit.trim() : null;
        const costUnit = line.cost_unit != null && line.cost_unit !== '' ? Number(line.cost_unit) : null;

        const sets: string[] = [];
        const vals: any[] = [];
        let idx = 1;

        if (cantidad !== null && !Number.isNaN(cantidad)) {
          sets.push(`cantidad = $${idx++}`);
          vals.push(cantidad);
        }
        if (unit) {
          sets.push(`unit = $${idx++}`);
          vals.push(unit);
        }
        if (costUnit !== null && !Number.isNaN(costUnit)) {
          sets.push(`cost_unit = $${idx++}`);
          vals.push(costUnit);
        }

        if (!sets.length) continue;
        // cost_total = cantidad × cost_unit (si ambos disponibles)
        if (cantidad !== null && !Number.isNaN(cantidad) && costUnit !== null && !Number.isNaN(costUnit)) {
          sets.push(`cost_total = ROUND($${idx++}::numeric, 4)`);
          vals.push(cantidad * costUnit);
        }
        vals.push(line.line_id, escandalloId);

        await client.query(
          `UPDATE escandallo_lines SET ${sets.join(', ')}
           WHERE id = $${idx} AND escandallo_id = $${idx + 1}`,
          [...vals, line.line_id, escandalloId]
        );
      }

      // Recalcular totales del escandallo: total_cost = Σ cost_total
      const totals = await client.query(
        `SELECT COALESCE(SUM(cost_total), 0)::numeric AS total,
                COUNT(*)::int AS n_lines
         FROM escandallo_lines WHERE escandallo_id = $1`,
        [escandalloId]
      );
      const totalCost = Number(totals.rows[0]?.total || 0);
      const nLines = Number(totals.rows[0]?.n_lines || 0);
      const costPerPax = pax > 0 ? totalCost / pax : 0;

      await client.query(
        `UPDATE escandallos SET total_cost = $1, cost_per_pax = $2, updated_at = NOW() WHERE id = $3`,
        [totalCost, costPerPax, escandalloId]
      );

      await client.query('COMMIT');
      return NextResponse.json({
        success: true,
        data: { total_cost: totalCost, cost_per_pax: costPerPax, n_lines: nLines },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
