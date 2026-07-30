/**
 * EventFlow — Handler: event.confirmed
 * Emite cuando un evento pasa a estado 'confirmado'.
 * Consumidores: WP-15 plantillas venue, WP-17 staffing.
 *
 * WP-15: Genera esqueleto automático según venue_type:
 * - externo: logística, packs, timing por defecto, centro APPCC Truck Externo
 * - benitez: checklist sala y mapa de mesas base
 *
 * Las plantillas viven en business_settings.event_templates (JSONB).
 * Handler idempotente: re-confirmar no duplica.
 */

import { getPool } from '@/lib/db';
import { emitDomainEvent } from '../events';
import type { DomainEvent } from '../events';
import { querySingle, transaction } from '@/lib/db';

export interface EventConfirmedPayload {
  event_id: string;
  venue_type: string;
  pax: number;
  date: string;
}

interface PlanTemplate {
  title: string;
  description?: string;
  planned_time?: string | null;
  category: string;
  sort_order: number;
}

interface ChecklistTemplate {
  title: string;
  description?: string;
  hours_before?: number;
  sort_order: number;
}

interface VenueTemplates {
  logistics?: PlanTemplate[];
  timing?: PlanTemplate[];
  packs?: PlanTemplate[];
  checklist?: ChecklistTemplate[];
  appcc_center?: {
    title: string;
    description?: string;
    area: string;
    schedule: string;
  };
  table_map?: {
    description: string;
    default_tables: Array<{
      name: string;
      seats: number;
      x: number;
      y: number;
    }>;
  };
}

/**
 * Obtiene las plantillas de eventos desde business_settings.
 */
async function getEventTemplates(): Promise<Record<string, VenueTemplates>> {
  const settings = await querySingle<any>(
    `SELECT event_templates FROM business_settings LIMIT 1`
  );
  return settings?.event_templates || {};
}

/**
 * Verifica si ya existen items de plantilla para el evento.
 * Retorna true si ya hay items (idempotencia).
 */
async function hasExistingTemplates(eventId: string): Promise<boolean> {
  const existing = await querySingle<any>(
    `SELECT 1 FROM event_plans WHERE event_id = $1 LIMIT 1`,
    [eventId]
  );
  return !!existing;
}

/**
 * Convierte un planned_time relativo (ej: "-3h", "+4h", "0") a una hora absoluta.
 * Si eventDate es null, retorna null.
 */
function resolvePlannedTime(
  relativeTime: string | null | undefined,
  eventDate: string | null
): Date | null {
  if (!relativeTime || !eventDate) return null;

  const baseTime = new Date(eventDate);
  // Por defecto, usar las 12:00 del día del evento como referencia
  baseTime.setHours(12, 0, 0, 0);

  const match = relativeTime.match(/^([+-]?\d+)(h|min)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (unit === 'h') {
    baseTime.setHours(baseTime.getHours() + value);
  } else if (unit === 'min') {
    baseTime.setMinutes(baseTime.getMinutes() + value);
  }

  return baseTime;
}

/**
 * Inserta items de logística, timing y packs en event_plans.
 */
async function insertPlanItems(
  client: any,
  eventId: string,
  items: PlanTemplate[],
  eventDate: string | null
): Promise<number> {
  let count = 0;
  for (const item of items) {
    const plannedTime = resolvePlannedTime(item.planned_time, eventDate);
    await client.query(
      `INSERT INTO event_plans (event_id, title, description, planned_time, category, sort_order, completed)
       VALUES ($1, $2, $3, $4, $5, $6, false)`,
      [
        eventId,
        item.title,
        item.description || null,
        plannedTime,
        item.category || 'general',
        item.sort_order || 0,
      ]
    );
    count++;
  }
  return count;
}

/**
 * Inserta items de checklist en checklist_tasks.
 */
async function insertChecklistItems(
  client: any,
  eventId: string,
  items: ChecklistTemplate[]
): Promise<number> {
  let count = 0;
  for (const item of items) {
    await client.query(
      `INSERT INTO checklist_tasks (event_id, title, description, hours_before, sort_order, completed, custom)
       VALUES ($1, $2, $3, $4, $5, false, true)`,
      [
        eventId,
        item.title,
        item.description || null,
        item.hours_before || null,
        item.sort_order || 0,
      ]
    );
    count++;
  }
  return count;
}

/**
 * Handler principal: event.confirmed
 */
export async function handleEventConfirmed(event: DomainEvent): Promise<void> {
  const payload = event.payload as unknown as EventConfirmedPayload;
  const { event_id, venue_type, pax, date } = payload;

  console.log(`[Handler] event.confirmed para evento ${event_id}`);
  console.log(`  Venue: ${venue_type}, Pax: ${pax}, Fecha: ${date}`);

<<<<<<< HEAD
  // 1. Verificar idempotencia: si ya hay templates, no duplicar
  const hasExisting = await hasExistingTemplates(event_id);
  if (hasExisting) {
    console.log(`[Handler] Evento ${event_id} ya tiene plantillas generadas. Saltando (idempotente).`);
    return;
  }

  // 2. Obtener plantillas desde configuración
  const allTemplates = await getEventTemplates();
  const venueTemplates = allTemplates[venue_type];

  if (!venueTemplates) {
    console.log(`[Handler] No hay plantillas definidas para venue_type '${venue_type}'.`);
    return;
  }

  // 3. Generar plantillas en una transacción
  await transaction(async (client) => {
    let totalItems = 0;

    // Para venue externo: logística, timing, packs
    if (venue_type === 'externo') {
      if (venueTemplates.logistics) {
        const count = await insertPlanItems(client, event_id, venueTemplates.logistics, date);
        console.log(`[Handler] ${count} items de logística creados`);
        totalItems += count;
      }

      if (venueTemplates.timing) {
        const count = await insertPlanItems(client, event_id, venueTemplates.timing, date);
        console.log(`[Handler] ${count} items de timing creados`);
        totalItems += count;
      }

      if (venueTemplates.packs) {
        const count = await insertPlanItems(client, event_id, venueTemplates.packs, date);
        console.log(`[Handler] ${count} items de packs creados`);
        totalItems += count;
      }

      // Centro APPCC Truck Externo (se inserta en event_plans con categoría especial)
      if (venueTemplates.appcc_center) {
        const appcc = venueTemplates.appcc_center;
        await client.query(
          `INSERT INTO event_plans (event_id, title, description, planned_time, category, sort_order, completed)
           VALUES ($1, $2, $3, $4, 'appcc', 99, false)`,
          [
            event_id,
            appcc.title,
            appcc.description || `Centre de control APPCC per a vehicle extern (${appcc.area})`,
            date ? new Date(date) : null,
          ]
        );
        console.log(`[Handler] Centro APPCC "${appcc.title}" creado`);
        totalItems++;
      }
    }

    // Para venue benitez: checklist y mapa de mesas
    if (venue_type === 'benitez') {
      if (venueTemplates.checklist) {
        const count = await insertChecklistItems(client, event_id, venueTemplates.checklist);
        console.log(`[Handler] ${count} items de checklist creados`);
        totalItems += count;
      }

      // Mapa de mesas base (se guarda como event_plan con categoría 'mapa_mesas')
      if (venueTemplates.table_map) {
        const tableMap = venueTemplates.table_map;
        await client.query(
          `INSERT INTO event_plans (event_id, title, description, planned_time, category, sort_order, completed)
           VALUES ($1, $2, $3, $4, 'mapa_mesas', 0, false)`,
          [
            event_id,
            'Mapa de mesas base - Saló Benítez',
            tableMap.description,
            null,
          ]
        );
        console.log(`[Handler] Mapa de mesas base creado para Saló Benítez`);
        totalItems++;
      }
    }

    console.log(`[Handler] Total: ${totalItems} items de plantilla creados para evento ${event_id}`);
  });
}
=======
  // Emit event.confirmed.staffing to trigger staffing generation (WP-17)
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await emitDomainEvent(
      client,
      'event.confirmed.staffing',
      'event',
      payload.event_id,
      {
        event_id: payload.event_id,
        venue_type: payload.venue_type,
        pax: payload.pax,
        date: payload.date
      }
    );
    await client.query('COMMIT');
    console.log(`[Handler] Emitted event.confirmed.staffing for event ${payload.event_id}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Handler] Failed to emit event.confirmed.staffing:', error);
    throw error;
  } finally {
    client.release();
  }

  // TODO: WP-15 - Generar plantillas automáticas por tipo de venue
}
>>>>>>> kurropl/wp17-staffing-turnos
