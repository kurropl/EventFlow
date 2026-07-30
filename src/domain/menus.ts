/**
 * EventFlow — Menus Domain Service
 * CRUD de menús con estados, versionado inmutable y variantes.
 */

import type { PoolClient } from 'pg';
import { getPool, queryMany, querySingle } from '@/lib/db';
import { emitDomainEvent } from './events';

// ============================================================
// Types
// ============================================================

export interface Menu {
  id: string;
  name: string;
  version: number;
  status: 'borrador' | 'publicado' | 'pausado' | 'retirado';
  price_per_pax: number;
  description: string | null;
  parent_menu_id: string | null;
  cost_per_pax: number;
  margin_pct: number;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface MenuSection {
  id: string;
  menu_id: string;
  name: string;
  position: number;
  created_at: Date;
  updated_at: Date;
}

export interface MenuSectionDish {
  id: string;
  section_id: string;
  dish_id: string;
  variant_tag: string | null;
  position: number;
  notes: string | null;
  created_at: Date;
  // Joined fields
  dish_name?: string;
  dish_category?: string;
  dish_cost?: number;
  dish_pvp?: number;
}

export interface MenuWithSections extends Menu {
  sections: (MenuSection & { dishes: MenuSectionDish[] })[];
}

export interface EventMenu {
  id: string;
  event_id: string;
  menu_id: string;
  pax: number;
  price_snapshot: number;
  cost_snapshot: number | null;
  notes: string | null;
  created_at: Date;
  // Joined
  menu?: Menu;
}

export interface CreateMenuInput {
  name: string;
  price_per_pax: number;
  description?: string;
  sections?: CreateSectionInput[];
}

export interface UpdateMenuInput {
  name?: string;
  price_per_pax?: number;
  description?: string;
}

export interface CreateSectionInput {
  name: string;
  position: number;
  dishes?: CreateDishInput[];
}

export interface CreateDishInput {
  dish_id: string;
  variant_tag?: string;
  position: number;
  notes?: string;
}

// ============================================================
// Constants - Transiciones válidas de estado
// ============================================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  borrador: ['publicado', 'retirado'],
  publicado: ['pausado', 'retirado'],
  pausado: ['publicado', 'retirado'],
  retirado: [], // Estado final, no permite transiciones
};

// ============================================================
// Queries base
// ============================================================

const MENU_SELECT = `
  SELECT 
    m.id, m.name, m.version, m.status, m.price_per_pax, m.description,
    m.parent_menu_id, m.cost_per_pax, m.margin_pct,
    m.created_at, m.updated_at, m.created_by
  FROM menus m
`;

const SECTION_SELECT = `
  SELECT 
    ms.id, ms.menu_id, ms.name, ms.position,
    ms.created_at, ms.updated_at
  FROM menu_sections ms
`;

const DISH_SELECT = `
  SELECT 
    msd.id, msd.section_id, msd.dish_id, msd.variant_tag,
    msd.position, msd.notes, msd.created_at,
    ci.name as dish_name, ci.category as dish_category,
    ci.cost as dish_cost, ci.pvp as dish_pvp
  FROM menu_section_dishes msd
  LEFT JOIN catalog_items ci ON ci.id = msd.dish_id
`;

// ============================================================
// CRUD Operations
// ============================================================

/**
 * Obtiene todos los menús con filtros opcionales.
 */
export async function getMenus(filters?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ menus: Menu[]; total: number }> {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (filters?.status) {
    conditions.push(`m.status = $${paramIdx++}`);
    params.push(filters.status);
  }

  if (filters?.search) {
    conditions.push(`m.name ILIKE $${paramIdx++}`);
    params.push(`%${filters.search}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total
  const countResult = await querySingle<{ count: number }>(
    `SELECT count(*) as count FROM menus m ${where}`,
    params
  );
  const total = countResult?.count || 0;

  // Get menus
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;

  const menus = await queryMany<Menu>(
    `${MENU_SELECT} ${where} ORDER BY m.created_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
    [...params, limit, offset]
  );

  return { menus, total };
}

/**
 * Obtiene un menú por ID con sus secciones y platos.
 */
export async function getMenuById(id: string): Promise<MenuWithSections | null> {
  // Get menu
  const menu = await querySingle<Menu>(
    `${MENU_SELECT} WHERE m.id = $1`,
    [id]
  );

  if (!menu) return null;

  // Get sections
  const sections = await queryMany<MenuSection>(
    `${SECTION_SELECT} WHERE ms.menu_id = $1 ORDER BY ms.position`,
    [id]
  );

  // Get dishes for each section
  const sectionsWithDishes = await Promise.all(
    sections.map(async (section) => {
      const dishes = await queryMany<MenuSectionDish>(
        `${DISH_SELECT} WHERE msd.section_id = $1 ORDER BY msd.position`,
        [section.id]
      );
      return { ...section, dishes };
    })
  );

  return { ...menu, sections: sectionsWithDishes };
}

/**
 * Obtiene menús publicados para el endpoint público.
 */
export async function getPublishedMenus(): Promise<Menu[]> {
  return queryMany<Menu>(
    `${MENU_SELECT} WHERE m.status = 'publicado' ORDER BY m.price_per_pax ASC`
  );
}

/**
 * Crea un nuevo menú (siempre en estado 'borrador').
 */
export async function createMenu(
  input: CreateMenuInput,
  userId: string,
  client?: PoolClient
): Promise<Menu> {
  const executor = client || getPool();

  const result = await executor.query<{ id: string }>(
    `INSERT INTO menus (name, price_per_pax, description, status, created_by)
     VALUES ($1, $2, $3, 'borrador', $4)
     RETURNING id`,
    [input.name, input.price_per_pax, input.description || null, userId]
  );

  const menuId = result.rows[0].id;

  // Create sections if provided
  if (input.sections && input.sections.length > 0) {
    for (const sectionInput of input.sections) {
      await createSection(menuId, sectionInput, client);
    }
  }

  // Recalculate cost after creating sections
  await recalculateMenuCost(menuId, client);

  return querySingle<Menu>(
    `${MENU_SELECT} WHERE m.id = $1`,
    [menuId]
  ) as Promise<Menu>;
}

/**
 * Actualiza un menú. Si está publicado y tiene eventos vinculados, clona a versión+1.
 */
export async function updateMenu(
  id: string,
  input: UpdateMenuInput,
  userId: string
): Promise<Menu> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current menu
    const currentMenu = await querySingle<Menu>(
      `${MENU_SELECT} WHERE m.id = $1`,
      [id]
    );

    if (!currentMenu) {
      throw new Error('Menú no encontrado');
    }

    // Check if menu has linked events
    const hasLinkedEvents = await querySingle<{ exists: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM event_menus WHERE menu_id = $1) as exists`,
      [id]
    );

    // If published and has linked events → clone to new version
    if (currentMenu.status === 'publicado' && hasLinkedEvents?.exists) {
      const newVersion = await cloneMenuToNewVersion(
        id,
        input,
        userId,
        client
      );
      await client.query('COMMIT');
      return newVersion;
    }

    // Otherwise, update in place (only if borrador)
    if (currentMenu.status !== 'borrador') {
      throw new Error('Solo se pueden editar menús en estado borrador');
    }

    const updates: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      params.push(input.name);
    }
    if (input.price_per_pax !== undefined) {
      updates.push(`price_per_pax = $${paramIdx++}`);
      params.push(input.price_per_pax);
    }
    if (input.description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      params.push(input.description);
    }

    if (updates.length > 0) {
      params.push(id);
      await client.query(
        `UPDATE menus SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
        params
      );
    }

    await client.query('COMMIT');

    return querySingle<Menu>(
      `${MENU_SELECT} WHERE m.id = $1`,
      [id]
    ) as Promise<Menu>;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cambia el estado de un menú (con validación de transiciones).
 */
export async function transitionMenuStatus(
  id: string,
  newStatus: string,
  userId: string
): Promise<Menu> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get current menu
    const currentMenu = await querySingle<Menu>(
      `${MENU_SELECT} WHERE m.id = $1 FOR UPDATE`,
      [id]
    );

    if (!currentMenu) {
      throw new Error('Menú no encontrado');
    }

    // Validate transition
    const validNext = VALID_TRANSITIONS[currentMenu.status] || [];
    if (!validNext.includes(newStatus)) {
      throw new Error(
        `Transición inválida: ${currentMenu.status} → ${newStatus}. Permitidos: ${validNext.join(', ')}`
      );
    }

    // Update status
    await client.query(
      `UPDATE menus SET status = $1 WHERE id = $2`,
      [newStatus, id]
    );

    // Emit domain event if publishing
    if (newStatus === 'publicado') {
      await emitDomainEvent(
        client,
        'menu.published',
        'menu',
        id,
        {
          menu_id: id,
          version: currentMenu.version,
          name: currentMenu.name,
          price_per_pax: currentMenu.price_per_pax,
        }
      );
    }

    await client.query('COMMIT');

    return querySingle<Menu>(
      `${MENU_SELECT} WHERE m.id = $1`,
      [id]
    ) as Promise<Menu>;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Elimina un menú (solo si es borrador y no tiene eventos vinculados).
 */
export async function deleteMenu(id: string): Promise<boolean> {
  // Check if has linked events
  const hasLinkedEvents = await querySingle<{ exists: boolean }>(
    `SELECT EXISTS(SELECT 1 FROM event_menus WHERE menu_id = $1) as exists`,
    [id]
  );

  if (hasLinkedEvents?.exists) {
    throw new Error('No se puede eliminar un menú con eventos vinculados');
  }

  // Get menu status
  const menu = await querySingle<Menu>(
    `SELECT status FROM menus WHERE id = $1`,
    [id]
  );

  if (menu && menu.status !== 'borrador') {
    throw new Error('Solo se pueden eliminar menús en estado borrador');
  }

  const result = await getPool().query(
    `DELETE FROM menus WHERE id = $1`,
    [id]
  );

  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// Sections CRUD
// ============================================================

/**
 * Crea una sección en un menú.
 */
export async function createSection(
  menuId: string,
  input: CreateSectionInput,
  client?: PoolClient
): Promise<MenuSection> {
  const executor = client || getPool();

  const result = await executor.query<{ id: string }>(
    `INSERT INTO menu_sections (menu_id, name, position)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [menuId, input.name, input.position]
  );

  const sectionId = result.rows[0].id;

  // Create dishes if provided
  if (input.dishes && input.dishes.length > 0) {
    for (const dishInput of input.dishes) {
      await createSectionDish(sectionId, dishInput, client);
    }
  }

  return querySingle<MenuSection>(
    `${SECTION_SELECT} WHERE ms.id = $1`,
    [sectionId]
  ) as Promise<MenuSection>;
}

/**
 * Actualiza una sección.
 */
export async function updateSection(
  id: string,
  input: { name?: string; position?: number }
): Promise<MenuSection> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIdx++}`);
    params.push(input.name);
  }
  if (input.position !== undefined) {
    updates.push(`position = $${paramIdx++}`);
    params.push(input.position);
  }

  if (updates.length > 0) {
    params.push(id);
    await getPool().query(
      `UPDATE menu_sections SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      params
    );
  }

  return querySingle<MenuSection>(
    `${SECTION_SELECT} WHERE ms.id = $1`,
    [id]
  ) as Promise<MenuSection>;
}

/**
 * Elimina una sección.
 */
export async function deleteSection(id: string): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM menu_sections WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// Dishes CRUD
// ============================================================

/**
 * Añade un plato a una sección.
 */
export async function createSectionDish(
  sectionId: string,
  input: CreateDishInput,
  client?: PoolClient
): Promise<MenuSectionDish> {
  const executor = client || getPool();

  const result = await executor.query<{ id: string }>(
    `INSERT INTO menu_section_dishes (section_id, dish_id, variant_tag, position, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [sectionId, input.dish_id, input.variant_tag || null, input.position, input.notes || null]
  );

  return querySingle<MenuSectionDish>(
    `${DISH_SELECT} WHERE msd.id = $1`,
    [result.rows[0].id]
  ) as Promise<MenuSectionDish>;
}

/**
 * Actualiza un plato en una sección.
 */
export async function updateSectionDish(
  id: string,
  input: { variant_tag?: string; position?: number; notes?: string }
): Promise<MenuSectionDish> {
  const updates: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (input.variant_tag !== undefined) {
    updates.push(`variant_tag = $${paramIdx++}`);
    params.push(input.variant_tag);
  }
  if (input.position !== undefined) {
    updates.push(`position = $${paramIdx++}`);
    params.push(input.position);
  }
  if (input.notes !== undefined) {
    updates.push(`notes = $${paramIdx++}`);
    params.push(input.notes);
  }

  if (updates.length > 0) {
    params.push(id);
    await getPool().query(
      `UPDATE menu_section_dishes SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      params
    );
  }

  return querySingle<MenuSectionDish>(
    `${DISH_SELECT} WHERE msd.id = $1`,
    [id]
  ) as Promise<MenuSectionDish>;
}

/**
 * Elimina un plato de una sección.
 */
export async function deleteSectionDish(id: string): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM menu_section_dishes WHERE id = $1`,
    [id]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// Event Menus (Vinculación evento-menú)
// ============================================================

/**
 * Vincula un menú a un evento (con precio y coste congelados).
 */
export async function linkMenuToEvent(
  eventId: string,
  menuId: string,
  pax: number,
  notes?: string
): Promise<EventMenu> {
  // Get menu to snapshot price and cost
  const menu = await querySingle<Menu>(
    `${MENU_SELECT} WHERE m.id = $1 AND m.status = 'publicado'`,
    [menuId]
  );

  if (!menu) {
    throw new Error('Solo se pueden vincular menús publicados');
  }

  const result = await getPool().query<{ id: string }>(
    `INSERT INTO event_menus (event_id, menu_id, pax, price_snapshot, cost_snapshot, notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (event_id, menu_id) DO UPDATE
     SET pax = $3, price_snapshot = $4, cost_snapshot = $5, notes = $6
     RETURNING id`,
    [eventId, menuId, pax, menu.price_per_pax, menu.cost_per_pax, notes || null]
  );

  return querySingle<EventMenu>(
    `SELECT em.*, 
      json_build_object(
        'id', m.id, 'name', m.name, 'version', m.version,
        'status', m.status, 'price_per_pax', m.price_per_pax
      ) as menu
    FROM event_menus em
    JOIN menus m ON m.id = em.menu_id
    WHERE em.id = $1`,
    [result.rows[0].id]
  ) as Promise<EventMenu>;
}

/**
 * Obtiene los menús vinculados a un evento.
 */
export async function getEventMenus(eventId: string): Promise<EventMenu[]> {
  return queryMany<EventMenu>(
    `SELECT em.*,
      json_build_object(
        'id', m.id, 'name', m.name, 'version', m.version,
        'status', m.status, 'price_per_pax', m.price_per_pax,
        'cost_per_pax', m.cost_per_pax
      ) as menu
    FROM event_menus em
    JOIN menus m ON m.id = em.menu_id
    WHERE em.event_id = $1
    ORDER BY em.created_at`,
    [eventId]
  );
}

/**
 * Desvincula un menú de un evento.
 */
export async function unlinkMenuFromEvent(
  eventId: string,
  menuId: string
): Promise<boolean> {
  const result = await getPool().query(
    `DELETE FROM event_menus WHERE event_id = $1 AND menu_id = $2`,
    [eventId, menuId]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================================
// Cost Calculation
// ============================================================

/**
 * Recalcula el coste y margen de un menú basándose en el coste de sus platos.
 */
export async function recalculateMenuCost(
  menuId: string,
  client?: PoolClient
): Promise<void> {
  const executor = client || getPool();

  // Get sum of dish costs for this menu
  const costResult = await executor.query<{ total_cost: number }>(
    `SELECT COALESCE(SUM(ci.cost), 0) as total_cost
     FROM menu_section_dishes msd
     JOIN menu_sections ms ON ms.id = msd.section_id
     JOIN catalog_items ci ON ci.id = msd.dish_id
     WHERE ms.menu_id = $1`,
    [menuId]
  );

  const totalDishCost = costResult.rows[0]?.total_cost || 0;

  // Get menu price
  const menu = await querySingle<Menu>(
    `SELECT price_per_pax FROM menus WHERE id = $1`,
    [menuId]
  );

  if (!menu) return;

  // Calculate cost per pax (assuming dishes are for 1 pax each section)
  // In a real scenario, this might be divided by expected pax
  const costPerPax = totalDishCost;

  // Calculate margin: (price - cost) / price * 100
  const marginPct = menu.price_per_pax > 0
    ? ((menu.price_per_pax - costPerPax) / menu.price_per_pax) * 100
    : 0;

  await executor.query(
    `UPDATE menus SET cost_per_pax = $1, margin_pct = $2 WHERE id = $3`,
    [costPerPax, Math.round(marginPct * 100) / 100, menuId]
  );
}

// ============================================================
// Helpers
// ============================================================

/**
 * Clona un menú a una nueva versión (para versionado inmutable).
 */
async function cloneMenuToNewVersion(
  sourceMenuId: string,
  updates: UpdateMenuInput,
  userId: string,
  client: PoolClient
): Promise<Menu> {
  // Get source menu
  const sourceMenu = await querySingle<Menu>(
    `${MENU_SELECT} WHERE m.id = $1`,
    [sourceMenuId]
  );

  if (!sourceMenu) {
    throw new Error('Menú origen no encontrado');
  }

  // Create new menu with version + 1
  const newVersion = sourceMenu.version + 1;
  const result = await client.query<{ id: string }>(
    `INSERT INTO menus (
      name, version, status, price_per_pax, description,
      parent_menu_id, cost_per_pax, margin_pct, created_by
    ) VALUES ($1, $2, 'borrador', $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      updates.name || sourceMenu.name,
      newVersion,
      updates.price_per_pax ?? sourceMenu.price_per_pax,
      updates.description !== undefined ? updates.description : sourceMenu.description,
      sourceMenuId,
      sourceMenu.cost_per_pax,
      sourceMenu.margin_pct,
      userId,
    ]
  );

  const newMenuId = result.rows[0].id;

  // Copy sections and dishes
  const sections = await queryMany<MenuSection>(
    `${SECTION_SELECT} WHERE ms.menu_id = $1 ORDER BY ms.position`,
    [sourceMenuId]
  );

  for (const section of sections) {
    // Create section
    const newSectionResult = await client.query<{ id: string }>(
      `INSERT INTO menu_sections (menu_id, name, position)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [newMenuId, section.name, section.position]
    );
    const newSectionId = newSectionResult.rows[0].id;

    // Copy dishes
    const dishes = await queryMany<MenuSectionDish>(
      `${DISH_SELECT} WHERE msd.section_id = $1 ORDER BY msd.position`,
      [section.id]
    );

    for (const dish of dishes) {
      await client.query(
        `INSERT INTO menu_section_dishes (section_id, dish_id, variant_tag, position, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [newSectionId, dish.dish_id, dish.variant_tag, dish.position, dish.notes]
      );
    }
  }

  return querySingle<Menu>(
    `${MENU_SELECT} WHERE m.id = $1`,
    [newMenuId]
  ) as Promise<Menu>;
}

/**
 * Obtiene el historial de versiones de un menú.
 */
export async function getMenuVersionHistory(name: string): Promise<Menu[]> {
  return queryMany<Menu>(
    `${MENU_SELECT} WHERE m.name = $1 ORDER BY m.version DESC`,
    [name]
  );
}
