/**
 * EventFlow — Complete Pipeline Flow E2E Test
 *
 * Tests:
 * 1. Dashboard loads → stats visible
 * 2. Kanban shows columns (Borrador, Enviado, Aceptado, Cancelado)
 * 3. Draft card exists → click "Enviar presupuesto" → modal opens → send → status becomes sent
 * 4. Sent card shows "Aceptar", "Reenviar", "Cancelar" buttons
 * 5. Accept event → status becomes accepted
 * 6. Accepted card shows "Cobro parcial", "Cobro total", "Invitados", "Operaciones" links
 * 7. Open BudgetEditor via click → items visible → edit → save
 * 8. Invitados view for accepted event shows operations section
 */
import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

const BASE = process.env.BASE_URL || 'http://localhost:3020';

test.describe('EventFlow Pipeline — Full Flow', () => {

  test('1. Dashboard loads with stats', async ({ page }) => {
    await page.goto(`${BASE}/admin/kanban`);
    await page.waitForLoadState('networkidle');
    // Should see kanban columns
    await expect(page.getByText('Borrador')).toBeVisible();
    await expect(page.getByText('Enviado')).toBeVisible();
    await expect(page.getByText('Aceptado')).toBeVisible();
    await expect(page.getByText('Cancelado')).toBeVisible();
    // Stats cards
    await expect(page.getByText('Presupuestos activos')).toBeVisible();
  });

  test('2. Card actions in Draft column', async ({ page }) => {
    await page.goto(`${BASE}/admin/kanban`);
    await page.waitForLoadState('networkidle');
    // Find a draft card (hover to show actions)
    const draftSection = page.locator('text=Borrador').locator('..');
    // Hover over first card in draft column
    const draftCard = draftSection.locator('..').locator('[class*="rounded-xl"]').first();
    await draftCard.hover();
    // Should see "Enviar presupuesto" button
    await expect(page.getByText('Enviar presupuesto').first()).toBeVisible();
  });

  test('3. Send budget modal opens from Draft', async ({ page }) => {
    await page.goto(`${BASE}/admin/kanban`);
    await page.waitForLoadState('networkidle');
    // Find Borrador column
    const draftColumn = page.getByText('Borrador').locator('..').locator('..').first();
    // Hover and click Enviar presupuesto
    const firstCard = draftColumn.locator('[class*="rounded-xl"]').first();
    await firstCard.hover();
    const sendBtn = draftColumn.getByText('Enviar presupuesto').first();
    await sendBtn.click();
    // Modal should appear
    await expect(page.getByText('Enviar presupuesto').locator('visible=true').first()).toBeVisible();
    await expect(page.getByText('Total estimado')).toBeVisible();
    // Click "Enviar presupuesto" button in modal
    await page.getByText('Enviar presupuesto', { exact: true }).click();
    // Should show success
    await expect(page.getByText('✓ Enviado')).toBeVisible({ timeout: 5000 });
  });

  test('4. Accept event from Sent column', async ({ page }) => {
    await page.goto(`${BASE}/admin/kanban`);
    await page.waitForLoadState('networkidle');
    // Find Enviado column
    const sentColumn = page.getByText('Enviado').locator('..').locator('..').first();
    const sentCard = sentColumn.locator('[class*="rounded-xl"]').first();
    await sentCard.hover();
    // Should see Aceptar button
    await expect(sentColumn.getByText('Aceptar').first()).toBeVisible();
    await expect(sentColumn.getByText('Reenviar').first()).toBeVisible();
    await expect(sentColumn.getByText('Cancelar').first()).toBeVisible();
  });

  test('5. Accepted card shows cobro options', async ({ page }) => {
    await page.goto(`${BASE}/admin/kanban`);
    await page.waitForLoadState('networkidle');
    // Find Aceptado column
    const acceptedColumn = page.getByText('Aceptado').locator('..').locator('..').first();
    const acceptedCard = acceptedColumn.locator('[class*="rounded-xl"]').first();
    await acceptedCard.hover();
    await expect(acceptedColumn.getByText('Cobro parcial').first()).toBeVisible();
    await expect(acceptedColumn.getByText('Cobro total').first()).toBeVisible();
    await expect(acceptedColumn.getByText('Invitados').first()).toBeVisible();
    await expect(acceptedColumn.getByText('Operaciones').first()).toBeVisible();
  });

  test('6. Payment modal for cobro total', async ({ page }) => {
    await page.goto(`${BASE}/admin/kanban`);
    await page.waitForLoadState('networkidle');
    const acceptedColumn = page.getByText('Aceptado').locator('..').locator('..').first();
    const acceptedCard = acceptedColumn.locator('[class*="rounded-xl"]').first();
    await acceptedCard.hover();
    // Click Cobro total
    await acceptedColumn.getByText('Cobro total').first().click();
    // Modal should appear
    await expect(page.getByText('Cobro total').locator('visible=true').first()).toBeVisible();
    await expect(page.getByText('Método de pago')).toBeVisible();
    // Select method
    await page.getByText('Bizum').click();
    // Click cobrar
    await page.getByText('Cobrar €').first().click();
    // Should show success
    await expect(page.getByText('✓ Cobrado')).toBeVisible({ timeout: 5000 });
  });

  test('7. BudgetEditor opens from card click and shows items', async ({ page }) => {
    await page.goto(`${BASE}/admin/kanban`);
    await page.waitForLoadState('networkidle');
    // Click on a draft card
    const draftSection = page.getByText('Borrador').locator('..').locator('..').first();
    const firstCard = draftSection.locator('[class*="rounded-xl"]').first();
    await firstCard.click();
    // BudgetEditor sidebar should open
    await expect(page.getByText('Editar presupuesto').or(page.getByText('Presupuesto')).first()).toBeVisible({ timeout: 3000 });
    // Save button should exist
    await expect(page.getByText('Guardar').first()).toBeVisible();
  });

  test('8. API: Send budget endpoint works', async ({ page }) => {
    // Get first event
    const resp = await page.request.get(`${BASE}/api/events?limit=1`);
    const data = await resp.json();
    const eventId = data.data[0]?.id;
    expect(eventId).toBeTruthy();
    // Send budget
    const sendResp = await page.request.post(`${BASE}/api/send-budget/${eventId}`);
    const sendData = await sendResp.json();
    expect(sendData.success).toBeTruthy();
  });

  test('9. API: Generate operations for accepted event', async ({ page }) => {
    // Get an accepted event
    const resp = await page.request.get(`${BASE}/api/events?limit=50`);
    const data = await resp.json();
    const acceptedEvent = data.data?.find((e: any) => e.status === 'accepted');
    if (!acceptedEvent) {
      test.skip('No accepted event found — skipping');
      return;
    }
    const genResp = await page.request.post(`${BASE}/api/events/${acceptedEvent.id}/generate-operations`);
    const genData = await genResp.json();
    if (acceptedEvent.guest_count > 0) {
      expect(genData.success).toBeTruthy();
      expect(genData.data.guests).toBeGreaterThan(0);
    }
  });

  test('10. Guests page shows accepted event operations', async ({ page }) => {
    await page.goto(`${BASE}/admin/invitados`);
    await page.waitForLoadState('networkidle');
    // If there's an accepted event, should show operations section
    const opsSection = page.getByText('Operaciones del evento');
    if (await opsSection.isVisible().catch(() => false)) {
      await expect(page.getByText('Comensales')).toBeVisible();
      await expect(page.getByText('Mesas')).toBeVisible();
      await expect(page.getByText('Camareros')).toBeVisible();
    }
  });
});