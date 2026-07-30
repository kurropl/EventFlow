/**
 * EventFlow — Servicio de Cierre Operativo (WP-18)
 * Checklist de cierre y transición a cerrado_operativo.
 */

import type { PoolClient } from 'pg';
import { getPool, querySingle } from '@/lib/db';
import { emitDomainEvent } from './events';

// ============================================================
// Types
// ============================================================

export interface ClosureChecklist {
  id: string;
  event_id: string;
  logistics_returned: boolean;
  waste_recorded: boolean;
  hours_validated: boolean;
  appcc_resolved: boolean;
  logistics_override: boolean | null;
  waste_override: boolean | null;
  hours_override: boolean | null;
  appcc_override: boolean | null;
  override_reason: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutoStatus {
  logistics_returned: boolean;
  waste_recorded: boolean;
  hours_validated: boolean;
  appcc_resolved: boolean;
}

export interface ClosureStatus {
  checklist: ClosureChecklist | null;
  autoStatus: {
    logistics_returned: boolean;
    waste_recorded: boolean;
    hours_validated: boolean;
    appcc_resolved: boolean;
  };
  effectiveStatus: {
    logistics_returned: boolean;
    waste_recorded: boolean;
    hours_validated: boolean;
    appcc_resolved: boolean;
  };
  isComplete: boolean;
  canClose: boolean;
}

export interface UpdateChecklistInput {
  logistics_override?: boolean | null;
  waste_override?: boolean | null;
  hours_override?: boolean | null;
  appcc_override?: boolean | null;
  override_reason?: string;
}

// ============================================================
// Autocompletar desde fuentes
// ============================================================

/**
 * Obtiene el estado automático del checklist desde las fuentes de datos.
 * - logistics_returned: TRUE si todos los ítems de logística del evento están retornados
 * - waste_recorded: TRUE si las mermas están registradas
 * - hours_validated: TRUE si las horas del personal están aprobadas
 * - appcc_resolved: TRUE si no hay incidencias APPCC abiertas
 */
async function getAutoStatus(eventId: string): Promise<AutoStatus> {
  const pool = getPool();

  // 1. Logística retornada: verificar que no haya ítems de carga pendientes
  //    (event_shopping_items con completed = false o event_plans de categoría 'logistica' sin completar)
  const logisticsResult = await pool.query(`
    SELECT COUNT(*) as pending_count
    FROM event_plans
    WHERE event_id = $1
    AND category = 'logistica'
    AND completed = false
  `, [eventId]);
  const logisticsReturned = Number(logisticsResult.rows[0]?.pending_count || 0) === 0;

  // 2. Mermas registradas: verificar que se hayan registrado movimientos de merma
  //    (stock_entries con movement_reason = 'merma' para este evento)
  const wasteResult = await pool.query(`
    SELECT COUNT(*) as waste_count
    FROM stock_entries
    WHERE event_id = $1
    AND movement_reason = 'merma'
  `, [eventId]);
  // Por ahora consideramos que las mermas están registradas si el evento ya tiene
  // algún movimiento de stock asociado (consumo o merma)
  const stockMovementsResult = await pool.query(`
    SELECT COUNT(*) as movement_count
    FROM stock_entries
    WHERE event_id = $1
  `, [eventId]);
  const wasteRecorded = Number(stockMovementsResult.rows[0]?.movement_count || 0) > 0;

  // 3. Horas aprobadas: verificar que las horas del personal estén aprobadas
  //    (worker_event_pay con status = 'approved' o 'paid' para este evento)
  const hoursResult = await pool.query(`
    SELECT COUNT(*) as total_hours,
           COUNT(*) FILTER (WHERE status IN ('approved', 'paid')) as approved_hours
    FROM worker_event_pay
    WHERE event_id = $1
  `, [eventId]);
  const totalHours = Number(hoursResult.rows[0]?.total_hours || 0);
  const approvedHours = Number(hoursResult.rows[0]?.approved_hours || 0);
  const hoursValidated = totalHours > 0 && totalHours === approvedHours;

  // 4. APPCC sin incidencias: verificar que no haya incidencias abiertas
  //    (haccp_monitoring con status != 'ok' para este evento)
  const appccResult = await pool.query(`
    SELECT COUNT(*) as incidents_count
    FROM haccp_monitoring
    WHERE event_id = $1
    AND status != 'ok'
  `, [eventId]);
  const appccResolved = Number(appccResult.rows[0]?.incidents_count || 0) === 0;

  return {
    logistics_returned: logisticsReturned,
    waste_recorded: wasteRecorded,
    hours_validated: hoursValidated,
    appcc_resolved: appccResolved,
  };
}

// ============================================================
// Obtener estado del checklist
// ============================================================

/**
 * Obtiene el estado completo del checklist de cierre para un evento.
 */
export async function getClosureStatus(eventId: string): Promise<ClosureStatus> {
  const pool = getPool();

  // Obtener checklist existente
  const checklist = await querySingle<ClosureChecklist>(
    `SELECT * FROM event_closure_checklists WHERE event_id = $1`,
    [eventId]
  );

  // Obtener estado automático
  const autoStatus = await getAutoStatus(eventId);

  // Calcular estado efectivo (override o automático)
  const effectiveStatus = {
    logistics_returned: checklist?.logistics_override ?? autoStatus.logistics_returned,
    waste_recorded: checklist?.waste_override ?? autoStatus.waste_recorded,
    hours_validated: checklist?.hours_override ?? autoStatus.hours_validated,
    appcc_resolved: checklist?.appcc_override ?? autoStatus.appcc_resolved,
  };

  const isComplete = Object.values(effectiveStatus).every(v => v === true);

  return {
    checklist: checklist,
    autoStatus,
    effectiveStatus,
    isComplete,
    canClose: isComplete,
  };
}

// ============================================================
// Actualizar checklist (override por Gerente)
// ============================================================

/**
 * Actualiza el checklist de cierre con overrides del Gerente.
 * Requiere motivo si se sobreescribe un valor automático.
 */
export async function updateClosureChecklist(
  client: PoolClient,
  eventId: string,
  input: UpdateChecklistInput,
  userId: string
): Promise<ClosureChecklist> {
  // Validar que si hay override, haya motivo
  const hasOverride = input.logistics_override !== undefined ||
                      input.waste_override !== undefined ||
                      input.hours_override !== undefined ||
                      input.appcc_override !== undefined;

  if (hasOverride && !input.override_reason?.trim()) {
    throw new Error('El motivo es obligatorio cuando se sobreescribe un check manualmente');
  }

  // Upsert del checklist
  const result = await client.query(`
    INSERT INTO event_closure_checklists (
      event_id,
      logistics_override,
      waste_override,
      hours_override,
      appcc_override,
      override_reason
    ) VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (event_id) DO UPDATE SET
      logistics_override = COALESCE(EXCLUDED.logistics_override, event_closure_checklists.logistics_override),
      waste_override = COALESCE(EXCLUDED.waste_override, event_closure_checklists.waste_override),
      hours_override = COALESCE(EXCLUDED.hours_override, event_closure_checklists.hours_override),
      appcc_override = COALESCE(EXCLUDED.appcc_override, event_closure_checklists.appcc_override),
      override_reason = EXCLUDED.override_reason,
      updated_at = now()
    RETURNING *
  `, [
    eventId,
    input.logistics_override ?? null,
    input.waste_override ?? null,
    input.hours_override ?? null,
    input.appcc_override ?? null,
    input.override_reason?.trim() || null,
  ]);

  return result.rows[0];
}

// ============================================================
// Cerrar evento (transición en_curso → cerrado_operativo)
// ============================================================

/**
 * Cierra operativamente un evento.
 * - Valida que el checklist esté completo
 * - Transición de estado: in_progress → cerrado_operativo (o en_curso → cerrado_operativo)
 * - Emite evento de dominio event.operationally_closed
 */
export async function closeEventOperationally(
  client: PoolClient,
  eventId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Obtener evento actual
  const event = await querySingle<any>(
    `SELECT id, status FROM events WHERE id = $1`,
    [eventId]
  );

  if (!event) {
    return { success: false, error: 'Evento no encontrado' };
  }

  // 2. Validar que el evento esté en estado que permita cierre
  //    Aceptamos: in_progress, en_curso, accepted (por si se saltó algún paso)
  const validStatuses = ['in_progress', 'en_curso', 'accepted'];
  if (!validStatuses.includes(event.status)) {
    return { success: false, error: `No se puede cerrar un evento en estado "${event.status}"` };
  }

  // 3. Obtener y validar checklist
  const status = await getClosureStatus(eventId);
  if (!status.isComplete) {
    const missing = Object.entries(status.effectiveStatus)
      .filter(([, v]) => !v)
      .map(([k]) => {
        const labels: Record<string, string> = {
          logistics_returned: 'Logística retornada',
          waste_recorded: 'Mermas registradas',
          hours_validated: 'Horas aprobadas',
          appcc_resolved: 'APPCC resuelto',
        };
        return labels[k] || k;
      });
    return { 
      success: false, 
      error: `Checklist incompleto. Faltan: ${missing.join(', ')}` 
    };
  }

  // 4. Actualizar checklist con cierre
  await client.query(`
    UPDATE event_closure_checklists
    SET closed_by = $1, closed_at = now(), updated_at = now()
    WHERE event_id = $2
  `, [userId, eventId]);

  // 5. Transición de estado
  await client.query(
    `UPDATE events SET status = 'cerrado_operativo', updated_at = now() WHERE id = $1`,
    [eventId]
  );

  // 6. Emitir evento de dominio
  await emitDomainEvent(
    client,
    'event.operationally_closed',
    'event',
    eventId,
    {
      event_id: eventId,
      closed_by: userId,
      closed_at: new Date().toISOString(),
    }
  );

  return { success: true };
}

// ============================================================
// Obtener o crear checklist para un evento
// ============================================================

/**
 * Asegura que exista un checklist para el evento.
 * Si no existe, lo crea con valores por defecto.
 */
export async function ensureChecklist(client: PoolClient, eventId: string): Promise<ClosureChecklist> {
  const existing = await querySingle<ClosureChecklist>(
    `SELECT * FROM event_closure_checklists WHERE event_id = $1`,
    [eventId]
  );

  if (existing) {
    return existing;
  }

  const result = await client.query(`
    INSERT INTO event_closure_checklists (event_id)
    VALUES ($1)
    ON CONFLICT (event_id) DO NOTHING
    RETURNING *
  `, [eventId]);

  // Si RETURNING no devolvió nada (por DO NOTHING), obtener el existente
  if (result.rows.length === 0) {
    const existing = await querySingle<ClosureChecklist>(
      `SELECT * FROM event_closure_checklists WHERE event_id = $1`,
      [eventId]
    );
    if (!existing) {
      throw new Error('No se pudo crear o encontrar el checklist de cierre');
    }
    return existing;
  }

  return result.rows[0];
}
