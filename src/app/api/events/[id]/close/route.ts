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
import { query, getPool } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { deductStockForEvent } from '@/lib/stockDeduct';
import { freezeEscandallo } from '@/lib/escandallo';
import { setEventStatus } from '@/lib/domain/eventState';
import { createInvoice } from '@/lib/domain/createInvoice';

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
      const order = orderRes.rows?.[0] as any;
      if (order) {
        const clientRes = await query(`SELECT * FROM clients WHERE id = $1`, [ev.client_id]);
        const client = clientRes.rows?.[0] as any;
        const paidRes = await query(
          `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments WHERE event_id = $1 AND paid = true`,
          [eventId]
        );
        const invoice = await createInvoice(getPool() as any, {
          orderId: order.id,
          eventId,
          clientId: ev.client_id,
          fiscalName: client?.name || ev.client_name || 'Cliente',
          fiscalNif: client?.nif || '',
          subtotal: Number(ev.total_pvp || 0),
          ivaPct: Number(ev.iva_pct || 10),
          paymentsTotal: Number(paidRes.rows?.[0]?.paid || 0),
        });
        results.push(`Factura ${invoice.invoice_number} generada`);
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