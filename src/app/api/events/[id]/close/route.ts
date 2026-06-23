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

    // 1. Freeze escandallo
    const frozenRes = await query(
      `SELECT frozen FROM event_shopping_items WHERE event_id = $1 AND frozen = true LIMIT 1`,
      [eventId]
    );
    if (!frozenRes.rows?.[0]) {
      await query(
        `UPDATE event_shopping_items SET frozen = true, frozen_at = now() WHERE event_id = $1`,
        [eventId]
      );
      results.push('Escandallo congelado');
    }

    // 2. Deduct stock
    if (!ev.stock_deducted) {
      await query(
        `UPDATE ingredients i
         SET current_stock = GREATEST(0, i.current_stock - COALESCE(esi.actual_qty_used, esi.estimated_qty, 0))
         FROM event_shopping_items esi
         WHERE esi.event_id = $1 AND esi.ingredient_id = i.id`,
        [eventId]
      );
      await query(`UPDATE events SET stock_deducted = true WHERE id = $1`, [eventId]);
      results.push('Stock deducido');
    }

    // 3. Generate invoice
    const invRes = await query(`SELECT id FROM invoices WHERE event_id = $1 LIMIT 1`, [eventId]);
    if (!invRes.rows?.[0]) {
      const orderRes = await query(`SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`, [eventId]);
      const order = orderRes.rows?.[0];
      if (order) {
        const invNum = `F-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;
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
    await query(
      `UPDATE events SET status = 'completed' WHERE id = $1 AND status NOT IN ('paid','cancelled','lost')`,
      [eventId]
    );
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