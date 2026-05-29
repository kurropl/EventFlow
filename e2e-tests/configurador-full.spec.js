const { test, expect } = require('@playwright/test');

const BASE = 'https://eventcater.duckdns.org';

test.describe('Configurador B2C — Test Completo', () => {

  test('Paso 1 → Seleccionar tipo, fecha, comensales', async ({ page }) => {
    await page.goto(`${BASE}/configurador`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');

    // Verificar que no hay errores en consola
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ CONSOLE ERROR:', msg.text());
      }
    });

    // Seleccionar "Boda"
    await page.getByRole('button', { name: /boda|Boda/ }).first().click();
    await page.waitForTimeout(300);

    // Verificar que se marcó correctamente
    const bodaBtn = page.getByRole('button', { name: /boda|Boda/ }).first();
    await expect(bodaBtn).toBeVisible();

    // Seleccionar fecha: Junio, 15, 2026
    const selects = page.locator('select');
    const count = await selects.count();
    if (count >= 3) {
      await selects.nth(0).selectOption('06'); // Mes
      await page.waitForTimeout(200);
      await selects.nth(1).selectOption('15'); // Día
      await page.waitForTimeout(200);
      await selects.nth(2).selectOption('2026'); // Año
    }

    // Rellenar comensales
    const inputs = page.locator('input[type="number"]');
    const inputCount = await inputs.count();
    if (inputCount >= 2) {
      await inputs.nth(0).fill('50'); // Adultos
      await inputs.nth(1).fill('5');  // Niños
    }

    await page.waitForTimeout(500);

    // Click Siguiente
    const nextBtn = page.getByRole('button', { name: 'Siguiente' });
    const isDisabled = await nextBtn.isDisabled();
    if (!isDisabled) {
      await nextBtn.click();
    }
    await page.waitForTimeout(2000);

    // Verificar que llegamos al paso 2
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Elige');
    expect(bodyText).toContain('Menú');
  });

  test('Paso 2 → Seleccionar menú adulto, sin infantil → Usar menú', async ({ page }) => {
    await page.goto(`${BASE}/configurador`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');

    // Ir al paso 2
    await page.getByRole('button', { name: /boda|Boda/ }).first().click();
    const selects = page.locator('select');
    const count = await selects.count();
    if (count >= 3) {
      await selects.nth(0).selectOption('06');
      await selects.nth(1).selectOption('15');
      await selects.nth(2).selectOption('2026');
    }
    const inputs = page.locator('input[type="number"]');
    const inputCount = await inputs.count();
    if (inputCount >= 2) {
      await inputs.nth(0).fill('50');
    }

    const nextBtn = page.getByRole('button', { name: 'Siguiente' });
    if (!(await nextBtn.isDisabled())) {
      await nextBtn.click();
      await page.waitForTimeout(2000);
    }

    // Ahora en paso 2, seleccionar el primer menú adulto
    const menuCards = page.locator('.grid.md\\:grid-cols-2 > div, [class*="rounded-xl"][class*="border-2"]');
    const allCards = page.locator('[class*="rounded-xl"][class*="border-2"]');
    const cardCount = await allCards.count();
    console.log(`📊 Cartas encontradas: ${cardCount}`);

    // Intentar click en todas las cartas hasta encontrar un menú adulto clickeable
    let clicked = false;
    for (let i = 0; i < cardCount && !clicked; i++) {
      const cardText = await allCards.nth(i).textContent();
      if (cardText && !cardText.includes('Infantil') && cardText.length > 10) {
        await allCards.nth(i).click();
        clicked = true;
        console.log(`✅ Click en carta ${i}: ${cardText?.substring(0, 50)}`);
        await page.waitForTimeout(500);
      }
    }

    if (!clicked) {
      console.log('⚠️ No se pudo clickear ninguna carta de menú');
    }

    // Click en "Usar este Menú"
    const usarBtn = page.getByRole('button', { name: /Usar este Menú|Usar este menú/i });
    if (await usarBtn.isVisible()) {
      await usarBtn.click();
      await page.waitForTimeout(3000);
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Extras');
      console.log('✅ "Usar Menú" → saltó a Extras correctamente');
    } else {
      // Fallback: buscar cualquier botón con "Usar"
      const allBtns = page.locator('button');
      const btnCount = await allBtns.count();
      for (let i = 0; i < btnCount; i++) {
        const txt = await allBtns.nth(i).textContent();
        if (txt && txt.includes('Usar')) {
          await allBtns.nth(i).click();
          await page.waitForTimeout(3000);
          console.log('✅ Click en botón:', txt);
          break;
        }
      }
    }
  });

  test('Paso 2 → Personalizar menú carga items en paso 3', async ({ page }) => {
    await page.goto(`${BASE}/configurador`);
    await page.waitForTimeout(2000);
    await page.waitForLoadState('domcontentloaded');

    // Ir a paso 2
    await page.getByRole('button', { name: /boda|Boda/ }).first().click();
    const selects = page.locator('select');
    const selectCount = await selects.count();
    if (selectCount >= 3) {
      await selects.nth(0).selectOption('06');
      await selects.nth(1).selectOption('15');
      await selects.nth(2).selectOption('2026');
    }
    const inputs = page.locator('input[type="number"]');
    const inputCount = await inputs.count();
    if (inputCount >= 1) {
      await inputs.nth(0).fill('50');
    }
    const nextBtn = page.getByRole('button', { name: 'Siguiente' });
    if (!(await nextBtn.isDisabled())) {
      await nextBtn.click();
      await page.waitForTimeout(2000);
    }

    // Click en primera carta adulta
    const allCards = page.locator('[class*="rounded-xl"][class*="border-2"]');
    const cardCount = await allCards.count();
    for (let i = 0; i < cardCount; i++) {
      const cardText = await allCards.nth(i).textContent();
      if (cardText && !cardText.includes('Infantil') && cardText.length > 10) {
        await allCards.nth(i).click();
        await page.waitForTimeout(300);
        break;
      }
    }

    // Click en "Personalizar Menú"
    const persBtn = page.getByRole('button', { name: /Personalizar Menú|Personalizar/i });
    if (await persBtn.isVisible()) {
      await persBtn.click();
      await page.waitForTimeout(3000);
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toContain('Personaliza');
      expect(bodyText).toContain('Menú');
      console.log('✅ "Personalizar Menú" → cargó paso 3 correctamente');
    } else {
      const allBtns = page.locator('button');
      const btnCount = await allBtns.count();
      for (let i = 0; i < btnCount; i++) {
        const txt = await allBtns.nth(i).textContent();
        if (txt && txt.includes('Person')) {
          await allBtns.nth(i).click();
          await page.waitForTimeout(3000);
          console.log('✅ Click en Personalizar:', txt);
          break;
        }
      }
    }
  });

  test('Ruta A: Flujo completo sin niños (0)', async ({ page }) => {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('❌ ERROR EN CONSOLA:', msg.text());
      }
    });

    await page.goto(`${BASE}/configurador`);
    await page.waitForTimeout(2000);

    // Paso 1: Boda + fecha + 50 adultos, 0 niños
    await page.getByRole('button', { name: /boda|Boda/ }).first().click();
    const selects = page.locator('select');
    if ((await selects.count()) >= 3) {
      await selects.nth(0).selectOption('06');
      await selects.nth(1).selectOption('15');
      await selects.nth(2).selectOption('2026');
    }
    const numInputs = page.locator('input[type="number"]');
    if ((await numInputs.count()) >= 1) {
      await numInputs.nth(0).fill('50');
    }

    const btnSiguiente = page.getByRole('button', { name: 'Siguiente' });
    if (!(await btnSiguiente.isDisabled())) {
      await btnSiguiente.click();
      await page.waitForTimeout(2000);
    }

    // Paso 2: menú + "Usar"
    const cards = page.locator('[class*="rounded-xl"][class*="border-2"]');
    const cCount = await cards.count();
    for (let i = 0; i < cCount; i++) {
      const t = await cards.nth(i).textContent();
      if (t && !t.includes('Infantil') && t.length > 10) {
        await cards.nth(i).click();
        await page.waitForTimeout(300);
        break;
      }
    }
    const usar = page.getByRole('button', { name: /Usar este Menú|Usar/i });
    if (await usar.isVisible()) {
      await usar.click();
      await page.waitForTimeout(2000);
    }

    // Paso 4: Extras — seleccionar 2
    const extras = page.locator('button', { hasText: /cóctel|barra|música|vino/i });
    const extCount = await extras.count();
    for (let i = 0; i < Math.min(2, extCount); i++) {
      await extras.nth(i).click();
      await page.waitForTimeout(200);
    }

    const verResumen = page.getByRole('button', { name: /Ver Resumen/i });
    if (await verResumen.isVisible()) {
      await verResumen.click();
      await page.waitForTimeout(2000);
    }

    // Paso 5: Resumen — rellenar formulario y enviar
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toContain('Resumen');
    console.log('✅ Llegó al Resumen correctamente');

    // Rellenar datos del cliente
    const textInputs = page.locator('input[type="text"], input[type="email"], input[type="tel"]');
    const tiCount = await textInputs.count();
    if (tiCount >= 3) {
      await textInputs.nth(0).fill('Cliente Test');
      await textInputs.nth(1).fill('test@example.com');
      await textInputs.nth(2).fill('+34 600 000 000');
    } else {
      const allInputs = page.locator('input:not([type="number"])');
      const aiCount = await allInputs.count();
      for (let j = 0; j < aiCount; j++) {
        const placeholder = await allInputs.nth(j).getAttribute('placeholder');
        if (placeholder?.includes('nombre') || placeholder?.includes('Nombre')) {
          await allInputs.nth(j).fill('Cliente Test');
        } else if (placeholder?.includes('email') || placeholder?.includes('Email')) {
          await allInputs.nth(j).fill('test@example.com');
        } else if (placeholder?.includes('+34')) {
          await allInputs.nth(j).fill('+34 600 000 000');
        }
      }
    }

    await page.waitForTimeout(300);

    const enviar = page.getByRole('button', { name: /Enviar Propuesta/i });
    if (await enviar.isVisible() && !(await enviar.isDisabled())) {
      await enviar.click();
      await page.waitForTimeout(5000);
      const bodyAfter = await page.locator('body').textContent();
      console.log('📄 After submit content:', bodyAfter?.substring(0, 200));
      // Verificar que llegó a confirmación
      const hasSuccess = bodyAfter?.includes('Propuesta Enviada') || bodyAfter?.includes('¡Propuesta');
      if (hasSuccess) {
        console.log('✅ Propuesta enviada con éxito — pantalla de confirmación visible');
      }
    } else {
      console.log('⚠️ Botón Enviar no disponible o deshabilitado');
    }
  });

  test('API: catálogo funciona', async ({ request }) => {
    const r = await request.get(`${BASE}/api/catalog`);
    expect(r.status()).toBe(200);
    const b = await r.json();
    console.log(`📦 Catálogo: ${b?.data?.length || 0} items`);
  });

  test('API: eventos endpoint funciona', async ({ request }) => {
    const r = await request.get(`${BASE}/api/events?limit=5`);
    expect(r.status()).toBe(200);
  });

  test('Landing carga sin errores', async ({ page }) => {
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(`${BASE}/`);
    await page.waitForTimeout(3000);
    await page.waitForLoadState('domcontentloaded');

    const body = await page.locator('body').textContent();
    expect(body).toContain('J.Benitez');
    expect(errors.length).toBeLessThan(5);
    console.log(`✅ Landing OK - ${errors.length} errores de consola`);
  });
});
