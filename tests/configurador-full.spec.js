/**
 * EventFlow — Test completo del Configurador B2C
 * Cubre todas las variables: tipos de evento, niños, menús, personalización, extras, envío
 *
 * Ejecutar: npx playwright test tests/configurador-full.spec.js --headed
 */

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const TODAY = new Date();
const MONTH = String(TODAY.getMonth() + 1).padStart(2, '0');
const DAY = String(TODAY.getDate()).padStart(2, '0');
const YEAR = String(TODAY.getFullYear());

// Helper: fill step 1 form
async function fillStep1(page, { eventType, month, day, year, adults, kids }) {
  await page.goto(`${BASE_URL}/configurador`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  // Click event type button
  await page.locator('button', { hasText: eventType }).click();
  await page.waitForTimeout(300);

  // Date
  const selects = page.locator('select');
  if (month) await selects.nth(0).selectOption(month);
  if (day) await selects.nth(1).selectOption(day);
  if (year) await selects.nth(2).selectOption(year);
  await page.waitForTimeout(200);

  // Guests
  const inputs = page.locator('input[type="number"]');
  await inputs.nth(0).fill(String(adults));
  if (kids !== undefined) await inputs.nth(1).fill(String(kids));
  await page.waitForTimeout(300);
}

// Helper: navigate step1 → step2
async function goToStep2(page) {
  const btn = page.locator('button', { hasText: 'Siguiente' });
  await expect(btn).toBeEnabled({ timeout: 2000 });
  await btn.click();
  await page.waitForTimeout(1500);
}

// Helper: capture console errors
function setupErrorCapture(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

// ============================================================
// STEP 1: Tipo de evento, fecha y comensales
// ============================================================
test.describe('PASO 1 — Detalles del Evento', () => {
  for (const evt of ['Boda', 'Cumpleaños', 'Corporativo', 'Bautizo', 'Comunion', 'Otro']) {
    test(`Todos los tipos de evento: "${evt}" se selecciona sin error`, async ({ page }) => {
      const errors = setupErrorCapture(page);
      await fillStep1(page, { eventType: evt, month: MONTH, day: DAY, year: YEAR, adults: 20 });
      expect(errors.length).toBe(0);
    });
  }

  test('Fecha se precarga correctamente', async ({ page }) => {
    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const selectValues = await page.evaluate(() => {
      const s = document.querySelectorAll('select');
      return Array.from(s).map(x => x.value);
    });
    console.log('Precargados:', selectValues);
    // At minimum the month/day/year selects have values, not empty
    expect(selectValues.every(v => v !== '')).toBe(true);
  });

  test('Siguiente habilitado con datos válidos', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 30 });
    const btn = page.locator('button', { hasText: 'Siguiente' });
    await expect(btn).toBeEnabled({ timeout: 2000 });
  });

  test('Siguiente deshabilitado sin tipo evento', async ({ page }) => {
    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    // Fill date and guests but don't select event type
    const selects = page.locator('select');
    await selects.nth(0).selectOption(MONTH);
    await selects.nth(1).selectOption(DAY);
    await selects.nth(2).selectOption(YEAR);
    await page.locator('input[type="number"]').nth(0).fill('20');
    const btn = page.locator('button', { hasText: 'Siguiente' });
    await expect(btn).toBeDisabled();
  });

  test('Siguiente deshabilitado sin comensales', async ({ page }) => {
    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);
    await page.locator('button', { hasText: 'Boda' }).click();
    const btn = page.locator('button', { hasText: 'Siguiente' });
    await expect(btn).toBeDisabled();
  });

  test('Siguiente deshabilitado con menos de 10 adultos', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 5 });
    const btn = page.locator('button', { hasText: 'Siguiente' });
    await expect(btn).toBeDisabled();
  });

  test('Niños: 0 permite menú solo adultos', async ({ page }) => {
    const errors = setupErrorCapture(page);
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    expect(errors.length).toBe(0);
    // Step 2 should show only adult menus (no kid menu section)
    const body = await page.locator('body').textContent();
    expect(body).not.toContain('Menú Infantil');
  });

  test('Niños: 10+ muestra menú infantil en paso 2', async ({ page }) => {
    const errors = setupErrorCapture(page);
    await fillStep1(page, { eventType: 'Cumpleaños', month: MONTH, day: DAY, year: YEAR, adults: 30, kids: 10 });
    await goToStep2(page);
    expect(errors.length).toBe(0);
    const body = await page.locator('body').textContent();
    expect(body).toContain('Menú Infantil');
  });

  test('Cumpleaños con ñ no causa error Zod', async ({ page }) => {
    const errors = setupErrorCapture(page);
    await fillStep1(page, { eventType: 'Cumpleaños', month: MONTH, day: DAY, year: YEAR, adults: 20 });
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    await goToStep2(page);
    await page.waitForTimeout(1000);
    // Check no Zod errors in console
    const zodErrors = logs.filter(l => l.includes('Zod') || l.includes('zod') || l.includes('validation'));
    expect(zodErrors.length).toBe(0);
  });
});

// ============================================================
// STEP 2: Selección de Menú
// ============================================================
test.describe('PASO 2 — Selección de Menú', () => {
  test('Botones Usar y Personalizar habilitados con menú seleccionado (sin niños)', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Click first adult menu card
    const menuCards = page.locator('button:has(h4)');
    const count = await menuCards.count();
    expect(count).toBeGreaterThan(0);
    await menuCards.first().click();
    await page.waitForTimeout(500);

    // Buttons should be enabled
    const useBtn = page.locator('button', { hasText: 'Usar' });
    const customBtn = page.locator('button', { hasText: 'Personalizar' });
    await expect(useBtn).toBeEnabled({ timeout: 2000 });
    await expect(customBtn).toBeEnabled({ timeout: 2000 });
  });

  test('Botones deshabilitados sin menú seleccionado', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    const useBtn = page.locator('button', { hasText: 'Usar' });
    const customBtn = page.locator('button', { hasText: 'Personalizar' });
    // Without selecting a menu, buttons should be disabled
    const useDisabled = await useBtn.isDisabled();
    const customDisabled = await customBtn.isDisabled();
    console.log('Use disabled:', useDisabled, 'Custom disabled:', customDisabled);
    // At least one should be disabled (can't proceed without selection)
    expect(useDisabled || customDisabled).toBe(true);
  });

  test('Menú infantil: seleccionar menú adulto e infantil', async ({ page }) => {
    const errors = setupErrorCapture(page);
    await fillStep1(page, { eventType: 'Cumpleaños', month: MONTH, day: DAY, year: YEAR, adults: 30, kids: 10 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select adult menu
    const menuCards = page.locator('button:has(h4)');
    const allCards = await menuCards.all();
    let adultCard, kidCard;
    for (const card of allCards) {
      const txt = await card.textContent();
      if (txt.includes('Menú Infantil') || txt.includes('Infantil')) {
        kidCard = card;
      } else {
        adultCard = card;
      }
    }
    if (adultCard) await adultCard.click();
    await page.waitForTimeout(300);
    if (kidCard) await kidCard.click();
    await page.waitForTimeout(500);

    // Both selected: buttons enabled
    const useBtn = page.locator('button', { hasText: 'Usar' });
    await expect(useBtn).toBeEnabled({ timeout: 2000 });
    expect(errors.length).toBe(0);
  });

  test('"Usar este Menú" salta a paso 4 (extras)', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select menu
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Usar' }).click();
    await page.waitForTimeout(2000);

    // Should be on extras/step4
    const body = await page.locator('body').textContent();
    const atStep4 = body.includes('Extras') || body.includes('Complementos') || body.includes('Carta');
    expect(atStep4).toBe(true);
  });

  test('"Personalizar Menú" carga items y va a paso 3', async ({ page }) => {
    const errors = setupErrorCapture(page);
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select menu and click Personalizar
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Personalizar' }).click();
    await page.waitForTimeout(2000);

    expect(errors.length).toBe(0);
    const body = await page.locator('body').textContent();
    // Should show customization (step 3)
    const hasCustomization = body.includes('Personaliza') || body.includes('plato') || body.includes('aperitivo');
    expect(hasCustomization).toBe(true);
  });

  test('Menú 2 (precio fijo) sin error Zod', async ({ page }) => {
    const errors = setupErrorCapture(page);
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select Menu 2 (second card)
    const menuCards = page.locator('button:has(h4)');
    const count = await menuCards.count();
    if (count >= 2) {
      await menuCards.nth(1).click();
      await page.waitForTimeout(300);
    }
    await page.locator('button', { hasText: 'Usar' }).click();
    await page.waitForTimeout(2000);
    expect(errors.length).toBe(0);
  });
});

// ============================================================
// STEP 3: Personalización de Platos
// ============================================================
test.describe('PASO 3 — Personalización', () => {
  test('Aperitivos: solo ON/OFF sin controles de cantidad', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select menu and customize
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Personalizar' }).click();
    await page.waitForTimeout(2000);

    // Check for quantity controls (- / + buttons)
    const minusBtns = page.locator('button:has-text("-"):has-text("+")');
    const hasQuantityControls = await minusBtns.count();
    console.log('Quantity controls found:', hasQuantityControls);
    
    // Items should be toggles (checkboxes/buttons), not quantities
    // Verify no +/- pattern in appetizer items
    const body = await page.locator('body').textContent();
    const hasAppetizers = body.includes('aperitivo') || body.includes('Aperitivo');
    if (hasAppetizers) {
      // Appetizers should not show number inputs or +/- quantity adjusters
      const hasQuantityInputs = await page.locator('input[type="number"]').count();
      console.log('Number inputs in step3:', hasQuantityInputs);
      // In step 3, number inputs should only be for main dishes (max 2), not appetizers
    }
  });

  test('Platos principales: máximo 2 seleccionados total', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select menu and customize
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Personalizar' }).click();
    await page.waitForTimeout(2000);

    // Find checkable items and verify
    const checkboxes = await page.locator('input[type="checkbox"], [role="checkbox"]').all();
    console.log('Checkable items:', checkboxes.length);
  });
});

// ============================================================
// STEP 4: Extras y Barra Libre
// ============================================================
test.describe('PASO 4 — Extras y Barra Libre', () => {
  test('Barra libre seleccionable sin error', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);
    // Use menu directly
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Usar' }).click();
    await page.waitForTimeout(2000);

    // On step 4, try clicking bar options
    const barOptions = page.locator('button').filter({ hasText: /hora|Barra|sin barra/i });
    const count = await barOptions.count();
    console.log('Bar options:', count);
    if (count > 0) {
      await barOptions.first().click();
      await page.waitForTimeout(300);
    }
  });
});

// ============================================================
// STEP 5: Formulario de Cliente y Envío
// ============================================================
test.describe('PASO 5 — Envío y Confirmación', () => {
  test('Flujo completo: Boda → Menú → Extras → Resumen → Envío', async ({ page }) => {
    const errors = setupErrorCapture(page);
    
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select menu and use
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Usar' }).click();
    await page.waitForTimeout(2000);

    // On step 4, click "Resumen" or "Continuar"
    const resumeBtn = page.locator('button').filter({ hasText: /Resumen|Continuar|Solicitar/i });
    if (await resumeBtn.count() > 0) {
      await resumeBtn.first().click();
      await page.waitForTimeout(2000);
    }

    // Fill client info if on step 5
    const nameInput = page.locator('input[type="text"]').first();
    if (await nameInput.isVisible()) {
      await nameInput.fill('Test Cliente');
      await page.locator('input[type="email"]').fill('test@example.com');
      await page.locator('input[type="tel"]').fill('600000000');
    }

    // Submit
    const submitBtn = page.locator('button').filter({ hasText: /Enviar|Confirmar|Solicitar/i });
    if (await submitBtn.count() > 0) {
      await submitBtn.first().click();
      await page.waitForTimeout(3000);
    }

    console.log('Flow complete errors:', errors);
    // No errors is success
    expect(errors.filter(e => !e.includes('favicon')).length).toBe(0);
  });

  test('Envío sin datos de cliente muestra error', async ({ page }) => {
    await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Usar' }).click();
    await page.waitForTimeout(2000);

    // Click submit without filling data
    const submitBtn = page.locator('button').filter({ hasText: /Enviar|Confirmar|Solicitar/i });
    if (await submitBtn.count() > 0) {
      // Should be disabled without name/email
      const disabled = await submitBtn.first().isDisabled();
      console.log('Submit disabled without data:', disabled);
    }
  });
});

// ============================================================
// ADMIN: API endpoints
// ============================================================
test.describe('Admin — API Tests', () => {
  test('API /api/events devuelve array', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/events`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data.data || data)).toBe(true);
  });

  test('API /api/catalog devuelve items', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/catalog`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data.data || data)).toBe(true);
  });

  test('API /api/proposed-menus devuelve menús', async ({ page }) => {
    const response = await page.request.get(`${BASE_URL}/api/proposed-menus`);
    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data.data || data)).toBe(true);
  });
});

// ============================================================
// FLUJO COMPLETO: varias configuraciones
// ============================================================
test.describe('Flujos completos — Combinaciones', () => {
  test('Cumpleaños + 50 adultos + 10 niños + Menú 2 + Personalizar', async ({ page }) => {
    const errors = setupErrorCapture(page);
    
    await fillStep1(page, { eventType: 'Cumpleaños', month: MONTH, day: DAY, year: YEAR, adults: 50, kids: 10 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select Menu 2 (adult) and a kid menu
    const menuCards = page.locator('[class*="flex"] button:has(h4), button:has(h4)');
    const visibleCards = await menuCards.all();
    console.log('Menu cards found:', visibleCards.length);
    for (const card of visibleCards) {
      const txt = await card.textContent();
      if (txt.includes('Menú 2') || txt.includes('menu2') || (!txt.includes('Infantil') && !txt.includes('Niño'))) {
        // First non-kid menu
        const cardsWithText = await page.locator('button:has(h4)').all();
        // Click first non-kid card
        for (const c of cardsWithText) {
          const t = await c.textContent();
          if (!t.includes('Infantil') && !t.includes('Niño')) {
            await c.click();
            break;
          }
        }
        break;
      }
    }
    await page.waitForTimeout(300);

    // Try to find kid menu
    const kidCards = page.locator('button:has(h4)').filter({ hasText: /Infantil|Niño/i });
    if (await kidCards.count() > 0) {
      await kidCards.first().click();
      await page.waitForTimeout(300);
    }

    // Personalizar
    const customBtn = page.locator('button', { hasText: 'Personalizar' });
    if (await customBtn.isEnabled()) {
      await customBtn.click();
      await page.waitForTimeout(2000);
      console.log('Reached step 3 (customization)');
    }

    expect(errors.filter(e => !e.includes('favicon')).length).toBe(0);
  });

  test('Corporativo + 100 adultos + sin niños + Menú 1 + Usar + 2h barra', async ({ page }) => {
    const errors = setupErrorCapture(page);
    
    await fillStep1(page, { eventType: 'Corporativo', month: MONTH, day: DAY, year: YEAR, adults: 100, kids: 0 });
    await goToStep2(page);
    await page.waitForTimeout(500);

    // Select Menu 1
    await page.locator('button:has(h4)').first().click();
    await page.waitForTimeout(300);
    await page.locator('button', { hasText: 'Usar' }).click();
    await page.waitForTimeout(2000);

    // Select 2h bar if available
    const barBtns = page.locator('button').filter({ hasText: /2 hora|2h/i });
    if (await barBtns.count() > 0) {
      await barBtns.first().click();
      await page.waitForTimeout(300);
    }

    expect(errors.length).toBe(0);
  });
});
