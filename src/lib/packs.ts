/**
 * EventFlow — Motor de cálculo de packs de operaciones  ·  WP-20
 *
 * Calcula automáticamente los packs necesarios para un evento:
 * - Pack Camareros: equipamiento para el personal de sala
 * - Pack Alérgenos: ítems especiales para invitados con restricciones
 * - Pack Supervivencia: kit de emergencia
 *
 * Los packs se generan basándose en:
 * - Plantillas configurables en BD
 * - Información de dietas de los invitados
 * - Número de camareros calculado
 */

import { queryMany, querySingle } from '@/lib/db';
import { calcCamareros, type ServiceType } from '@/lib/operations';

export interface PackItem {
  name: string;
  category: string;
  quantity_per_unit: number;
  condition_type: string; // 'all' | 'dietary'
  condition_value: string | null;
}

export interface PackCalculation {
  event_id: string;
  event_name: string;
  pax: number;
  num_camareros: number;
  packs: {
    pack_type: 'camareros' | 'alergenos' | 'supervivencia';
    pack_name: string;
    description: string;
    total_items: number;
    items: {
      name: string;
      category: string;
      quantity: number;
      notes: string | null;
    }[];
  }[];
}

/**
 * Calcula los packs necesarios para un evento
 */
export async function calculatePacks(eventId: string): Promise<PackCalculation | null> {
  // 1. Obtener datos del evento
  const event = await querySingle<any>(
    `SELECT id, client_name, guest_count, kids_count, event_type
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (!event) return null;

  const pax = (Number(event.guest_count) || 0) + (Number(event.kids_count) || 0);
  const serviceType: ServiceType = event.event_type === 'coctel' || event.event_type === 'coctel-cena' ? 'coctel' : 'menu';

  // 2. Calcular número de camareros
  const numCamareros = calcCamareros(pax, serviceType);

  // 3. Obtener información de dietas de los invitados
  const guests = await queryMany<any>(
    `SELECT dietary FROM guests WHERE event_id = $1 AND status = 'confirmado'`,
    [eventId]
  );

  // Contar invitados por tipo de restricción
  const dietaryCounts = new Map<string, number>();
  for (const guest of guests) {
    const dietary = guest.dietary;
    if (Array.isArray(dietary)) {
      for (const restriction of dietary) {
        if (typeof restriction === 'string') {
          dietaryCounts.set(restriction, (dietaryCounts.get(restriction) || 0) + 1);
        }
      }
    }
  }

  // 4. Obtener plantillas de packs activas
  const templates = await queryMany<any>(
    `SELECT id, name, pack_type, description FROM pack_templates WHERE active = true`
  );

  const packs: PackCalculation['packs'] = [];

  // 5. Calcular cada pack
  for (const template of templates) {
    // Obtener ítems de la plantilla
    const items = await queryMany<PackItem>(
      `SELECT name, category, quantity_per_unit, condition_type, condition_value
       FROM pack_template_items
       WHERE template_id = $1
       ORDER BY category, name`,
      [template.id]
    );

    const packItems: { name: string; category: string; quantity: number; notes: string | null }[] = [];
    let totalItems = 0;

    for (const item of items) {
      let quantity = 0;
      let applicable = false;

      if (item.condition_type === 'all') {
        // Aplica a todos (camareros o pax según el pack)
        quantity = item.quantity_per_unit * (template.pack_type === 'camareros' ? numCamareros : pax);
        applicable = true;
      } else if (item.condition_type === 'dietary' && item.condition_value) {
        // Aplica solo si hay invitados con esa restricción
        const count = dietaryCounts.get(item.condition_value) || 0;
        if (count > 0) {
          quantity = item.quantity_per_unit * count;
          applicable = true;
        }
      }

      if (applicable && quantity > 0) {
        // Buscar notas del item
        const itemWithNotes = await querySingle<any>(
          `SELECT notes FROM pack_template_items WHERE name = $1 AND template_id = $2 LIMIT 1`,
          [item.name, template.id]
        );

        packItems.push({
          name: item.name,
          category: item.category,
          quantity,
          notes: itemWithNotes?.notes || null,
        });
        totalItems += quantity;
      }
    }

    packs.push({
      pack_type: template.pack_type,
      pack_name: template.name,
      description: template.description,
      total_items: totalItems,
      items: packItems,
    });
  }

  return {
    event_id: eventId,
    event_name: event.client_name,
    pax,
    num_camareros: numCamareros,
    packs,
  };
}

/**
 * Genera ítems de packs para integrar en la hoja de carga
 */
export async function generatePackLoadingItems(
  eventId: string
): Promise<{ productName: string; quantity: number; unit: string; perishable: boolean; category: string; notes: string | null }[]> {
  const calc = await calculatePacks(eventId);
  if (!calc) return [];

  const items: { productName: string; quantity: number; unit: string; perishable: boolean; category: string; notes: string | null }[] = [];

  for (const pack of calc.packs) {
    for (const item of pack.items) {
      items.push({
        productName: `📦 [${pack.pack_name}] ${item.name}`,
        quantity: item.quantity,
        unit: 'ud',
        perishable: false,
        category: `pack_${pack.pack_type}_${item.category}`,
        notes: item.notes,
      });
    }
  }

  return items;
}

/**
 * Resumen de restricciones dietarias del evento (para UI)
 */
export async function getEventDietarySummary(eventId: string): Promise<{
  total_guests: number;
  with_restrictions: number;
  restrictions: { type: string; count: number }[];
} | null> {
  const guests = await queryMany<any>(
    `SELECT dietary FROM guests WHERE event_id = $1 AND status = 'confirmado'`,
    [eventId]
  );

  if (guests.length === 0) return null;

  const dietaryCounts = new Map<string, number>();
  let withRestrictions = 0;

  for (const guest of guests) {
    const dietary = guest.dietary;
    if (Array.isArray(dietary) && dietary.length > 0) {
      withRestrictions++;
      for (const restriction of dietary) {
        if (typeof restriction === 'string') {
          dietaryCounts.set(restriction, (dietaryCounts.get(restriction) || 0) + 1);
        }
      }
    }
  }

  return {
    total_guests: guests.length,
    with_restrictions: withRestrictions,
    restrictions: Array.from(dietaryCounts.entries()).map(([type, count]) => ({
      type,
      count,
    })).sort((a, b) => b.count - a.count),
  };
}
