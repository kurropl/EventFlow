/**
 * EventFlow — WP-12 Menus Tests
 * Tests para la entidad Menú con estados, versionado y variantes.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { querySingle, queryMany, getPool } from '../src/lib/db';
import {
  getMenuById,
  getMenus,
  createMenu,
  updateMenu,
  deleteMenu,
  transitionMenuStatus,
  createSection,
  createSectionDish,
  getPublishedMenus,
  getMenuVersionHistory,
  recalculateMenuCost,
} from '../src/domain/menus';

// ============================================================
// Test Data
// ============================================================

let testMenuId: string;
let testSectionId: string;
let testDishId: string;
let testCatalogItemId: string;

const testUserId = '00000000-0000-0000-0000-000000000000';

// ============================================================
// Setup & Teardown
// ============================================================

beforeAll(async () => {
  // Get a catalog item to use in tests
  const catalogItem = await querySingle<{ id: string }>(
    `SELECT id FROM catalog_items WHERE active = true LIMIT 1`
  );
  testCatalogItemId = catalogItem?.id || '';
  
  if (!testCatalogItemId) {
    console.warn('No catalog items found - some tests may be skipped');
  }
});

afterAll(async () => {
  // Clean up test data
  if (testMenuId) {
    await getPool().query(`DELETE FROM menus WHERE id = $1`, [testMenuId]);
  }
});

beforeEach(async () => {
  // Clean up previous test menu if exists
  if (testMenuId) {
    await getPool().query(`DELETE FROM menus WHERE id = $1`, [testMenuId]);
    testMenuId = '';
  }
});

// ============================================================
// Tests
// ============================================================

describe('WP-12: Menús CRUD', () => {
  it('should create a new menu in borrador status', async () => {
    const menu = await createMenu(
      {
        name: 'Test Menu CRUD',
        price_per_pax: 75.00,
        description: 'Menú de prueba',
      },
      testUserId
    );

    expect(menu).toBeDefined();
    expect(menu.id).toBeDefined();
    expect(menu.name).toBe('Test Menu CRUD');
    expect(menu.price_per_pax).toBe(75.00);
    expect(menu.status).toBe('borrador');
    expect(menu.version).toBe(1);
    
    testMenuId = menu.id;
  });

  it('should get menu by id with sections', async () => {
    // Create menu first
    const created = await createMenu(
      { name: 'Test Get Menu', price_per_pax: 85.00 },
      testUserId
    );
    testMenuId = created.id;

    const menu = await getMenuById(testMenuId);

    expect(menu).toBeDefined();
    expect(menu?.id).toBe(testMenuId);
    expect(menu?.sections).toBeDefined();
    expect(Array.isArray(menu?.sections)).toBe(true);
  });

  it('should list menus with filters', async () => {
    // Create test menus
    const menu1 = await createMenu(
      { name: 'List Test Menu 1', price_per_pax: 70.00 },
      testUserId
    );
    const menu2 = await createMenu(
      { name: 'List Test Menu 2', price_per_pax: 90.00 },
      testUserId
    );

    // Test listing
    const { menus, total } = await getMenus({ limit: 100 });
    expect(menus.length).toBeGreaterThanOrEqual(2);
    expect(total).toBeGreaterThanOrEqual(2);

    // Test search filter
    const { menus: filtered } = await getMenus({ search: 'List Test' });
    expect(filtered.length).toBeGreaterThanOrEqual(2);

    // Clean up
    await getPool().query(`DELETE FROM menus WHERE id IN ($1, $2)`, [menu1.id, menu2.id]);
  });

  it('should update menu in borrador status', async () => {
    const created = await createMenu(
      { name: 'Original Name', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    const updated = await updateMenu(
      testMenuId,
      { name: 'Updated Name', price_per_pax: 85.00 },
      testUserId
    );

    expect(updated.name).toBe('Updated Name');
    expect(updated.price_per_pax).toBe(85.00);
  });

  it('should delete menu in borrador status', async () => {
    const created = await createMenu(
      { name: 'To Delete', price_per_pax: 75.00 },
      testUserId
    );

    const deleted = await deleteMenu(created.id);
    expect(deleted).toBe(true);

    // Verify deleted
    const found = await getMenuById(created.id);
    expect(found).toBeNull();
  });

  it('should not delete published menu', async () => {
    const created = await createMenu(
      { name: 'Published Menu', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    // Publish first
    await transitionMenuStatus(testMenuId, 'publicado', testUserId);

    // Try to delete
    await expect(deleteMenu(testMenuId)).rejects.toThrow('Solo se pueden eliminar menús en estado borrador');
  });
});

describe('WP-12: Menu Status Transitions', () => {
  beforeEach(async () => {
    if (testMenuId) {
      await getPool().query(`DELETE FROM menus WHERE id = $1`, [testMenuId]);
      testMenuId = '';
    }
  });

  it('should transition from borrador to publicado', async () => {
    const created = await createMenu(
      { name: 'Publish Test', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    const published = await transitionMenuStatus(testMenuId, 'publicado', testUserId);
    expect(published.status).toBe('publicado');
  });

  it('should transition from publicado to pausado', async () => {
    const created = await createMenu(
      { name: 'Pause Test', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    await transitionMenuStatus(testMenuId, 'publicado', testUserId);
    const paused = await transitionMenuStatus(testMenuId, 'pausado', testUserId);
    expect(paused.status).toBe('pausado');
  });

  it('should transition from pausado back to publicado', async () => {
    const created = await createMenu(
      { name: 'Resume Test', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    await transitionMenuStatus(testMenuId, 'publicado', testUserId);
    await transitionMenuStatus(testMenuId, 'pausado', testUserId);
    const resumed = await transitionMenuStatus(testMenuId, 'publicado', testUserId);
    expect(resumed.status).toBe('publicado');
  });

  it('should transition from publicado to retirado', async () => {
    const created = await createMenu(
      { name: 'Retire Test', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    await transitionMenuStatus(testMenuId, 'publicado', testUserId);
    const retired = await transitionMenuStatus(testMenuId, 'retirado', testUserId);
    expect(retired.status).toBe('retirado');
  });

  it('should not allow invalid transitions', async () => {
    const created = await createMenu(
      { name: 'Invalid Transition', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    // Cannot go directly from borrador to pausado
    await expect(transitionMenuStatus(testMenuId, 'pausado', testUserId))
      .rejects.toThrow('Transición inválida');
  });

  it('should not allow transitions from retirado', async () => {
    const created = await createMenu(
      { name: 'Retired Menu', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = created.id;

    await transitionMenuStatus(testMenuId, 'publicado', testUserId);
    await transitionMenuStatus(testMenuId, 'retirado', testUserId);

    // Cannot transition from retirado
    await expect(transitionMenuStatus(testMenuId, 'borrador', testUserId))
      .rejects.toThrow('Transición inválida');
  });
});

describe('WP-12: Menu Sections', () => {
  beforeEach(async () => {
    if (testMenuId) {
      await getPool().query(`DELETE FROM menus WHERE id = $1`, [testMenuId]);
      testMenuId = '';
    }
  });

  it('should create section in menu', async () => {
    const menu = await createMenu(
      { name: 'Section Test Menu', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = menu.id;

    const section = await createSection(testMenuId, {
      name: 'Entrante',
      position: 1,
    });

    expect(section).toBeDefined();
    expect(section.name).toBe('Entrante');
    expect(section.position).toBe(1);
    expect(section.menu_id).toBe(testMenuId);
  });

  it('should create dish in section', async () => {
    if (!testCatalogItemId) {
      // Skip test if no catalog items
      return;
    }

    const menu = await createMenu(
      { name: 'Dish Test Menu', price_per_pax: 75.00 },
      testUserId
    );
    testMenuId = menu.id;

    const section = await createSection(testMenuId, {
      name: 'Principal',
      position: 1,
    });

    const dish = await createSectionDish(section.id, {
      dish_id: testCatalogItemId,
      position: 1,
      variant_tag: 'vegetariano',
    });

    expect(dish).toBeDefined();
    expect(dish.dish_id).toBe(testCatalogItemId);
    expect(dish.variant_tag).toBe('vegetariano');
  });
});

describe('WP-12: Published Menus Endpoint', () => {
  let publishedMenuId: string;

  afterAll(async () => {
    if (publishedMenuId) {
      await getPool().query(`DELETE FROM menus WHERE id = $1`, [publishedMenuId]);
    }
  });

  it('should only return published menus', async () => {
    // Create and publish a menu
    const menu = await createMenu(
      { name: 'Public Menu', price_per_pax: 100.00 },
      testUserId
    );
    publishedMenuId = menu.id;

    await transitionMenuStatus(publishedMenuId, 'publicado', testUserId);

    // Create a borrador menu
    await createMenu(
      { name: 'Draft Menu', price_per_pax: 50.00 },
      testUserId
    );

    // Get published menus
    const published = await getPublishedMenus();
    
    // Should include our published menu
    const found = published.find(m => m.id === publishedMenuId);
    expect(found).toBeDefined();
    
    // Should not include borrador menus
    const draft = published.find(m => m.name === 'Draft Menu');
    expect(draft).toBeUndefined();
  });
});

describe('WP-12: Menu Versioning', () => {
  let originalMenuId: string;

  afterAll(async () => {
    if (originalMenuId) {
      await getPool().query(`DELETE FROM menus WHERE name = 'Version Test%'`);
    }
  });

  it('should track version history', async () => {
    // Create first version
    const v1 = await createMenu(
      { name: 'Version Test Menu', price_per_pax: 75.00 },
      testUserId
    );
    originalMenuId = v1.id;

    expect(v1.version).toBe(1);

    // Get version history
    const history = await getMenuVersionHistory('Version Test Menu');
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].version).toBe(1);
  });
});

describe('WP-12: Cost Calculation', () => {
  let costMenuId: string;

  afterAll(async () => {
    if (costMenuId) {
      await getPool().query(`DELETE FROM menus WHERE id = $1`, [costMenuId]);
    }
  });

  it('should calculate menu cost from dishes', async () => {
    if (!testCatalogItemId) {
      // Skip test if no catalog items
      return;
    }

    // Get dish cost
    const dish = await querySingle<{ cost: number }>(
      `SELECT cost FROM catalog_items WHERE id = $1`,
      [testCatalogItemId]
    );

    const menu = await createMenu(
      { name: 'Cost Test Menu', price_per_pax: 100.00 },
      testUserId
    );
    costMenuId = menu.id;

    const section = await createSection(costMenuId, {
      name: 'Test Section',
      position: 1,
    });

    await createSectionDish(section.id, {
      dish_id: testCatalogItemId,
      position: 1,
    });

    // Recalculate cost
    await recalculateMenuCost(costMenuId);

    // Verify
    const updated = await getMenuById(costMenuId);
    expect(updated?.cost_per_pax).toBe(dish?.cost || 0);
  });
});
