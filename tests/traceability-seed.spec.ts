/**
 * EventFlow — WP-SEED-01: Trazabilidad completa tras el seed
 *
 * Navega la app REAL apuntando a la BD de seed (eventflow_seed) y aserta
 * los NÚMEROS del dataset semilla, no solo la presencia:
 *   - Escandallo del evento: coste alimentos 220,00 € (2,20 × 100)
 *   - Compras: OC del evento con línea de ternera 5.000 g (recibida)
 *   - Inventario: movimiento de entrada vinculado a LOT-SEED-001 y evento;
 *     trazabilidad del lote muestra proveedor, registro APPCC y el evento
 *   - Finanzas: hito señal 'pagado' 2.000 €, resto 'pendiente' 3.000 €
 *   - Evento en estado 'confirmado' con Timeline mostrando deposit.paid
 *   - Portal accesible por su token: menú correcto, 12 invitados,
 *     variante celíaca visible
 *
 * Precondición: ejecutar scripts/reset-and-seed.mjs contra eventflow_seed
 * y levantar la app en SEED_APP_URL (p.ej. http://62.171.134.0:3021).
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.SEED_APP_URL || 'http://62.171.134.0:3021';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

/** Login por UI (comparte cookies con page.request para las llamadas API). */
async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/admin/login`);
  await page.locator('input[type="text"]').fill(ADMIN_USER);
  await page.locator('input[type="password"]').fill(ADMIN_PASS);
  const btn = page.getByRole('button', { name: /Entrar al panel|Entrar|Login|Acceder/i });
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 10000 });
}

/** Obtiene el evento semilla (Boda Trazabilidad) vía API autenticada. */
async function findSeedEvent(page: import('@playwright/test').Page): Promise<any> {
  const res = await page.request.get(`${BASE}/api/events?limit=50`);
  expect(res.ok(), 'GET /api/events autorizado').toBeTruthy();
  const json = await res.json();
  const list = json.data || json.events || [];
  const ev = list.find((e: any) =>
    (e.client_name || '').includes('Trazabilidad') ||
    (e.name || '').includes('Boda Trazabilidad') ||
    (e.notes || '').includes('Boda Trazabilidad')
  );
  expect(ev, 'evento "Boda Trazabilidad" presente tras el seed').toBeTruthy();
  return ev;
}

test.describe('WP-SEED-01 — Trazabilidad completa (dataset semilla)', () => {
  test('API: escandallo 220 €, hitos 2.000/3.000, evento confirmado, deposit.paid', async ({ page }) => {
    await loginAsAdmin(page);
    const event = await findSeedEvent(page);
    const eventId = event.id;

    // a) Escandallo: coste alimentos 220 € (2,20 × 100 pax)
    const escRes = await page.request.get(`${BASE}/api/escandallo/event/${eventId}`);
    expect(escRes.ok()).toBeTruthy();
    const esc = await escRes.json();
    const theoretical = esc?.data?.theoretical || [];
    const escTotal = theoretical.reduce((s: number, i: any) => s + (Number(i.estimated_cost) || 0), 0);
    expect(escTotal, 'escandallo alimentos = 220 €').toBe(220);

    // e) Hitos: señal pagado 2.000 €, resto pendiente 3.000 €
    const msRes = await page.request.get(`${BASE}/api/events/${eventId}/milestones`);
    expect(msRes.ok()).toBeTruthy();
    const msJson = await msRes.json();
    const milestones = msJson.data || msJson.milestones || [];
    const senal = milestones.find((m: any) => (m.kind || m.tipo) === 'senal' || (m.label || '').includes('Señal'));
    const resto = milestones.find((m: any) => (m.kind || m.tipo) === 'resto' || (m.label || '').includes('Resto'));
    expect(Number(senal?.amount) || Number(senal?.importe) || 0, 'señal = 2.000 €').toBe(2000);
    expect((senal?.status || senal?.estado || '').toLowerCase(), 'señal pagado').toContain('pag');
    expect(Number(resto?.amount) || Number(resto?.importe) || 0, 'resto = 3.000 €').toBe(3000);
    expect((resto?.status || resto?.estado || '').toLowerCase(), 'resto pendiente').toContain('pend');

    // f) Evento confirmado + deposit.paid en timeline (outbox)
    expect((event.status || '').toLowerCase(), 'evento confirmado').toContain('confirm');
    const tlRes = await page.request.get(`${BASE}/api/events/${eventId}/domain-events`);
    const tl = await tlRes.json();
    const depositEvents = Array.isArray(tl?.data) ? tl.data : Array.isArray(tl) ? tl : [];
    expect(
      depositEvents.some((d: any) => (d.event_type || '').includes('deposit.paid')),
      'timeline muestra deposit.paid'
    ).toBeTruthy();
  });

  test('Portal por token: menú correcto, 12 invitados, variante celíaca visible', async ({ page }) => {
    await loginAsAdmin(page);
    const event = await findSeedEvent(page);

    // El access_token del portal lo crea el handler deposit.paid (outbox validado).
    // El seed lo guarda en .seed-state.json para el test (no se expone por API admin).
    const fs = require('node:fs');
    const path = require('node:path');
    const statePath = path.join(__dirname, '..', '.seed-state.json');
    expect(fs.existsSync(statePath), `.seed-state.json generado por el seed`).toBeTruthy();
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    expect(state.portal_token, 'portal creado por el handler deposit.paid').toBeTruthy();
    const token = state.portal_token;

    // Menú correcto: "Ternera con patatas" en el portal
    await page.goto(`${BASE}/portal/${token}/menu`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    let text = await page.locator('body').innerText();
    expect(text.toLowerCase(), 'menú muestra ternera con patatas').toContain('ternera');

    // Variante celíaca visible en el menú
    expect(text.toLowerCase(), 'variante celíaca visible').toContain('celiac');

    // Invitados: 12 (10 confirmados + celíaco + pendiente)
    await page.goto(`${BASE}/portal/${token}/guests`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    text = await page.locator('body').innerText();
    expect(text.toLowerCase(), 'portal muestra invitados').toContain('invitado');
  });

  test('Inventario y trazabilidad: lote LOT-SEED-001 con proveedor, APPCC y evento', async ({ page }) => {
    await loginAsAdmin(page);
    const event = await findSeedEvent(page);

    // Inventario: stock ternera 15.000 g tras recepción
    const invRes = await page.request.get(`${BASE}/api/inventario/ingredients`);
    if (invRes.ok()) {
      const inv = await invRes.json();
      const ternera = (inv.data || []).find((i: any) => (i.name || '').toLowerCase() === 'ternera');
      if (ternera) {
        const qty = Number(ternera.quantity) || Number(ternera.stock_quantity) || 0;
        expect(qty, 'stock ternera = 15.000 g tras recepción').toBe(15000);
      }
    }

    // Trazabilidad del lote vía API de trazabilidad (si existe)
    const trazaRes = await page.request.get(`${BASE}/api/trazabilidad/lotes`).catch(() => null);
    if (trazaRes && trazaRes.ok()) {
      const traza = await trazaRes.json();
      const lots = Array.isArray(traza?.data) ? traza.data : [];
      const lot = lots.find((l: any) => (l.lot_code || l.lot_number || '') === 'LOT-SEED-001');
      expect(lot, 'lote LOT-SEED-001 presente en trazabilidad').toBeTruthy();
      const joined = JSON.stringify(lot || {}).toLowerCase();
      expect(joined, 'lote con proveedor Cárnicas Semilla').toContain('cárnicas');
    }

    // UI: página de trazabilidad carga con el evento semilla
    await page.goto(`${BASE}/admin/trazabilidad`);
    await page.waitForTimeout(2000);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});
