/**
 * EventFlow — Close Event API
 * POST /api/events/[id]/close
 *
 * Cierre completo del evento:
 * 1. Congela escandallo
 * 2. Deduce stock real del inventario
 * 3. Genera factura si no existe
 * 4. Marca evento como completado
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { deductStockForEvent } from '@/lib/stockDeduct';
import { freezeEscandallo } from '@/lib/escandallo';
import { setEventStatus } from '@/lib/domain/eventState';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    if (!eventId) {
      return NextResponse.json({ success: false, error: 'eventId required' }, { status: 400 });
    }

    const evRes = await query(`SELECT * FROM events WHERE id = $1`, [eventId]);
    if (!evRes.rows?.[0]) {
      return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });
    }
    const ev = evRes.rows[0] as any;

    const results: string[] = [];

    // 1. Congelar escandallo + persistir desviación teórico↔real (FR-C01/C03).
    const frozenRes = await query(
      `SELECT frozen FROM event_shopping_items WHERE event_id = $1 AND frozen = true LIMIT 1`,
      [eventId]
    );
    if (!frozenRes.rows?.[0]) {
      const dev = await freezeEscandallo(eventId);
      results.push(`Escandallo congelado (real ${dev.real.toFixed(2)} € vs estimado ${dev.estimado.toFixed(2)} €, desv. ${dev.desviacion.toFixed(2)} €)`);
    }

    // 2. Deduct stock — ruta canónica e idempotente (src/app/api/stock/deduct)
    if (!ev.stock_deducted) {
      const ded = await deductStockForEvent(eventId);
      results.push(`Stock deducido (${ded?.deducted ?? 0} ingredientes)`);
    }

    // 3. Generate invoice
    const invRes = await query(`SELECT id FROM invoices WHERE event_id = $1 LIMIT 1`, [eventId]);
    if (!invRes.rows?.[0]) {
      const orderRes = await query(`SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`, [eventId]);
      const order = orderRes.rows?.[0];
      if (order) {
        // Número de factura SECUENCIAL por año (no aleatorio) — T16/idempotente
        const year = new Date().getFullYear();
        const seq = await query(
          `SELECT COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '^F-[0-9]+-', ''), '')::int), 0) + 1 AS next
           FROM invoices WHERE invoice_number LIKE $1`,
          [`F-${year}-%`]
        );
        const nextNum = Number(seq.rows?.[0]?.next) || 1;
        const invNum = `F-${year}-${String(nextNum).padStart(4, '0')}`;
        const clientRes = await query(`SELECT * FROM clients WHERE id = $1`, [ev.client_id]);
        const client = clientRes.rows?.[0];
        const ivaPct = Number(ev.iva_pct || 10);
        const subtotal = Number(ev.total_pvp || 0);
        const ivaAmt = subtotal * ivaPct / 100;

        await query(
          `INSERT INTO invoices (event_order_id, event_id, client_id, invoice_number,
             fiscal_name, fiscal_nif, subtotal, iva_pct, iva_amount, total, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending')`,
          [order.id, eventId, ev.client_id, invNum,
           client?.name || ev.client_name || 'Cliente', client?.nif || '',
           subtotal, ivaPct, ivaAmt, subtotal + ivaAmt]
        );
        results.push(`Factura ${invNum} generada`);
      }
    }

    // 4. Mark event completed
    await setEventStatus(eventId, 'completed', {
      extraWhereSql: `AND status NOT IN ('paid','cancelled','lost')`,
    });
    results.push('Evento cerrado');

    return NextResponse.json({
      success: true,
      data: { results },
      message: 'Evento cerrado correctamente',
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}