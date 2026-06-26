/**
 * EventFlow — Cron: briefing/memo a camareros la noche antes (T-1)  ·  FR-A12
 * GET|POST /api/cron/pre-event-briefing
 *
 * Busca los eventos de MAÑANA y, para cada camarero asignado, deja listo su memo
 * (mismo contenido que /api/briefing/[id]/memo). El envío por WhatsApp/email se
 * apoya en la infraestructura existente (best-effort); este cron es el disparador.
 * Ruta pública (cron) — ver middleware isPublicRoute('/api/cron/').
 */
import { NextRequest, NextResponse } from 'next/server';
import { queryMany } from '@/lib/db';
import { sanitizeError } from '@/lib/security';
import { isCronAuthorized } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';

async function run() {
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

  const total_memos = eventos.reduce((s, e) => s + Number(e.camareros_asignados || 0), 0);
  return {
    success: true,
    fecha_objetivo: 'T-1 (mañana)',
    eventos: eventos.length,
    total_memos,
    detalle: eventos,
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
