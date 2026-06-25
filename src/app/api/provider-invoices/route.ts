/**
 * EventFlow — Cuentas a pagar a proveedores (FR-A10)
 * GET  /api/provider-invoices          — lista + resumen (debe, vencidos)
 * POST /api/provider-invoices          — registrar factura/deuda
 *
 * Solo admin (regla por defecto del middleware: rutas no listadas → admin).
 * El estado `vencido` se calcula al vuelo (due_date pasada y aún pendiente) y se
 * persiste de forma perezosa para que los listados sean consistentes.
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany, querySingle, query } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Marca como 'vencido' lo pendiente con vencimiento pasado (perezoso).
    await query(
      `UPDATE provider_invoices
       SET status = 'vencido'
       WHERE status = 'pendiente' AND due_date IS NOT NULL AND due_date < CURRENT_DATE`
    );

    const items = await queryMany<any>(
      `SELECT pi.*, p.name AS provider_name
       FROM provider_invoices pi
       LEFT JOIN providers p ON p.id = pi.provider_id
       ORDER BY (pi.status = 'pagado'), pi.due_date NULLS LAST, pi.created_at DESC`
    );

    const resumen = await querySingle<any>(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE status <> 'pagado'), 0)  AS debe_total,
         COALESCE(SUM(amount) FILTER (WHERE status = 'vencido'), 0)  AS vencido_total,
         COUNT(*) FILTER (WHERE status = 'vencido')                  AS vencidas,
         COUNT(*) FILTER (WHERE status = 'pendiente')                AS pendientes
       FROM provider_invoices`
    );

    return NextResponse.json({ success: true, data: items, resumen });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { provider_id, concept, amount, issue_date, due_date, proof_url, notes } = await request.json();
    if (provider_id && !isValidUUID(provider_id)) {
      return NextResponse.json({ success: false, error: 'provider_id inválido' }, { status: 422 });
    }
    if (amount == null || Number(amount) < 0) {
      return NextResponse.json({ success: false, error: 'amount debe ser un número >= 0' }, { status: 422 });
    }
    const inv = await querySingle<any>(
      `INSERT INTO provider_invoices (provider_id, concept, amount, issue_date, due_date, proof_url, notes)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5::date, $6, $7)
       RETURNING *`,
      [provider_id || null, concept || null, Number(amount), issue_date || null, due_date || null, proof_url || null, notes || null]
    );
    return NextResponse.json({ success: true, data: inv }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
