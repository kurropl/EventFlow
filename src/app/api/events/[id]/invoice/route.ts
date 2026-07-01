/**
 * EventFlow — Facturación parcial/incremental (SPEC Sprint 4, G16, E-B5)
 * POST /api/events/[id]/invoice  { amount }
 *
 * Ruta manual reutilizable (mismo patrón que
 * POST /api/events/[id]/contract/generate del Sprint 3): permite generar
 * una factura adicional por un importe explícito cuando se cobra el resto
 * de un evento cuyo cierre ya facturó solo una parte (E-B5 — ni forzar el
 * 100% de los pagos ni limitar a una sola factura por evento).
 *
 * Funciona tanto en un evento recién cerrado como en uno cerrado hace
 * tiempo. Control de sanidad (no bloqueo duro): si la suma de las facturas
 * no canceladas ya cubre el precio confirmado del pedido, solo se avisa.
 */
import { NextRequest, NextResponse } from 'next/server';
import { querySingle, transaction } from '@/lib/db';
import { sanitizeError, isValidUUID } from '@/lib/security';
import { createInvoice } from '@/lib/domain/createInvoice';
import { z } from 'zod';

const InvoiceSchema = z.object({
  amount: z.number().positive('amount debe ser mayor que 0'),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!isValidUUID(params.id)) {
      return NextResponse.json({ success: false, error: 'event id inválido' }, { status: 422 });
    }
    const body = await request.json();
    const parsed = InvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Validation error' },
        { status: 422 }
      );
    }

    const ev = await querySingle<any>(`SELECT * FROM events WHERE id = $1`, [params.id]);
    if (!ev) return NextResponse.json({ success: false, error: 'Evento no encontrado' }, { status: 404 });

    const order = await querySingle<any>(`SELECT * FROM event_orders WHERE event_id = $1 LIMIT 1`, [params.id]);
    if (!order) {
      return NextResponse.json({ success: false, error: 'El evento no tiene un pedido asociado' }, { status: 400 });
    }

    const result = await transaction(async (client) => {
      const client_ = await client.query(`SELECT * FROM clients WHERE id = $1`, [ev.client_id]);
      const client_row = client_.rows[0];

      const invoicedRes = await client.query(
        `SELECT COALESCE(SUM(subtotal), 0) AS total FROM invoices WHERE event_order_id = $1 AND status != 'cancelled'`,
        [order.id]
      );
      const alreadyInvoiced = Number(invoicedRes.rows[0]?.total) || 0;
      const confirmedPrice = Number(order.confirmed_price ?? ev.total_pvp ?? 0);

      const invoice = await createInvoice(client, {
        orderId: order.id,
        eventId: params.id,
        clientId: ev.client_id,
        fiscalName: client_row?.fiscal_name || client_row?.name || ev.client_name || 'Cliente',
        fiscalNif: client_row?.fiscal_nif || '',
        fiscalAddress: client_row?.fiscal_address || null,
        subtotal: parsed.data.amount,
        ivaPct: Number(ev.iva_pct || 10),
        paymentsTotal: parsed.data.amount, // esta factura cubre exactamente lo indicado como cobrado
      });

      // Control de sanidad (no bloqueo): avisar si el total facturado supera
      // el precio confirmado — puede ser legítimo (recargos), no se rechaza.
      const overInvoiced = alreadyInvoiced + parsed.data.amount > confirmedPrice;

      return { invoice, overInvoiced, totalInvoiced: alreadyInvoiced + parsed.data.amount, confirmedPrice };
    });

    return NextResponse.json({
      success: true,
      data: result.invoice,
      warning: result.overInvoiced
        ? `El total facturado (${result.totalInvoiced.toFixed(2)} €) supera el precio confirmado (${result.confirmedPrice.toFixed(2)} €)`
        : undefined,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
