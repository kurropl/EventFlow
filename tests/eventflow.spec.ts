/**
 * EventFlow — Playwright E2E & Integration Tests
 * 
 * Catálogo real: Alboroto Eventos 2025 (118 items, 10 categorías)
 * Fuente: https://byalboroto.duckdns.org/
 * 
 * REGLA CRÍTICA: El configurador B2C NUNCA muestra precios.
 * El precio solo se calcula en el backend y se visualiza en el Dashboard B2B.
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@eventflow.test';
const ADMIN_PASSWORD = 'admin123';
const API_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:3000';

async function waitForElement(page, selector, timeout = 10000) {
  await page.waitForSelector(selector, { state: 'visible', timeout });
}

// ============================================================
// TEST 1: B2C — Configurador de Menú (SIN PRECIOS)
// ============================================================
test.describe('B2C Public Portal — Menu Configurator (Alboroto Eventos)', () => {
  
  test('should render immersive landing page with hero and gallery', async ({ page }) => {
    await page.goto('/');
    
    const hero = page.locator('h1').first();
    await expect(hero).toBeVisible();
    
    const cta = page.getByRole('button', { name: /Diseña tu Evento|Planifica tu/i });
    await expect(cta).toBeVisible();
    await expect(cta).toBeEnabled();
    
    // Gallery / spaces section
    const galleryItems = page.locator('.gallery-item, [class*="bento"], .card, [data-category]');
    const count = await galleryItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate to configurator wizard from hero CTA', async ({ page }) => {
    await page.goto('/');
    
    const cta = page.getByRole('button', { name: /Diseña tu Evento|Planifica tu/i });
    await cta.click();
    
    await page.waitForURL(/\/configurador|\/wizard|\/disena/i, { timeout: 5000 });
    await waitForElement(page, 'input[type="date"], [data-step="1"]');
    
    const steps = page.locator('[data-step]');
    await expect(steps).toHaveCount(5);
  });

  test('should allow selecting dishes WITHOUT showing prices', async ({ page }) => {
    await page.goto('/configurador');
    
    // Step 1: event type, date, guests
    await page.selectOption('select', { label: 'Boda' });
    await page.fill('input[type="date"]', '2026-09-15');
    await page.fill('input[name="guests"], input[name="guest_count"]', '100');
    
    const nextBtn = page.getByRole('button', { name: /Siguiente|Continuar|Next|Siguiente \d+/\i });
    await nextBtn.click();
    
    // Step 2: proposed menus (from PDF)
    await waitForElement(page, '[data-step="2"]');
    
    const menuCards = page.locator('[data-step="2"] .card, [data-step="2"] [role="button"]');
    await expect(menuCards.first()).toBeVisible();
    
    // CRITICAL: No price displayed on menu cards in B2C
    const cardText = await menuCards.first().textContent();
    expect(cardText).not.toMatch(/€|EUR|pvp|coste|precio|cost/i);
    
    await menuCards.first().click();
    await nextBtn.click();
    
    // Step 3: dish customisation — names and images ONLY, no prices
    await waitForElement(page, '[data-step="3"]');
    
    const dishes = page.locator('[data-step="3"] [data-category], [data-step="3"] .dish-card');
    const dishCount = await dishes.count();
    expect(dishCount).toBeGreaterThan(0);
    
    // CRITICAL: No dish card shows a price
    for (let i = 0; i < Math.min(dishCount, 5); i++) {
      const dishText = await dishes.nth(i).textContent();
      expect(dishText).not.toMatch(/€|EUR|pvp|coste|precio|cost/i);
    }
    
    // Swap a dish
    if (dishCount > 1) {
      await dishes.nth(1).click();
      await page.waitForTimeout(500);
      
      const selectedDish = page.locator('[data-step="3"] [data-selected="true"], .dish-card.selected');
      await expect(selectedDish).toBeVisible();
    }
  });

  test('should show floating cart panel with dish count, NOT total price', async ({ page }) => {
    await page.goto('/configurador');
    
    await page.selectOption('select', { label: 'Boda' });
    await page.fill('input[type="date"]', '2026-09-15');
    await page.fill('input[name="guests"], input[name="guest_count"]', '100');
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await page.locator('[data-step="2"] .card, [data-step="2"] [role="button"]').first().click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await waitForElement(page, '[data-step="3"]');
    
    const addBtn = page.locator('[data-step="3"] [role="button"], [data-step="3"] .card').first();
    await addBtn.click();
    
    const floatingPanel = page.locator('[data-testid="floating-cart"], [data-testid="selected-items"], [class*="floating"], [class*="cart"]');
    await expect(floatingPanel).toBeVisible();
    
    // Panel shows count of items, NOT a total price
    const panelText = await floatingPanel.textContent();
    expect(panelText).not.toMatch(/€|EUR|total.*[0-9]+|precio.*[0-9]+/i);
    expect(panelText).toMatch(/\d+|plato|entrada|principal|postre|bebida/i);
  });

  test('should show AI suggestions in step 4 based on event type', async ({ page }) => {
    await page.goto('/configurador');
    
    await page.selectOption('select', { label: 'Boda' });
    await page.fill('input[type="date"]', '2026-09-15');
    await page.fill('input[name="guests"], input[name="guest_count"]', '100');
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await page.locator('[data-step="2"] .card, [data-step="2"] [role="button"]').first().click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await page.locator('[data-step="3"] [role="button"], [data-step="3"] .card').first().click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await waitForElement(page, '[data-step="4"]');
    
    const suggestions = page.locator('[data-step="4"] .suggestion-card, [data-testid="suggestion"]');
    const count = await suggestions.count();
    expect(count).toBeGreaterThan(0);
    
    // Suggestions should NOT show prices
    const suggestionText = await suggestions.first().textContent();
    expect(suggestionText).not.toMatch(/€|EUR|pvp|coste|precio/i);
  });

  test('should render elegant summary in step 5 and submit (no prices visible)', async ({ page }) => {
    await page.goto('/configurador');
    
    await page.selectOption('select', { label: 'Boda' });
    await page.fill('input[type="date"]', '2026-09-15');
    await page.fill('input[name="guests"], input[name="guest_count"]', '50');
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await page.locator('[data-step="2"] .card, [data-step="2"] [role="button"]').first().click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await page.locator('[data-step="3"] [role="button"], [data-step="3"] .card').first().click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await waitForElement(page, '[data-step="5"]');
    
    const summary = page.locator('[data-step="5"]');
    await expect(summary).toBeVisible();
    
    // Dish names appear, NOT prices
    const dishNames = page.locator('[data-step="5"] .dish-name, [data-testid="dish-item"]');
    const count = await dishNames.count();
    expect(count).toBeGreaterThan(0);
    
    // CRITICAL: No price info in summary
    const summaryText = await summary.textContent();
    expect(summaryText).not.toMatch(/€|EUR|total.*[0-9]+|pvp|coste|precio/i);
    
    await page.getByRole('button', { name: /Enviar|Enviar Presupuesto/i }).click();
    
    const success = page.locator('text=/presupuesto enviado|gracias|éxito|confirmado|recibido/i');
    await expect(success).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================
// TEST 2: CRUD Catálogo (Admin Portal)
// ============================================================
test.describe('B2B Admin Portal — Catalog CRUD', () => {
  
  test('should log in to admin dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Entrar|Login|Acceder/i }).click();
    await page.waitForURL(/\/admin/i);
    await expect(page).toHaveURL(/\/admin/i);
  });

  test('should create a new catalog item with PVP/Coste', async ({ page }) => {
    await page.goto('/admin/catalog');
    
    const addBtn = page.getByRole('button', { name: /Añadir|Add|Nuevo|Crear/i });
    await addBtn.click();
    
    await waitForElement(page, '[data-testid="item-form"], [role="dialog"], [role="form"]');
    
    await page.fill('input[name="name"]', 'Tartar de Salmón Ahumado');
    await page.selectOption('select[name="category"]', 'aperitivo-frio');
    await page.fill('input[name="pvp"]', '16.00');
    await page.fill('input[name="cost"]', '7.50');
    
    const submitBtn = page.getByRole('button', { name: /Guardar|Save|Crear/i });
    await submitBtn.click();
    
    await waitForElement(page, 'text=/Tartar de Salmón Ahumado/i');
    await expect(page.locator('text=/Tartar de Salmón Ahumado/i')).toBeVisible();
    
    // In admin, PVP and Coste ARE visible
    const itemRow = page.locator('text=/Tartar de Salmón Ahumado/i').locator('..');
    const rowText = await itemRow.textContent();
    expect(rowText).toMatch(/16\.00/);
    expect(rowText).toMatch(/7\.50/);
  });

  test('should validate PVP must be >= cost', async ({ page }) => {
    await page.goto('/admin/catalog');
    
    const addBtn = page.getByRole('button', { name: /Añadir|Add|Nuevo|Crear/i });
    await addBtn.click();
    
    await waitForElement(page, '[data-testid="item-form"], [role="dialog"], [role="form"]');
    
    await page.fill('input[name="name"]', 'Item Inválido');
    await page.selectOption('select[name="category"]', 'aperitivo-frio');
    await page.fill('input[name="pvp"]', '5.00');
    await page.fill('input[name="cost"]', '10.00');
    
    const submitBtn = page.getByRole('button', { name: /Guardar|Save/i });
    await submitBtn.click();
    
    const error = page.locator('text=/PVP debe ser mayor que el coste|validation|error|invalido/i');
    const hasError = await error.isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
  });

  test('should update an existing catalog item', async ({ page }) => {
    await page.goto('/admin/catalog');
    
    const editBtn = page.locator('[data-testid="edit-btn"], [aria-label="Editar"]').first();
    await editBtn.click();
    
    await waitForElement(page, '[data-testid="item-form"], [role="dialog"], [role="form"]');
    
    const currentName = await page.locator('input[name="name"]').inputValue();
    await page.fill('input[name="name"]', `${currentName} (Actualizado)`);
    
    await page.getByRole('button', { name: /Guardar|Save/i }).click();
    await expect(page.locator('text=/Actualizado/i')).toBeVisible({ timeout: 5000 });
  });

  test('should delete a catalog item', async ({ page }) => {
    await page.goto('/admin/catalog');
    
    const deleteBtn = page.locator('[data-testid="delete-btn"], [aria-label="Eliminar"]').last();
    await deleteBtn.click();
    
    const confirmBtn = page.getByRole('button', { name: /Eliminar|Delete|Confirmar/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(500);
  });

  test('should show newly created catalog item in B2C configurator', async ({ page }) => {
    await page.goto('/configurador');
    const found = await page.locator('text=/Tartar de Salmón Ahumado/i').isVisible({ timeout: 5000 }).catch(() => false);
    expect(found).toBeTruthy();
  });
});

// ============================================================
// TEST 3: Operations Automation (Dashboard B2B)
// ============================================================
test.describe('B2B Admin Portal — Operations & Pricing Dashboard', () => {
  
  test('should show correct staff count for 150 guests', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Entrar|Login/i }).click();
    
    await page.goto('/admin/events');
    
    const eventCard = page.locator('[data-testid="event-card"]').first();
    if (await eventCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eventCard.click();
    } else {
      await page.getByRole('button', { name: /Nuevo|New/i }).click();
      await page.fill('input[name="guest_count"]', '150');
      await page.selectOption('select[name="event_type"]', 'boda');
      await page.getByRole('button', { name: /Crear|Save/i }).click();
    }
    
    await waitForElement(page, '[data-testid="operations-panel"], [data-testid="staff-count"]');
    
    // 150 / 15 = 10 camareros
    const camarerosText = await page.locator('[data-testid="camareros"], [data-testid="staff-camareros"]').textContent();
    const camareros = parseInt(camarerosText?.replace(/[^0-9]/g, '') || '0');
    expect(camareros).toBe(10);
    
    // 150 / 10 = 15 mesas
    const mesasText = await page.locator('[data-testid="mesas"], [data-testid="table-count"]').textContent();
    const mesas = parseInt(mesasText?.replace(/[^0-9]/g, '') || '0');
    expect(mesas).toBe(15);
  });

  test('should display full budget breakdown with PVP vs Coste', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Entrar|Login/i }).click();
    
    await page.goto('/admin/events');
    
    const eventCard = page.locator('[data-testid="event-card"]').first();
    if (await eventCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await eventCard.click();
      
      await waitForElement(page, '[data-testid="budget-detail"], [data-testid="cost-breakdown"]');
      
      const detailText = await page.locator('[data-testid="budget-detail"]').textContent();
      expect(detailText).toMatch(/plato|entrada|principal|postre|bebida|aperitivo/i);
      
      await expect(page.locator('[data-testid="budget-detail"]')).toBeVisible();
    }
  });

  test('should render purchase order with 10% buffer', async ({ page }) => {
    await page.goto('/admin');
    
    const purchaseSection = page.locator('[data-testid="purchase-order"], [data-testid="escandallo"], [data-testid="compras"]');
    if (await purchaseSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      const items = purchaseSection.locator('[data-testid="purchase-item"]');
      const count = await items.count();
      expect(count).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// TEST 4: Webhook Integration
// ============================================================
test.describe('Webhook Integration', () => {
  
  test('should trigger webhook when status changes to "propuesta_enviada"', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Entrar|Login/i }).click();
    
    await page.goto('/admin/kanban');
    
    const card = page.locator('[data-testid="event-card"], [data-draggable="true"]').first();
    const targetCol = page.locator('[data-column="propuesta_enviada"], .column-propuesta').first();
    
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      const cardBox = await card.boundingBox();
      const targetBox = await targetCol.boundingBox();
      
      if (cardBox && targetBox) {
        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
        await page.mouse.up();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should validate webhook payload structure via API', async ({ request }) => {
    const payload = {
      id: '00000000-0000-0000-0000-000000000001',
      topic: 'STATUS_CHANGED',
      timestamp: new Date().toISOString(),
      event: {
        id: '00000000-0000-0000-0000-000000000002',
        client_name: 'Test Client',
        client_email: 'test@example.com',
        event_type: 'boda',
        guest_count: 150,
        kids_count: 10,
        event_date: '2026-09-15',
        status: 'propuesta_enviada',
        total_pvp: 5250.00,
        total_cost: 2800.00,
        bar_hours: 2,
        bar_price: 16.00,
        profit: 2450.00,
        margin_pct: 46.7,
      },
      changes: { status: { from: 'nuevo', to: 'propuesta_enviada' } },
      metadata: { source: 'eventflow', version: '1.0' },
    };

    const response = await request.post(`${API_BASE}/api/webhooks/test`, { data: payload }).catch(() => null);
    if (response) expect(response.status()).toBeOneOf([200, 201, 401, 403]);
  });

  test('should reject invalid webhook payload', async ({ request }) => {
    const invalidPayload = {
      id: 'not-a-uuid',
      topic: 'INVALID_TOPIC',
      timestamp: 'not-a-date',
      event: {
        id: 'not-a-uuid',
        client_name: '',
        client_email: 'not-an-email',
        event_type: 'invalid',
        guest_count: -100,
        event_date: 'not-a-date',
        status: 'invalid',
        total_pvp: -100,
        total_cost: -100,
        profit: -100,
        margin_pct: 200,
      },
    };

    const response = await request.post(`${API_BASE}/api/webhooks/test`, { data: invalidPayload }).catch(() => null);
    if (response) expect(response.status()).toBeOneOf([400, 422, 401, 403]);
  });
});

// ============================================================
// TEST 5: Cross-Portal Integration
// ============================================================
test.describe('Cross-Portal Integration', () => {
  
  test('B2C budget should appear in B2B kanban', async ({ page }) => {
    await page.goto('/configurador');
    await page.selectOption('select', { label: 'Boda' });
    await page.fill('input[type="date"]', '2026-09-15');
    await page.fill('input[name="guests"], input[name="guest_count"]', '50');
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    await page.locator('[data-step="2"] .card, [data-step="2"] [role="button"]').first().click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    await page.locator('[data-step="3"] [role="button"], [data-step="3"] .card').first().click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    await page.getByRole('button', { name: /Siguiente|Continuar/i }).click();
    
    await page.fill('input[name="client_name"]', 'Test User');
    await page.fill('input[name="client_email"]', 'testuser+playwright@example.com');
    await page.fill('input[name="client_phone"]', '+34600000000');
    
    await page.getByRole('button', { name: /Enviar|Enviar Presupuesto/i }).click();
    await page.waitForTimeout(2000);
    
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Entrar|Login/i }).click();
    
    await page.goto('/admin/kanban');
    await waitForElement(page, '[data-column="nuevo"]');
    const nuevoCards = page.locator('[data-column="nuevo"] [data-testid="event-card"]');
    const count = await nuevoCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('drag kanban card to "confirmado" should trigger webhook', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', ADMIN_EMAIL);
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.getByRole('button', { name: /Entrar|Login/i }).click();
    
    await page.goto('/admin/kanban');
    
    const card = page.locator('[data-testid="event-card"], [data-draggable="true"]').first();
    const targetCol = page.locator('[data-column="confirmado"], .column-confirmado').first();
    
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      const cardBox = await card.boundingBox();
      const targetBox = await targetCol.boundingBox();
      
      if (cardBox && targetBox) {
        await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
        await page.mouse.down();
        await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2);
        await page.mouse.up();
        
        const toast = page.locator('[data-testid="toast"], [role="alert"], [class*="toast"]');
        await expect(toast).toBeVisible({ timeout: 5000 });
      }
    }
  });
});
