/**
 * POST /api/payments/[eventId]/signal — Pago señal del presupuesto
 *
 * Proceso:
 * 1. Recibe el pago de señal (40% por defecto)
 * 2. Marca el pago en payments con paid=true
 * 3. Si es una señal de presupuesto (quote_id), actualiza quotes.deposit_paid=true
 *    y establece evento.status = 'presupuestado'
 * 4. Envía notificación por email de confirmación
 */
import { NextRequest, NextResponse } from 'next/server';
import { query, getPool } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { setEventStatus } from '@/lib/domain/eventState';
import { recordPayment } from '@/lib/domain/recordPayment';

export async function POST(_req: NextRequest) {
  try {
    const body = await _req.json();
    const { eventId, amount, method, deposit_pct } = body;
    if (!eventId) return NextResponse.json({ success: false, error: 'eventId requerido' }, { status: 400 });

    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, error: 'Importe inválido' }, { status: 400 });
    }

    // 1. Insert payment
    const payment = await recordPayment(getPool() as any, {
      eventId,
      concept: 'Señal presupuesto',
      amount,
      paid: true,
      paidDate: new Date(),
      method: method || 'transferencia',
      notes: `Señal ${deposit_pct || 40}%`,
    });

    // 2. Update quote deposit status
    await query(
      `UPDATE quotes SET deposit_paid = true, deposit_amount = $1 WHERE event_id = $2 AND status = 'accepted'`,
      [amount, eventId]
    );

    // 3. Set event status to 'presupuestado' (señal pagada)
    await setEventStatus(eventId, 'presupuestado', { extraWhereSql: `AND status = 'accepted'` });

    // 4. Send notification
    const event = await query(`SELECT client_email, client_name FROM events WHERE id = $1`, [eventId]);
    if (event.rows?.[0]) {
      const { client_email, client_name } = event.rows[0] as any;
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: client_email,
            subject: `Señal pagada — ${client_name}`,
            html: `<p>Hemos recibido la señal de ${amount}€ para el evento.</p>`,
          }),
        });
      } catch {}
    }

    return NextResponse.json({
      success: true,
      data: {
        payment,
        status: 'presupuestado',
        deposit_pct: deposit_pct || 40,
        message: `Señal de ${amount}€ registrada correctamente`,
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: sanitizeError(e) }, { status: 500 });
  }
}