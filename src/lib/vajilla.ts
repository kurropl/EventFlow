/**
 * EventFlow — Motor de cálculo de necesidades de vajilla  ·  WP-20
 *
 * Calcula automáticamente las necesidades de vajilla basándose en:
 * - Número de pax del evento
 * - Número de pases del menú
 * - Plantilla de vajilla (configurable en BD)
 *
 * La vajilla se calcula por pase de servicio: cada comensal necesita
 * un juego completo de vajilla para cada pase que se sirve.
 *
 * Ejemplo: 100 pax × 5 pases = 500 juegos de vajilla por ítem
 */

import { queryMany, querySingle } from '@/lib/db';

export interface VajillaItem {
  name: string;
  category: string;
  quantity_per_pax: number;
  pass_number: number | null; // null = todos los pases
}

export interface VajillaPass {
  pass_number: number;
  pass_name: string;
  items: {
    name: string;
    category: string;
    total_quantity: number;
  }[];
}

export interface VajillaCalculation {
  event_id: string;
  event_name: string;
  pax: number;
  num_passes: number;
  template_name: string;
  /** Total de cada ítem (sumando todos los pases) */
  totals: {
    name: string;
    category: string;
    total_quantity: number;
  }[];
  /** Desglose por pase */
  by_pass: VajillaPass[];
}

/**
 * Calcula las necesidades de vajilla para un evento
 */
export async function calculateVajilla(eventId: string): Promise<VajillaCalculation | null> {
  // 1. Obtener datos del evento
  const event = await querySingle<any>(
    `SELECT id, client_name, guest_count, kids_count
     FROM events WHERE id = $1`,
    [eventId]
  );
  if (!event) return null;

  const pax = (Number(event.guest_count) || 0) + (Number(event.kids_count) || 0);
  if (pax === 0) return null;

  // 2. Obtener número de pases del evento
  // Usamos service_passes como fuente de verdad
  const passesResult = await queryMany<any>(
    `SELECT COUNT(*)::int as num_passes FROM service_passes`
  );
  const num_passes = passesResult[0]?.num_passes || 6; // Default: 6 pases estándar

  // 3. Obtener plantilla de vajilla activa
  const template = await querySingle<any>(
    `SELECT id, name FROM vajilla_templates WHERE active = true LIMIT 1`
  );
  if (!template) return null;

  // 4. Obtener ítems de la plantilla
  const items = await queryMany<VajillaItem>(
    `SELECT name, category, quantity_per_pax, pass_number
     FROM vajilla_template_items
     WHERE template_id = $1
     ORDER BY category, name`,
    [template.id]
  );

  // 5. Obtener información de pases para los nombres
  const passesInfo = await queryMany<any>(
    `SELECT pass_number, name FROM service_passes ORDER BY sort_order`
  );
  const passNames = new Map(passesInfo.map(p => [p.pass_number, p.name]));

  // 6. Calcular cantidades por pase
  const byPass: VajillaPass[] = [];
  const totalsMap = new Map<string, { name: string; category: string; total_quantity: number }>();

  // Para cada pase de servicio
  for (let passNum = 1; passNum <= num_passes; passNum++) {
    const passItems: { name: string; category: string; total_quantity: number }[] = [];

    for (const item of items) {
      // Si el ítem tiene pass_number asignado, solo aplica a ese pase
      // Si pass_number es null, aplica a todos los pases
      if (item.pass_number !== null && item.pass_number !== passNum) {
        continue;
      }

      const totalQuantity = pax * (item.quantity_per_pax || 1);

      passItems.push({
        name: item.name,
        category: item.category,
        total_quantity: totalQuantity,
      });

      // Acumular en totales
      const key = `${item.name}::${item.category}`;
      const existing = totalsMap.get(key);
      if (existing) {
        existing.total_quantity += totalQuantity;
      } else {
        totalsMap.set(key, {
          name: item.name,
          category: item.category,
          total_quantity: totalQuantity,
        });
      }
    }

    byPass.push({
      pass_number: passNum,
      pass_name: passNames.get(passNum) || `Pase ${passNum}`,
      items: passItems,
    });
  }

  return {
    event_id: eventId,
    event_name: event.client_name,
    pax,
    num_passes,
    template_name: template.name,
    totals: Array.from(totalsMap.values()),
    by_pass: byPass,
  };
}

/**
 * Genera ítems de vajilla para integrar en la hoja de carga
 * Retorna items en formato compatible con LoadingItem[]
 */
export async function generateVajillaLoadingItems(
  eventId: string
): Promise<{ productName: string; quantity: number; unit: string; perishable: boolean; category: string; passName: string }[]> {
  const calc = await calculateVajilla(eventId);
  if (!calc) return [];

  const items: { productName: string; quantity: number; unit: string; perishable: boolean; category: string; passName: string }[] = [];

  for (const pass of calc.by_pass) {
    for (const item of pass.items) {
      items.push({
        productName: `🍽️ ${item.name}`,
        quantity: item.total_quantity,
        unit: 'ud',
        perishable: false,
        category: `vajilla_${item.category}`,
        passName: pass.pass_name,
      });
    }
  }

  return items;
}
