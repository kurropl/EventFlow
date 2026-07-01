/**
 * EventFlow — Dominio: auto-dimensionado de personal (SPEC Sprint 4, G10)
 *
 * Única implementación de "cuántas líneas de staffing necesita un evento
 * según sus comensales". Antes las fórmulas de cocinero/metre vivían solo
 * inline en acceptQuote.ts, y event-flow/[eventId]/calculate/route.ts solo
 * regeneraba la línea 'camarero' (con un ON CONFLICT DO NOTHING que nunca
 * podía disparar — staffing_lines no tenía ninguna constraint única contra
 * la que chocar — así que cada recálculo insertaba una fila duplicada en
 * vez de actualizar la existente).
 *
 * E-B1 (decisión usuario): redimensiona SOLO líneas status='open' — una
 * línea ya 'filled'/'cancelled' no recibe un resize silencioso.
 */
import type { Pool, PoolClient } from 'pg';
import { calcCamareros, type ServiceType } from '@/lib/operations';

export function calcCocineros(guests: number): number {
  return Math.ceil(guests / 30);
}

export function calcMetres(guests: number): number {
  return Math.max(1, Math.ceil(guests / 40));
}

export async function upsertStaffingLines(
  client: Pool | PoolClient,
  eventId: string,
  guests: number,
  serviceType: ServiceType
): Promise<void> {
  const roles = [
    { role: 'camarero', slots: calcCamareros(guests, serviceType) },
    { role: 'cocinero', slots: calcCocineros(guests) },
    { role: 'metre', slots: calcMetres(guests) },
  ];
  for (const r of roles) {
    await client.query(
      `INSERT INTO staffing_lines (event_id, role, slots_needed, notes, status)
       VALUES ($1, $2, $3, 'Auto-generado', 'open')
       ON CONFLICT (event_id, role) WHERE status = 'open'
       DO UPDATE SET slots_needed = $3`,
      [eventId, r.role, r.slots]
    );
  }
}
