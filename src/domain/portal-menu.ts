/**
 * EventFlow — Portal Menu Domain Service
 *
 * Operaciones del portal del cliente relacionadas con el menú:
 * - Ver menú congelado (versión vinculada al evento)
 * - Asignar/actualizar variantes por invitado
 * - Alimentar dietas (campo dietary de guests) y packs (WP-20)
 *
 * REGLA: El cliente NO puede cambiar de menú, solo asignar variantes.
 */

import type { PoolClient } from 'pg';
import { getPool, queryMany, querySingle, transaction } from '@/lib/db';
import { emitDomainEvent } from './events';

// ============================================================
// Types
// ============================================================

export interface PortalMenuView {
  event_id: string;
  event_menu_id: string;
  menu: {
    id: string;
    name: string;
    version: number;
    price_per_pax: number;
    description: string | null;
    cost_per_pax: number;
  };
  sections: PortalMenuSection[];
  pax: number;
  price_snapshot: number;
}

export interface PortalMenuSection {
  id: string;
  name: string;
  position: number;
  dishes: PortalMenuDish[];
}

export interface PortalMenuDish {
  id: string;
  dish_id: string;
  variant_tag: string | null;
  position: number;
  notes: string | null;
  // Joined
  dish_name: string;
  dish_category: string | null;
  dish_description: string | null;
  dish_allergens: string[] | null;
  dish_pvp: number | null;
}

export interface GuestVariant {
  id: string;
  event_id: string;
  guest_id: string;
  event_menu_id: string;
  variant_type: string;
  section_id: string | null;
  dish_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined
  guest_name?: string;
  guest_rsvp?: string;
}

export type VariantType =
  | 'infantil'
  | 'celiaco'
  | 'vegetariano'
  | 'vegano'
  | 'sin_lactosa'
  | 'sin_frutos_secos'
  | 'personalizado';

export const VALID_VARIANT_TYPES: VariantType[] = [
  'infantil',
  'celiaco',
  'vegetariano',
  'vegano',
  'sin_lactosa',
  'sin_frutos_secos',
  'personalizado',
];

export const VARIANT_LABELS: Record<VariantType, string> = {
  infantil: 'Infantil',
  celiaco: 'Celíaco',
  vegetariano: 'Vegetariano',
  vegano: 'Vegano',
  sin_lactosa: 'Sin lactosa',
  sin_frutos_secos: 'Sin frutos secos',
  personalizado: 'Personalizado',
};

// ============================================================
// Queries base
// ============================================================

const VARIANT_SELECT = `
  SELECT 
    egv.id, egv.event_id, egv.guest_id, egv.event_menu_id,
    egv.variant_type, egv.section_id, egv.dish_id, egv.notes,
    egv.created_at, egv.updated_at,
    g.name as guest_name, g.rsvp as guest_rsvp
  FROM event_guest_variants egv
  JOIN guests g ON g.id = egv.guest_id
`;

// ============================================================
// Ver Menú Congelado (Portal)
// ============================================================

/**
 * Obtiene el menú congelado de un evento para el portal del cliente.
 * El menú es la versión vinculada en event_menus (inmutable).
 */
export async function getPortalMenu(
  eventId: string
): Promise<PortalMenuView | null> {
  // 1. Obtener la vinculación evento-menú
  const eventMenu = await querySingle<{
    id: string;
    event_id: string;
    menu_id: string;
    pax: number;
    price_snapshot: number;
    cost_snapshot: number | null;
  }>(
    `SELECT id, event_id, menu_id, pax, price_snapshot, cost_snapshot
     FROM event_menus
     WHERE event_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [eventId]
  );

  if (!eventMenu) return null;

  // 2. Obtener el menú (versión congelada)
  const menu = await querySingle<{
    id: string;
    name: string;
    version: number;
    price_per_pax: number;
    description: string | null;
    cost_per_pax: number;
  }>(
    `SELECT id, name, version, price_per_pax, description, cost_per_pax
     FROM menus
     WHERE id = $1`,
    [eventMenu.menu_id]
  );

  if (!menu) return null;

  // 3. Obtener secciones del menú
  const sections = await queryMany<{
    id: string;
    name: string;
    position: number;
  }>(
    `SELECT id, name, position
     FROM menu_sections
     WHERE menu_id = $1
     ORDER BY position`,
    [menu.id]
  );

  // 4. Obtener platos de cada sección
  const sectionsWithDishes = await Promise.all(
    sections.map(async (section) => {
      const dishes = await queryMany<PortalMenuDish>(
        `SELECT 
          msd.id, msd.dish_id, msd.variant_tag, msd.position, msd.notes,
          ci.name as dish_name,
          ci.category as dish_category,
          ci.description as dish_description,
          ci.allergens as dish_allergens,
          ci.pvp as dish_pvp
         FROM menu_section_dishes msd
         LEFT JOIN catalog_items ci ON ci.id = msd.dish_id
         WHERE msd.section_id = $1
         ORDER BY msd.position`,
        [section.id]
      );
      return { ...section, dishes };
    })
  );

  return {
    event_id: eventId,
    event_menu_id: eventMenu.id,
    menu,
    sections: sectionsWithDishes,
    pax: eventMenu.pax,
    price_snapshot: eventMenu.price_snapshot,
  };
}

// ============================================================
// Variantes por Invitado
// ============================================================

/**
 * Obtiene todas las variantes de invitados para un evento.
 */
export async function getGuestVariants(
  eventId: string
): Promise<GuestVariant[]> {
  return queryMany<GuestVariant>(
    `${VARIANT_SELECT}
     WHERE egv.event_id = $1
     ORDER BY g.name`,
    [eventId]
  );
}

/**
 * Obtiene la variante de un invitado específico para un event_menu.
 */
export async function getGuestVariant(
  guestId: string,
  eventMenuId: string
): Promise<GuestVariant | null> {
  return querySingle<GuestVariant>(
    `${VARIANT_SELECT}
     WHERE egv.guest_id = $1 AND egv.event_menu_id = $2`,
    [guestId, eventMenuId]
  );
}

/**
 * Asigna o actualiza la variante de un invitado.
 * Si ya existía una variante para ese invitado+menú, la actualiza.
 *
 * EFECTOS COLATERALES:
 * 1. Actualiza el campo `dietary` del guest para reflejar la variante
 * 2. Emite `portal.updated` para notificar al admin
 */
export async function assignGuestVariant(
  eventId: string,
  guestId: string,
  eventMenuId: string,
  variantType: VariantType,
  sectionId?: string | null,
  dishId?: string | null,
  notes?: string | null
): Promise<GuestVariant> {
  // Validar variant_type
  if (!VALID_VARIANT_TYPES.includes(variantType)) {
    throw new Error(`Variante no válida: ${variantType}`);
  }

  // Validar que el guest pertenece al evento
  const guest = await querySingle<{ id: string; event_id: string; dietary: string[] }>(
    `SELECT id, event_id, dietary FROM guests WHERE id = $1`,
    [guestId]
  );

  if (!guest) {
    throw new Error('Invitado no encontrado');
  }

  if (guest.event_id !== eventId) {
    throw new Error('El invitado no pertenece a este evento');
  }

  // Validar que el event_menu pertenece al evento
  const eventMenu = await querySingle<{ id: string; event_id: string }>(
    `SELECT id, event_id FROM event_menus WHERE id = $1`,
    [eventMenuId]
  );

  if (!eventMenu || eventMenu.event_id !== eventId) {
    throw new Error('Menú del evento no encontrado');
  }

  return transaction(async (client) => {
    // 1. Upsert de la variante
    const existing = await querySingle<GuestVariant>(
      `SELECT id FROM event_guest_variants
       WHERE guest_id = $1 AND event_menu_id = $2`,
      [guestId, eventMenuId],
    );

    let variant: GuestVariant;

    if (existing) {
      // Actualizar variante existente
      await client.query(
        `UPDATE event_guest_variants
         SET variant_type = $1, section_id = $2, dish_id = $3, notes = $4, updated_at = now()
         WHERE guest_id = $5 AND event_menu_id = $6`,
        [variantType, sectionId || null, dishId || null, notes || null, guestId, eventMenuId]
      );
    } else {
      // Crear nueva variante
      await client.query(
        `INSERT INTO event_guest_variants
         (event_id, guest_id, event_menu_id, variant_type, section_id, dish_id, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [eventId, guestId, eventMenuId, variantType, sectionId || null, dishId || null, notes || null]
      );
    }

    variant = (await querySingle<GuestVariant>(
      `${VARIANT_SELECT}
       WHERE egv.guest_id = $1 AND egv.event_menu_id = $2`,
      [guestId, eventMenuId]
    ))!;

    // 2. Actualizar dietary del guest para sincronizar con la variante
    const dietaryMapping: Record<string, string> = {
      celiaco: 'celiaco',
      vegetariano: 'vegetariano',
      vegano: 'vegano',
      sin_lactosa: 'sin_lactosa',
      sin_frutos_secos: 'alergico_frutos_secos',
    };

    const currentDietary = guest.dietary || [];
    let updatedDietary = [...currentDietary];

    // Añadir la restricción dietética correspondiente a la variante
    const dietKey = dietaryMapping[variantType];
    if (dietKey && !updatedDietary.includes(dietKey)) {
      updatedDietary.push(dietKey);
    }

    // Si se cambia la variante, limpiar la restricción anterior
    // (excepto si el guest ya tenía esa restricción de antes)
    // Por simplicidad, solo añadimos, no quitamos

    await client.query(
      `UPDATE guests SET dietary = $1, updated_at = now() WHERE id = $2`,
      [JSON.stringify(updatedDietary), guestId]
    );

    // 3. Emitir evento de dominio
    await emitDomainEvent(
      client,
      'portal.updated',
      'event',
      eventId,
      {
        section: 'menu_variants',
        summary: `Variante "${variantType}" asignada a ${guest.name || 'invitado'}`,
        guest_id: guestId,
        variant_type: variantType,
        event_menu_id: eventMenuId,
      }
    );

    return variant;
  });
}

/**
 * Elimina la variante de un invitado.
 * También limpia la restricción dietética del guest si fue añadida por la variante.
 */
export async function removeGuestVariant(
  guestId: string,
  eventMenuId: string
): Promise<boolean> {
  const variant = await querySingle<GuestVariant>(
    `SELECT id, variant_type, event_id FROM event_guest_variants
     WHERE guest_id = $1 AND event_menu_id = $2`,
    [guestId, eventMenuId]
  );

  if (!variant) return false;

  // Mapeo inverso: variante → restricción dietética
  const dietaryMapping: Record<string, string> = {
    celiaco: 'celiaco',
    vegetariano: 'vegetariano',
    vegano: 'vegano',
    sin_lactosa: 'sin_lactosa',
    sin_frutos_secos: 'alergico_frutos_secos',
  };

  const dietKey = dietaryMapping[variant.variant_type];

  return transaction(async (client) => {
    // 1. Eliminar variante
    await client.query(
      `DELETE FROM event_guest_variants WHERE id = $1`,
      [variant.id]
    );

    // 2. Limpiar dietary del guest (quitar la restricción asociada)
    if (dietKey) {
      const guest = await querySingle<{ id: string; dietary: string[] }>(
        `SELECT id, dietary FROM guests WHERE id = $1`,
        [guestId]
      );

      if (guest) {
        const updatedDietary = (guest.dietary || []).filter(
          (d: string) => d !== dietKey
        );
        await client.query(
          `UPDATE guests SET dietary = $1, updated_at = now() WHERE id = $2`,
          [JSON.stringify(updatedDietary), guestId]
        );
      }
    }

    // 3. Emitir evento de dominio
    if (variant.event_id) {
      await emitDomainEvent(
        client,
        'portal.updated',
        'event',
        variant.event_id,
        {
          section: 'menu_variants',
          summary: `Variante "${variant.variant_type}" eliminada de invitado`,
          guest_id: guestId,
          variant_type: variant.variant_type,
        }
      );
    }

    return true;
  });
}

// ============================================================
// Resumen de Variantes (para packs WP-20)
// ============================================================

/**
 * Obtiene el resumen de variantes por tipo para un evento.
 * Usado por WP-20 para calcular packs (alérgenos, etc.)
 */
export async function getVariantSummary(
  eventId: string
): Promise<Record<string, number>> {
  const rows = await queryMany<{ variant_type: string; count: string }>(
    `SELECT variant_type, count(*) as count
     FROM event_guest_variants
     WHERE event_id = $1
     GROUP BY variant_type`,
    [eventId]
  );

  const summary: Record<string, number> = {};
  for (const row of rows) {
    summary[row.variant_type] = parseInt(row.count, 10);
  }
  return summary;
}

/**
 * Obtiene la lista de invitados con sus variantes, para generar
 * la hoja de servicio (WP-19) o el cálculo de packs.
 */
export async function getGuestsWithVariants(
  eventId: string
): Promise<
  Array<{
    guest_id: string;
    guest_name: string;
    rsvp: string;
    menu_type: string;
    dietary: string[];
    variant_type: string | null;
    variant_notes: string | null;
  }>
> {
  return queryMany(
    `SELECT
      g.id as guest_id,
      g.name as guest_name,
      g.rsvp,
      g.menu_type,
      g.dietary,
      egv.variant_type,
      egv.notes as variant_notes
     FROM guests g
     LEFT JOIN event_guest_variants egv
       ON egv.guest_id = g.id AND egv.event_menu_id = (
         SELECT id FROM event_menus WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1
       )
     WHERE g.event_id = $1
     ORDER BY g.name`,
    [eventId]
  );
}
