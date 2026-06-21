# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: configurador-full.spec.js >> PASO 1 — Detalles del Evento >> Todos los tipos de evento: "Cumpleaños" se selecciona sin error
- Location: tests/configurador-full.spec.js:63:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('button').filter({ hasText: 'Cumpleaños' })

```

# Page snapshot

```yaml
- generic [ref=e2]: Cannot GET /configurador
```

# Test source

```ts
  1   | /**
  2   |  * EventFlow — Test completo del Configurador B2C
  3   |  * Cubre todas las variables: tipos de evento, niños, menús, personalización, extras, envío
  4   |  *
  5   |  * Ejecutar: npx playwright test tests/configurador-full.spec.js --headed
  6   |  */
  7   | 
  8   | const { test, expect } = require('@playwright/test');
  9   | const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  10  | 
  11  | const TODAY = new Date();
  12  | const MONTH = String(TODAY.getMonth() + 1).padStart(2, '0');
  13  | const DAY = String(TODAY.getDate()).padStart(2, '0');
  14  | const YEAR = String(TODAY.getFullYear());
  15  | 
  16  | // Helper: fill step 1 form
  17  | async function fillStep1(page, { eventType, month, day, year, adults, kids }) {
  18  |   await page.goto(`${BASE_URL}/configurador`);
  19  |   await page.waitForLoadState('domcontentloaded');
  20  |   await page.waitForTimeout(1000);
  21  | 
  22  |   // Click event type button
> 23  |   await page.locator('button', { hasText: eventType }).click();
      |                                                        ^ Error: locator.click: Test timeout of 60000ms exceeded.
  24  |   await page.waitForTimeout(300);
  25  | 
  26  |   // Date
  27  |   const selects = page.locator('select');
  28  |   if (month) await selects.nth(0).selectOption(month);
  29  |   if (day) await selects.nth(1).selectOption(day);
  30  |   if (year) await selects.nth(2).selectOption(year);
  31  |   await page.waitForTimeout(200);
  32  | 
  33  |   // Guests
  34  |   const inputs = page.locator('input[type="number"]');
  35  |   await inputs.nth(0).fill(String(adults));
  36  |   if (kids !== undefined) await inputs.nth(1).fill(String(kids));
  37  |   await page.waitForTimeout(300);
  38  | }
  39  | 
  40  | // Helper: navigate step1 → step2
  41  | async function goToStep2(page) {
  42  |   const btn = page.locator('button', { hasText: 'Siguiente' });
  43  |   await expect(btn).toBeEnabled({ timeout: 2000 });
  44  |   await btn.click();
  45  |   await page.waitForTimeout(1500);
  46  | }
  47  | 
  48  | // Helper: capture console errors
  49  | function setupErrorCapture(page) {
  50  |   const errors = [];
  51  |   page.on('pageerror', err => errors.push(err.message));
  52  |   page.on('console', msg => {
  53  |     if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  54  |   });
  55  |   return errors;
  56  | }
  57  | 
  58  | // ============================================================
  59  | // STEP 1: Tipo de evento, fecha y comensales
  60  | // ============================================================
  61  | test.describe('PASO 1 — Detalles del Evento', () => {
  62  |   for (const evt of ['Boda', 'Cumpleaños', 'Corporativo', 'Bautizo', 'Comunion', 'Otro']) {
  63  |     test(`Todos los tipos de evento: "${evt}" se selecciona sin error`, async ({ page }) => {
  64  |       const errors = setupErrorCapture(page);
  65  |       await fillStep1(page, { eventType: evt, month: MONTH, day: DAY, year: YEAR, adults: 20 });
  66  |       expect(errors.length).toBe(0);
  67  |     });
  68  |   }
  69  | 
  70  |   test('Fecha se precarga correctamente', async ({ page }) => {
  71  |     await page.goto(`${BASE_URL}/configurador`);
  72  |     await page.waitForLoadState('domcontentloaded');
  73  |     await page.waitForTimeout(1000);
  74  | 
  75  |     const selectValues = await page.evaluate(() => {
  76  |       const s = document.querySelectorAll('select');
  77  |       return Array.from(s).map(x => x.value);
  78  |     });
  79  |     console.log('Precargados:', selectValues);
  80  |     // At minimum the month/day/year selects have values, not empty
  81  |     expect(selectValues.every(v => v !== '')).toBe(true);
  82  |   });
  83  | 
  84  |   test('Siguiente habilitado con datos válidos', async ({ page }) => {
  85  |     await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 30 });
  86  |     const btn = page.locator('button', { hasText: 'Siguiente' });
  87  |     await expect(btn).toBeEnabled({ timeout: 2000 });
  88  |   });
  89  | 
  90  |   test('Siguiente deshabilitado sin tipo evento', async ({ page }) => {
  91  |     await page.goto(`${BASE_URL}/configurador`);
  92  |     await page.waitForLoadState('domcontentloaded');
  93  |     await page.waitForTimeout(1000);
  94  |     // Fill date and guests but don't select event type
  95  |     const selects = page.locator('select');
  96  |     await selects.nth(0).selectOption(MONTH);
  97  |     await selects.nth(1).selectOption(DAY);
  98  |     await selects.nth(2).selectOption(YEAR);
  99  |     await page.locator('input[type="number"]').nth(0).fill('20');
  100 |     const btn = page.locator('button', { hasText: 'Siguiente' });
  101 |     await expect(btn).toBeDisabled();
  102 |   });
  103 | 
  104 |   test('Siguiente deshabilitado sin comensales', async ({ page }) => {
  105 |     await page.goto(`${BASE_URL}/configurador`);
  106 |     await page.waitForLoadState('domcontentloaded');
  107 |     await page.waitForTimeout(1000);
  108 |     await page.locator('button', { hasText: 'Boda' }).click();
  109 |     const btn = page.locator('button', { hasText: 'Siguiente' });
  110 |     await expect(btn).toBeDisabled();
  111 |   });
  112 | 
  113 |   test('Siguiente deshabilitado con menos de 10 adultos', async ({ page }) => {
  114 |     await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 5 });
  115 |     const btn = page.locator('button', { hasText: 'Siguiente' });
  116 |     await expect(btn).toBeDisabled();
  117 |   });
  118 | 
  119 |   test('Niños: 0 permite menú solo adultos', async ({ page }) => {
  120 |     const errors = setupErrorCapture(page);
  121 |     await fillStep1(page, { eventType: 'Boda', month: MONTH, day: DAY, year: YEAR, adults: 20, kids: 0 });
  122 |     await goToStep2(page);
  123 |     expect(errors.length).toBe(0);
```