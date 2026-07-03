/**
 * EventFlow — Cron: briefing/memo a camareros la noche antes (T-1)  ·  FR-A12
 * GET|POST /api/cron/pre-event-briefing
 *
 * Busca los eventos de MAÑANA y, para cada camarero asignado, ENVÍA su memo
 * individual (mismo contenido que /api/briefing/[id]/memo) por WhatsApp
 * (siempre, el teléfono es obligatorio en `workers`) y por email cuando el
 * trabajador tiene una cuenta de admin vinculada con email (`admins.worker_id`).
 *
 * Sprint 6 (F0.3): antes este cron solo contaba memos y devolvía JSON — no
 * enviaba nada pese a que la infraestructura de envío (whatsapp.ts, email.ts)
 * ya existe y funciona. Idempotente vía `briefing_send_log` (no reenvía si
 * el cron se ejecuta más de una vez el mismo T-1).
 * Ruta pública (cron) — ver middleware isPublicMethod('/api/cron/').
 */
import { NextRequest, NextResponse } from 'next/server';
import { getPool, queryMany, querySingle } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { isCronAuthorized } from '@/lib/cron-auth';
import { getWhatsAppClient, normalizePhone } from '@/lib/whatsapp';
import { sendEmail } from '@/lib/email';
import { generateEventMemos } from '@/lib/briefingMemo';

export const dynamic = 'force-dynamic';

async function run() {
  const pool = getPool();

  // Eventos de mañana (T-1) que no están cancelados/descartados.
  const eventos = await queryMany<any>(
    `SELECT e.id, e.client_name, e.event_date,
            COUNT(sa.id)::int AS camareros_asignados
     FROM events e
     LEFT JOIN staffing_lines sl ON sl.event_id = e.id
     LEFT JOIN staffing_assignments sa ON sa.staffing_line_id = sl.id
     WHERE e.event_date = (CURRENT_DATE + INTERVAL '1 day')::date
       AND e.status NOT IN ('cancelled', 'lost')
     GROUP BY e.id, e.client_name, e.event_date`
  );

  let enviados_whatsapp = 0;
  let enviados_email = 0;
  let fallidos = 0;
  const detalle: any[] = [];

  for (const ev of eventos) {
    const data = await generateEventMemos(ev.id);
    const memos = data?.memos || [];
    for (const m of memos) {
      // WhatsApp — siempre se intenta, el teléfono es obligatorio en workers.
      const alreadyWa = await querySingle<any>(
        `SELECT 1 FROM briefing_send_log WHERE event_id=$1 AND worker_id=$2 AND channel='whatsapp'`,
        [ev.id, m.worker_id]
      );
      if (!alreadyWa) {
        const phone = normalizePhone(m.phone);
        if (phone) {
          try {
            const result = await getWhatsAppClient().sendMessage(phone, m.memo);
            await pool.query(
              `INSERT INTO briefing_send_log (event_id, worker_id, channel, status, error)
               VALUES ($1,$2,'whatsapp',$3,$4)
               ON CONFLICT (event_id, worker_id, channel) DO NOTHING`,
              [ev.id, m.worker_id, result.success ? 'sent' : 'failed', result.error ?? null]
            );
            if (result.success) enviados_whatsapp++; else fallidos++;
          } catch (e: any) {
            fallidos++;
            await pool.query(
              `INSERT INTO briefing_send_log (event_id, worker_id, channel, status, error)
               VALUES ($1,$2,'whatsapp','failed',$3)
               ON CONFLICT (event_id, worker_id, channel) DO NOTHING`,
              [ev.id, m.worker_id, String(e?.message || e)]
            );
          }
        }
      }

      // Email — solo si el trabajador tiene una cuenta de admin vinculada
      // (workers no tiene columna email propia; admins.worker_id la resuelve).
      const alreadyEmail = await querySingle<any>(
        `SELECT 1 FROM briefing_send_log WHERE event_id=$1 AND worker_id=$2 AND channel='email'`,
        [ev.id, m.worker_id]
      );
      if (!alreadyEmail) {
        const admin = await querySingle<any>(
          `SELECT email FROM admins WHERE worker_id=$1 AND email IS NOT NULL AND email != '' LIMIT 1`,
          [m.worker_id]
        );
        if (admin?.email) {
          try {
            const result = await sendEmail({
              to: admin.email,
              subject: `Briefing evento de mañana — ${data?.evento || ev.client_name}`,
              html: `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${m.memo}</pre>`,
              text: m.memo,
            });
            await pool.query(
              `INSERT INTO briefing_send_log (event_id, worker_id, channel, status, error)
               VALUES ($1,$2,'email',$3,$4)
               ON CONFLICT (event_id, worker_id, channel) DO NOTHING`,
              [ev.id, m.worker_id, result.success ? 'sent' : 'failed', result.error ?? null]
            );
            if (result.success) enviados_email++; else fallidos++;
          } catch (e: any) {
            fallidos++;
            await pool.query(
              `INSERT INTO briefing_send_log (event_id, worker_id, channel, status, error)
               VALUES ($1,$2,'email','failed',$3)
               ON CONFLICT (event_id, worker_id, channel) DO NOTHING`,
              [ev.id, m.worker_id, String(e?.message || e)]
            );
          }
        }
      }
    }
    detalle.push({ id: ev.id, client_name: ev.client_name, event_date: ev.event_date, camareros_asignados: ev.camareros_asignados });
  }

  return {
    success: true,
    fecha_objetivo: 'T-1 (mañana)',
    eventos: eventos.length,
    total_memos: detalle.reduce((s, e) => s + Number(e.camareros_asignados || 0), 0),
    enviados_whatsapp,
    enviados_email,
    fallidos,
    detalle,
  };
}

export async function GET(request: NextRequest) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
    }
    return NextResponse.json(await run());
  } catch (error) {
    return NextResponse.json({ success: false, error: sanitizeError(error) }, { status: 500 });
  }
}
export const POST = GET;
