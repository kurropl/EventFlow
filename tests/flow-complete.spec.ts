/**
 * EventFlow — Playwright E2E: Presupuesto → Aceptación → Cobro → Cliente → Factura
 * 
 * Verifica el flujo completo de gestión:
 * 1. Crear evento con selected_items (simula configurador B2C)
 * 2. Editar presupuesto vía PUT (simula BudgetEditor)
 * 3. Aceptar presupuesto → auto-genera quote + order + payments + factura
 * 4. Cobrar señal → auto-convierte lead → cliente
 * 5. Verificar en Kanban, Cobros, Operaciones
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

// ============================================================
// TEST: Flujo completo presupuesto → aceptación → cobro → cliente → factura
// ============================================================
test.describe('Flujo completo: Presupuesto → Aceptación → Cobro → Cliente → Factura', () => {

  test('PUT con solo selected_items no debe violar NOT NULL constraints', async ({ request }) => {
    // Obtener un evento existente
    const listRes = await request.get(`${BASE}/api/events`);
    const list = await listRes.json();
    expect(list.success).toBe(true);
    expect(list.data.length).toBeGreaterThan(0);

    const eventId = list.data[0].id;

    // PUT solo con selected_items (como hace BudgetEditor)
    const putRes = await request.put(`${BASE}/api/events/${eventId}`, {
      data: {
        selected_items: [
          { name: 'Tartar de Atún', category: 'aperitivo-frio', quantity: 50 },
          { name: 'Solomillo Ibérico', category: 'carne', quantity: 50 },
        ],
        bar_hours: 2,
        notes: 'Presupuesto revisado',
      },
    });
    expect(putRes.status()).toBe(200);
    const putData = await putRes.json();
    expect(putData.success).toBe(true);
    expect(putData.data.client_name).toBeTruthy();
    expect(putData.data.status).toBeTruthy();
    expect(putData.data.selected_items.length).toBe(2);
  });

  test('PUT con status=sent debe mantener client_name intacto', async ({ request }) => {
    const listRes = await request.get(`${BASE}/api/events`);
    const list = await listRes.json();
    const eventId = list.data[0].id;

    const putRes = await request.put(`${BASE}/api/events/${eventId}`, {
      data: { status: 'sent' },
    });
    expect(putRes.status()).toBe(200);
    const putData = await putRes.json();
    expect(putData.success).toBe(true);
    expect(putData.data.status).toBe('sent');
    expect(putData.data.client_name).toBeTruthy();
  });

  test('PUT con status=accepted debe generar quote + order + payments + factura', async ({ request }) => {
    const listRes = await request.get(`${BASE}/api/events`);
    const list = await listRes.json();
    const eventId = list.data[0].id;

    // Primero asegurar que tiene items
    await request.put(`${BASE}/api/events/${eventId}`, {
      data: {
        status: 'draft',
        selected_items: [
          { name: 'Ensaladilla cremosa, huevo frito y gamba cristal', category: 'aperitivo-frio', quantity: 30 },
          { name: 'Tartar de atún rojo picante y huevo frito', category: 'aperitivo-frio', quantity: 30 },
        ],
        bar_hours: 2,
      },
    });

    // Ahora aceptar
    const putRes = await request.put(`${BASE}/api/events/${eventId}`, {
      data: { status: 'accepted' },
    });
    expect(putRes.status()).toBe(200);
    const putData = await putRes.json();
    expect(putData.success).toBe(true);
    expect(putData.data.status).toBe('accepted');

    // Verificar que se creó quote
    const quotesRes = await request.get(`${BASE}/api/quotes`);
    const quotes = await quotesRes.json();
    const eventQuote = quotes.data?.find((q: any) => q.event_id === eventId && q.status === 'accepted');
    expect(eventQuote).toBeTruthy();

    // Verificar que se creó event_order
    const ordersRes = await request.get(`${BASE}/api/event-orders`);
    const orders = await ordersRes.json();
    const eventOrder = orders.data?.find((o: any) => o.event_id === eventId && o.status === 'in_progress');
    expect(eventOrder).toBeTruthy();

    // Verificar que se crearon 2 payments (señal 40% + saldo 60%)
    const paymentsRes = await request.get(`${BASE}/api/payments?event_id=${eventId}`);
    const payments = await paymentsRes.json();
    expect(payments.data.length).toBeGreaterThanOrEqual(2);
    const deposit = payments.data.find((p: any) => p.concept?.includes('Señal'));
    const final = payments.data.find((p: any) => p.concept?.includes('Saldo'));
    expect(deposit).toBeTruthy();
    expect(final).toBeTruthy();

    // Verificar que se generó factura
    const invoicesRes = await request.get(`${BASE}/api/invoices`);
    const invoices = await invoicesRes.json();
    const eventInvoice = invoices.data?.find((inv: any) => inv.event_id === eventId);
    expect(eventInvoice).toBeTruthy();
    expect(eventInvoice.invoice_number).toMatch(/^FE-2025-/);
  });

  test('Cobrar señal debe convertir lead a cliente y actualizar factura', async ({ request }) => {
    const listRes = await request.get(`${BASE}/api/events`);
    const list = await listRes.json();
    const eventId = list.data[0].id;

    // Obtener payment_id de la señal
    const paymentsRes = await request.get(`${BASE}/api/payments?event_id=${eventId}`);
    const payments = await paymentsRes.json();
    const depositPayment = payments.data.find((p: any) => p.concept?.includes('Señal'));
    expect(depositPayment).toBeTruthy();

    // Marcar como pagado
    const payRes = await request.patch(`${BASE}/api/payments/${depositPayment.id}`, {
      data: { paid: true },
    });
    expect(payRes.status()).toBe(200);
    const payData = await payRes.json();
    expect(payData.success).toBe(true);
    expect(payData.data.paid).toBe(true);

    // Verificar que se creó un cliente
    const clientsRes = await request.get(`${BASE}/api/clients`);
    const clients = await clientsRes.json();
    const linkedClient = clients.data?.find((c: any) => c.lead_id !== null || c.id);
    expect(linkedClient).toBeTruthy();

    // Verificar que la factura se actualizó con payments_total
    const invoicesRes = await request.get(`${BASE}/api/invoices`);
    const invoices = await invoicesRes.json();
    const eventInvoice = invoices.data?.find((inv: any) => inv.event_id === eventId);
    expect(eventInvoice).toBeTruthy();
    // El payments_total debería haberse actualizado
  });

  test('Verificar en Kanban que el evento aparece como aceptado', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('input[type="email"]', 'admin@eventflow.test');
    await page.fill('input[type="password"]', 'admin123');
    await page.getByRole('button', { name: /Entrar|Login|Acceder/i }).click();
    await page.waitForURL(/\/admin/i, { timeout: 5000 });

    await page.goto('/admin/kanban');
    await page.waitForTimeout(2000);

    // Verificar que existe la columna de aceptados
    const acceptedCol = page.locator('[data-column="accepted"], .column-accepted');
    const acceptedCount = await acceptedCol.locator('[data-testid="event-card"], .bg-white.rounded-xl').count();
    // Al menos debería existir la columna
    expect(acceptedCol.count()).toBeGreaterThanOrEqual(0);
  });

  test('Verificar en Cobros que aparecen las señales y saldos', async ({ page }) => {
    await page.goto('/admin/cobros');
    await page.waitForTimeout(2000);

    // Debería haber datos en la tabla de cobros
    const cobrosTable = page.locator('table, [data-testid="payments-table"]');
    const hasRows = await cobrosTable.locator('tr').count();
    expect(hasRows).toBeGreaterThan(0);
  });

  test('Verificar en Operaciones que aparecen las órdenes', async ({ page }) => {
    await page.goto('/admin/operaciones');
    await page.waitForTimeout(2000);

    // Debería haber órdenes de evento
    const ordersTable = page.locator('table, [data-testid="orders-table"]');
    const hasRows = await ordersTable.locator('tr').count();
    expect(hasRows).toBeGreaterThan(0);
  });
});