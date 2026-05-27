import { test, expect } from '@playwright/test';

test.describe('Configurador B2C - Wizard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://eventcater.duckdns.org/configurador');
    await page.waitForLoadState('networkidle');
  });

  test('Step 1 → Step 2: should advance after filling details', async ({ page }) => {
    // Wait for step 1 to render
    await expect(page.getByText('Detalles del Evento')).toBeVisible({ timeout: 10000 });

    // Select event type "Boda"
    await page.getByRole('button', { name: /boda/i }).click();

    // Set date
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill('2026-12-15');

    // Set guest count (must be >= 10 per Zod schema)
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('50');
    await numberInputs.nth(1).fill('5');

    // Check that the button is enabled
    const nextBtn = page.getByRole('button', { name: /elegir men/i });
    await expect(nextBtn).toBeEnabled({ timeout: 3000 });

    // Click next
    await nextBtn.click();

    // Wait for step 2 to appear
    await page.waitForTimeout(1500);
    
    // Check if we moved to step 2
    const step2Text = page.getByText(/menús propuestos/i);
    const stillStep1 = page.getByText('Detalles del Evento');
    
    console.log('Step 2 text visible:', await step2Text.isVisible().catch(() => false));
    console.log('Still on step 1:', await stillStep1.isVisible().catch(() => false));
    
    // Check browser console for errors
    const errors = await page.evaluate(() => {
      return window.__NEXT_DATA__ || 'no next data';
    }).catch(() => 'error getting data');
    
    console.log('Page errors:', errors);
  });

  test('Check Zod validation errors silently caught', async ({ page }) => {
    // This test checks if the store silently fails on validation
    await expect(page.getByText('Detalles del Evento')).toBeVisible({ timeout: 10000 });
    
    // Fill form with MINIMAL data (guest_count = 1, which fails Zod min(10))
    await page.getByRole('button', { name: /boda/i }).click();
    const dateInput = page.locator('input[type="date"]');
    await dateInput.fill('2026-12-15');
    const numberInputs = page.locator('input[type="number"]');
    await numberInputs.nth(0).fill('1'); // Only 1 guest - should PASS canProceed but FAIL Zod
    
    const nextBtn = page.getByRole('button', { name: /elegir men/i });
    console.log('Button enabled (1 guest):', await nextBtn.isEnabled());
    
    await nextBtn.click();
    await page.waitForTimeout(1000);
    
    // Check if we stayed on step 1 (Zod validation failed silently)
    console.log('Still on step 1:', await page.getByText('Detalles del Evento').isVisible());
    console.log('Moved to step 2:', await page.getByText(/menús propuestos/i).isVisible().catch(() => false));
  });
});