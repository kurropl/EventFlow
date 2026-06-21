# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: configurador-full.spec.js >> Admin — API Tests >> API /api/events devuelve array
- Location: tests/configurador-full.spec.js:414:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: true
Received: false
```

# Test source

```ts
  316 |     // Find checkable items and verify
  317 |     const checkboxes = await page.locator('input[type="checkbox"], [role="checkbox"]').all();
  318 |     console.log('Checkable items:', checkboxes.length);
  319 |   });
  320 | });
  321 | 
  322 | // ============================================================
  323 | // STEP 4: Extras y Barra Libre
  324 | // ============================================================
  325 | test.describe('PASO 4 — Extras y Barra Libre', () => {
  326 |   test('Barra libre seleccionable sin error', async ({ page }) => {
  327 |     await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
  328 |     await goToStep2(page);
  329 |     await page.waitForTimeout(500);
  330 |     // Use menu directly
  331 |     await page.locator('button:has(h4)').first().click();
  332 |     await page.waitForTimeout(300);
  333 |     await page.locator('button', { hasText: 'Usar' }).click();
  334 |     await page.waitForTimeout(2000);
  335 | 
  336 |     // On step 4, try clicking bar options
  337 |     const barOptions = page.locator('button').filter({ hasText: /hora|Barra|sin barra/i });
  338 |     const count = await barOptions.count();
  339 |     console.log('Bar options:', count);
  340 |     if (count > 0) {
  341 |       await barOptions.first().click();
  342 |       await page.waitForTimeout(300);
  343 |     }
  344 |   });
  345 | });
  346 | 
  347 | // ============================================================
  348 | // STEP 5: Formulario de Cliente y Envío
  349 | // ============================================================
  350 | test.describe('PASO 5 — Envío y Confirmación', () => {
  351 |   test('Flujo completo: Boda → Menú → Extras → Resumen → Envío', async ({ page }) => {
  352 |     const errors = setupErrorCapture(page);
  353 |     
  354 |     await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
  355 |     await goToStep2(page);
  356 |     await page.waitForTimeout(500);
  357 | 
  358 |     // Select menu and use
  359 |     await page.locator('button:has(h4)').first().click();
  360 |     await page.waitForTimeout(300);
  361 |     await page.locator('button', { hasText: 'Usar' }).click();
  362 |     await page.waitForTimeout(2000);
  363 | 
  364 |     // On step 4, click "Resumen" or "Continuar"
  365 |     const resumeBtn = page.locator('button').filter({ hasText: /Resumen|Continuar|Solicitar/i });
  366 |     if (await resumeBtn.count() > 0) {
  367 |       await resumeBtn.first().click();
  368 |       await page.waitForTimeout(2000);
  369 |     }
  370 | 
  371 |     // Fill client info if on step 5
  372 |     const nameInput = page.locator('input[type="text"]').first();
  373 |     if (await nameInput.isVisible()) {
  374 |       await nameInput.fill('Test Cliente');
  375 |       await page.locator('input[type="email"]').fill('test@example.com');
  376 |       await page.locator('input[type="tel"]').fill('600000000');
  377 |     }
  378 | 
  379 |     // Submit
  380 |     const submitBtn = page.locator('button').filter({ hasText: /Enviar|Confirmar|Solicitar/i });
  381 |     if (await submitBtn.count() > 0) {
  382 |       await submitBtn.first().click();
  383 |       await page.waitForTimeout(3000);
  384 |     }
  385 | 
  386 |     console.log('Flow complete errors:', errors);
  387 |     // No errors is success
  388 |     expect(errors.filter(e => !e.includes('favicon')).length).toBe(0);
  389 |   });
  390 | 
  391 |   test('Envío sin datos de cliente muestra error', async ({ page }) => {
  392 |     await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
  393 |     await goToStep2(page);
  394 |     await page.waitForTimeout(500);
  395 |     await page.locator('button:has(h4)').first().click();
  396 |     await page.waitForTimeout(300);
  397 |     await page.locator('button', { hasText: 'Usar' }).click();
  398 |     await page.waitForTimeout(2000);
  399 | 
  400 |     // Click submit without filling data
  401 |     const submitBtn = page.locator('button').filter({ hasText: /Enviar|Confirmar|Solicitar/i });
  402 |     if (await submitBtn.count() > 0) {
  403 |       // Should be disabled without name/email
  404 |       const disabled = await submitBtn.first().isDisabled();
  405 |       console.log('Submit disabled without data:', disabled);
  406 |     }
  407 |   });
  408 | });
  409 | 
  410 | // ============================================================
  411 | // ADMIN: API endpoints
  412 | // ============================================================
  413 | test.describe('Admin — API Tests', () => {
  414 |   test('API /api/events devuelve array', async ({ page }) => {
  415 |     const response = await page.request.get(`${BASE_URL}/api/events`);
> 416 |     expect(response.ok()).toBe(true);
      |                           ^ Error: expect(received).toBe(expected) // Object.is equality
  417 |     const data = await response.json();
  418 |     expect(Array.isArray(data.data || data)).toBe(true);
  419 |   });
  420 | 
  421 |   test('API /api/catalog devuelve items', async ({ page }) => {
  422 |     const response = await page.request.get(`${BASE_URL}/api/catalog`);
  423 |     expect(response.ok()).toBe(true);
  424 |     const data = await response.json();
  425 |     expect(Array.isArray(data.data || data)).toBe(true);
  426 |   });
  427 | 
  428 |   test('API /api/proposed-menus devuelve menús', async ({ page }) => {
  429 |     const response = await page.request.get(`${BASE_URL}/api/proposed-menus`);
  430 |     expect(response.ok()).toBe(true);
  431 |     const data = await response.json();
  432 |     expect(Array.isArray(data.data || data)).toBe(true);
  433 |   });
  434 | });
  435 | 
  436 | // ============================================================
  437 | // FLUJO COMPLETO: varias configuraciones
  438 | // ============================================================
  439 | test.describe('Flujos completos — Combinaciones', () => {
  440 |   test('Cumpleaños + 50 adultos + 10 niños + Menú 2 + Personalizar', async ({ page }) => {
  441 |     const errors = setupErrorCapture(page);
  442 |     
  443 |     await fillStep1(page, { eventType: 'Cumpleaños', month: MONTH, day: DAY, year: YEAR, adults: 50, kids: 10 });
  444 |     await goToStep2(page);
  445 |     await page.waitForTimeout(500);
  446 | 
  447 |     // Select Menu 2 (adult) and a kid menu
  448 |     const menuCards = page.locator('[class*="flex"] button:has(h4), button:has(h4)');
  449 |     const visibleCards = await menuCards.all();
  450 |     console.log('Menu cards found:', visibleCards.length);
  451 |     for (const card of visibleCards) {
  452 |       const txt = await card.textContent();
  453 |       if (txt.includes('Menú 2') || txt.includes('menu2') || (!txt.includes('Infantil') && !txt.includes('Niño'))) {
  454 |         // First non-kid menu
  455 |         const cardsWithText = await page.locator('button:has(h4)').all();
  456 |         // Click first non-kid card
  457 |         for (const c of cardsWithText) {
  458 |           const t = await c.textContent();
  459 |           if (!t.includes('Infantil') && !t.includes('Niño')) {
  460 |             await c.click();
  461 |             break;
  462 |           }
  463 |         }
  464 |         break;
  465 |       }
  466 |     }
  467 |     await page.waitForTimeout(300);
  468 | 
  469 |     // Try to find kid menu
  470 |     const kidCards = page.locator('button:has(h4)').filter({ hasText: /Infantil|Niño/i });
  471 |     if (await kidCards.count() > 0) {
  472 |       await kidCards.first().click();
  473 |       await page.waitForTimeout(300);
  474 |     }
  475 | 
  476 |     // Personalizar
  477 |     const customBtn = page.locator('button', { hasText: 'Personalizar' });
  478 |     if (await customBtn.isEnabled()) {
  479 |       await customBtn.click();
  480 |       await page.waitForTimeout(2000);
  481 |       console.log('Reached step 3 (customization)');
  482 |     }
  483 | 
  484 |     expect(errors.filter(e => !e.includes('favicon')).length).toBe(0);
  485 |   });
  486 | 
  487 |   test('Corporativo + 100 adultos + sin niños + Menú 1 + Usar + 2h barra', async ({ page }) => {
  488 |     const errors = setupErrorCapture(page);
  489 |     
  490 |     await fillStep1(page, { eventType: 'Corporativo', month: MONTH, day: DAY, year: YEAR, adults: 100, kids: 0 });
  491 |     await goToStep2(page);
  492 |     await page.waitForTimeout(500);
  493 | 
  494 |     // Select Menu 1
  495 |     await page.locator('button:has(h4)').first().click();
  496 |     await page.waitForTimeout(300);
  497 |     await page.locator('button', { hasText: 'Usar' }).click();
  498 |     await page.waitForTimeout(2000);
  499 | 
  500 |     // Select 2h bar if available
  501 |     const barBtns = page.locator('button').filter({ hasText: /2 hora|2h/i });
  502 |     if (await barBtns.count() > 0) {
  503 |       await barBtns.first().click();
  504 |       await page.waitForTimeout(300);
  505 |     }
  506 | 
  507 |     expect(errors.length).toBe(0);
  508 |   });
  509 | });
  510 | 
```