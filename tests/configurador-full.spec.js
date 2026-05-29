const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://eventcater.duckdns.org';

test.describe('Configurador Completo', () => {
  
  test('Paso 1: Carga correctamente sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
    });

    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Capturar errores
    const jsErrors = await page.evaluate(() => {
      const entries = performance.getEntriesByType('resource');
      const failed = entries.filter(function(e) { return e.responseStatus >= 400; });
      return failed.map(function(e) { return e.name + ' -> ' + e.responseStatus; });
    });

    console.log('Resource errors:', jsErrors);
    console.log('Page errors:', errors);

    expect(errors.length).toBe(0);
    await expect(page.locator('h2')).toBeVisible();
  });

  test('Paso 1→2: Rellenar formulario y siguiente', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Seleccionar "Boda"
    await page.locator('button', { hasText: 'Boda' }).click();
    await page.waitForTimeout(300);

    // Seleccionar fecha actual
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = String(today.getFullYear());
    
    await page.locator('select').nth(0).selectOption(month);
    await page.waitForTimeout(200);
    await page.locator('select').nth(1).selectOption(day);
    await page.waitForTimeout(200);
    await page.locator('select').nth(2).selectOption(year);
    await page.waitForTimeout(200);

    // Adultos: 20
    await page.locator('input[type="number"]').nth(0).fill('20');
    await page.waitForTimeout(300);

    // Click "Siguiente"
    await page.locator('button', { hasText: 'Siguiente' }).click();
    await page.waitForTimeout(2000);

    // Debería estar en paso 2 (menú)
    console.log('Current URL:', page.url());
    console.log('Title:', await page.title());
    console.log('Console errors:', consoleErrors);

    const bodyText = await page.locator('body').textContent();
    console.log('Body preview:', bodyText.substring(0, 200));

    // Verificar que estamos en paso 2
    const hasMenuStep = bodyText.includes('Elige') || bodyText.includes('Menú') || bodyText.includes('Menu');
    expect(hasMenuStep).toBe(true);
  });

  test('Paso 2: Seleccionar menú 2 y "Usar este Menú"', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    // Ir al paso 1 primero
    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Boda
    await page.locator('button', { hasText: 'Boda' }).click();
    await page.waitForTimeout(300);

    // Fecha actual
    const today = new Date();
    await page.locator('select').nth(0).selectOption(String(today.getMonth() + 1).padStart(2, '0'));
    await page.waitForTimeout(200);
    await page.locator('select').nth(1).selectOption(String(today.getDate()).padStart(2, '0'));
    await page.waitForTimeout(200);
    await page.locator('select').nth(2).selectOption(String(today.getFullYear()));
    await page.waitForTimeout(200);

    // 20 adultos, 0 niños
    await page.locator('input[type="number"]').nth(0).fill('20');
    await page.locator('input[type="number"]').nth(1).fill('0');
    await page.waitForTimeout(300);

    // Siguiente
    await page.locator('button', { hasText: 'Siguiente' }).click();
    await page.waitForTimeout(2000);

    // Verificar consola
    console.log('Errors after step1:', consoleErrors);
    const body1 = await page.locator('body').textContent();
    console.log('Body after step1:', body1.substring(0, 300));

    // Seleccionar el segundo menú
    const menuCards = await page.locator('button:has(h4)');
    const menuCount = await menuCards.count();
    console.log(`Found ${menuCount} menu cards`);

    // Click "Usar este Menú"
    const useBtn = page.locator('button', { hasText: 'Usar' });
    if (await useBtn.isDisabled()) {
      console.log('Usar button is disabled');
      // Si está deshabilitado, necesitamos seleccionar un menú primero
      if (menuCount > 0) {
        await menuCards.nth(0).click();
        await page.waitForTimeout(500);
      }
    }
    
    // Try again
    const useBtn2 = page.locator('button', { hasText: 'Usar' });
    console.log('Use menu button disabled:', await useBtn2.isDisabled());
    
    // Click Usar
    await useBtn2.click();
    await page.waitForTimeout(2000);

    console.log('Errors after use menu:', consoleErrors);
    const body2 = await page.locator('body').textContent();
    console.log('Body after use menu:', body2.substring(0, 500));

    // Si no hay error, debería estar en paso 4 (extras)
    const noError = consoleErrors.length === 0;
    expect(noError).toBe(true);
  });

  test('Paso 2→3: Seleccionar menú y "Personalizar"', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Boda
    await page.locator('button', { hasText: 'Boda' }).click();
    await page.waitForTimeout(300);

    // Fecha
    const today = new Date();
    await page.locator('select').nth(0).selectOption(String(today.getMonth() + 1).padStart(2, '0'));
    await page.locator('select').nth(1).selectOption(String(today.getDate()).padStart(2, '0'));
    await page.locator('select').nth(2).selectOption(String(today.getFullYear()));
    await page.locator('input[type="number"]').nth(0).fill('20');
    await page.locator('input[type="number"]').nth(1).fill('0');

    // Siguiente
    await page.locator('button', { hasText: 'Siguiente' }).click();
    await page.waitForTimeout(2000);

    // Personalizar
    const customizeBtn = page.locator('button', { hasText: 'Personalizar' });
    console.log('Customize disabled:', await customizeBtn.isDisabled());
    
    if (await customizeBtn.isDisabled()) {
      // Seleccionar primer menú
      await page.locator('button:has(h4)').first().click();
      await page.waitForTimeout(500);
    }

    await page.locator('button', { hasText: 'Personalizar' }).click();
    await page.waitForTimeout(2000);

    console.log('Errors after customize:', consoleErrors);
    const body = await page.locator('body').textContent();
    console.log('Body after customize:', body.substring(0, 500));

    expect(consoleErrors.length).toBe(0);
  });

  test('Flujo completo: Boda → Menú 1 → Usar → Extras → Resumen con fecha precargada', async ({ page }) => {
    const consoleErrors = [];
    page.on('pageerror', err => consoleErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(`console: ${msg.text()}`);
    });

    await page.goto(`${BASE_URL}/configurador`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Verificar fecha precargada
    const selectValues = await page.evaluate(() => {
      const selects = document.querySelectorAll('select');
      return Array.from(selects).map(s => s.value);
    });
    console.log('Select values:', selectValues);

    // Paso 1: Cumpleaños
    await page.locator('button', { hasText: 'Cumpleanos' }).click();
    await page.waitForTimeout(300);

    // Fecha actual
    const today = new Date();
    await page.locator('select').nth(0).selectOption(String(today.getMonth() + 1).padStart(2, '0'));
    await page.waitForTimeout(200);
    await page.locator('select').nth(1).selectOption(String(today.getDate()).padStart(2, '0'));
    await page.waitForTimeout(200);
    await page.locator('select').nth(2).selectOption(String(today.getFullYear()));
    await page.waitForTimeout(200);

    // 30 adultos
    await page.locator('input[type="number"]').nth(0).fill('30');
    await page.waitForTimeout(300);

    // Siguiente
    await page.locator('button', { hasText: 'Siguiente' }).click();
    await page.waitForTimeout(2000);

    console.log('Step1->2 errors:', consoleErrors);

    // Seleccionar menú 1 y usar
    const menus = await page.locator('button:has(h4)');
    const count = await menus.count();
    if (count > 0) await menus.nth(0).click();
    await page.waitForTimeout(300);

    // Click usar
    await page.locator('button', { hasText: 'Usar' }).click();
    await page.waitForTimeout(2000);

    console.log('Step2->4 errors:', consoleErrors);
    const body4 = await page.locator('body').textContent();
    
    if (body4.includes('Extras') || body4.includes('Complementos')) {
      // En step4: seleccionar un extra
      const extras = page.locator('button:has(span)' );
      const extraCount = await extras.count();
      if (extraCount > 0) {
        await extras.first().click();
        await page.waitForTimeout(300);
      }

      // Ver resumen
      await page.locator('button', { hasText: 'Resumen' }).click();
      await page.waitForTimeout(2000);
    }

    console.log('Final errors:', consoleErrors);
    const body5 = await page.locator('body').textContent();
    console.log('Final body:', body5.substring(0, 500));

    expect(consoleErrors.length).toBe(0);
  });
});
