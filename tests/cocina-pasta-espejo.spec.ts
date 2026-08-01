/**
 * EventFlow — Test de Cocina con receta "PASTA ESPEJO" (importada de Excel)
 *
 * Verifica la cadena completa de cocina a partir de la ficha técnica
 * C:\Users\Kurro\Downloads\PASTA ESPEJO.xlsx:
 *   - Receta importada con 5 ingredientes, alérgenos y merma 20%
 *   - Costes por línea correctos (precio del Excel, no del catálogo)
 *   - Escandallo 100 pax = 1.454,79 € (14,55 €/pax sin merma)
 *   - Vista de recetas en el módulo Cocina
 *   - Vista de escandallos por evento
 *
 * Precondición: receta importada vía /api/recipes/import y evento de test
 * con event_shopping_items generados.
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://eventcater.duckdns.org';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';

/** Números esperados (del Excel PASTA ESPEJO): */
const ESPERADO = {
  // coste/pax del Excel (sin merma) = 14,5479 €
  coste_pax_sin_merma: 14.5479,
  // coste/pax con merma 20% = 17,4575 €
  coste_pax_con_merma: 17.4575,
  // escandallo 100 pax sin merma = 1.454,79 €
  total_escandallo_100pax: 1454.79,
  // líneas por ingrediente (cantidad × 100 pax, precio unitario del Excel)
  lineas: [
    { nombre: 'HARINA TRIGO', qty: 20, unit: 'kg', total: 20.6 },
    { nombre: 'AZ. GLACE', qty: 50, unit: 'kg', total: 130 },
    { nombre: 'SAL', qty: 4, unit: 'kg', total: 0.88 },
    { nombre: 'MANTEQUILLA', qty: 140, unit: 'kg', total: 1302 },
    { nombre: 'YEMA', qty: 0.2, unit: 'ud', total: 1.31 },
  ],
};

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/admin/login`);
  await page.locator('input[type="text"]').fill(ADMIN_USER);
  await page.locator('input[type="password"]').fill(ADMIN_PASS);
  const btn = page.getByRole('button', { name: /Entrar al panel|Entrar|Login|Acceder/i });
  await btn.waitFor({ state: 'visible', timeout: 5000 });
  await btn.click();
  await page.waitForURL((u) => !u.pathname.startsWith('/admin/login'), { timeout: 10000 });
}

test.describe('Cocina — Receta PASTA ESPEJO (importada de Excel)', () => {
  test('API: receta existe con 5 ingredientes, alérgenos y merma 20%', async ({ page }) => {
    await loginAsAdmin(page);
    const res = await page.request.get(`${BASE}/api/cocina/recetas`);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    const list = json.data || json.recipes || [];
    const receta = list.find((r: any) => (r.name || '').toLowerCase() === 'pasta espejo');
    expect(receta, 'receta PASTA ESPEJO existe').toBeTruthy();
    expect(Number(receta.cost_per_serving || 0)).toBeCloseTo(ESPERADO.coste_pax_con_merma, 1);
    // Alérgenos están en el detalle, no en la lista
    const det = await page.request.get(`${BASE}/api/cocina/recetas/${receta.id}`);
    const djson = await det.json();
    const allergens = djson.data?.allergens || djson.data?.recipe?.allergens || [];
    const alText = JSON.stringify(allergens).toLowerCase();
    expect(alText, 'alérgenos GLUTEN/LACTOSA/HUEVOS').toContain('gluten');
    expect(alText).toContain('lactosa');
    expect(alText).toContain('huevos');
  });

  test('API: ingredientes de la receta con costes del Excel (no del catálogo)', async ({ page }) => {
    await loginAsAdmin(page);
    // Obtener receta
    const res = await page.request.get(`${BASE}/api/cocina/recetas`);
    const json = await res.json();
    const list = json.data || json.recipes || [];
    const receta = list.find((r: any) => (r.name || '').toLowerCase() === 'pasta espejo');
    expect(receta, 'receta PASTA ESPEJO').toBeTruthy();

    // Obtener detalles con ingredientes
    const det = await page.request.get(`${BASE}/api/cocina/recetas/${receta.id}`);
    const djson = await det.json();
    const ingredientes = djson.data?.ingredients || djson.data?.items || [];

    // Buscar por nombre (el import mapeó correctamente)
    const sal = ingredientes.find((i: any) => (i.name || i.ingredient_name || '').toUpperCase() === 'SAL');
    const mantequilla = ingredientes.find((i: any) => (i.name || i.ingredient_name || '').toUpperCase() === 'MANTEQUILLA');
    expect(sal, 'ingrediente SAL creado (no mapeado a ensaladilla)').toBeTruthy();
    expect(mantequilla, 'ingrediente MANTEQUILLA creado (no mapeado a trufada)').toBeTruthy();
    // coste de línea = cantidad × precio del Excel: SAL 0.04 kg × 0.22 = 0.0088
    expect(Number(sal.cost || 0), 'SAL línea = 0.0088 € (0.04 × 0.22 Excel)').toBeCloseTo(0.0088, 3);
    // MANTEQUILLA 1.4 kg × 9.3 = 13.02 €
    expect(Number(mantequilla.cost || 0), 'MANTEQUILLA línea = 13.02 € (1.4 × 9.3 Excel)').toBeCloseTo(13.02, 1);
  });

  test('API: escandallo 100 pax = 1.454,79 € con líneas correctas', async ({ page }) => {
    await loginAsAdmin(page);
    // Buscar el evento de test
    const evRes = await page.request.get(`${BASE}/api/events?limit=50`);
    const evJson = await evRes.json();
    const events = evJson.data || evJson.events || [];
    const evento = events.find((e: any) => (e.client_name || '').includes('Test PASTA ESPEJO'));
    expect(evento, 'evento Test PASTA ESPEJO').toBeTruthy();

    const escRes = await page.request.get(`${BASE}/api/escandallo/event/${evento.id}`);
    expect(escRes.ok(), 'GET escandallo del evento').toBeTruthy();
    const esc = await escRes.json();
    const theoretical = esc.data?.theoretical || [];
    expect(theoretical.length, '5 líneas de ingredientes').toBe(5);

    const total = theoretical.reduce((s: number, x: any) => s + Number(x.estimated_cost || 0), 0);
    expect(total, 'total escandallo 100 pax').toBeCloseTo(ESPERADO.total_escandallo_100pax, 1);

    // Verificar cada línea por nombre
    for (const linea of ESPERADO.lineas) {
      const fila = theoretical.find((x: any) => (x.ingredient_name || '').toUpperCase() === linea.nombre);
      expect(fila, `línea ${linea.nombre} presente`).toBeTruthy();
      expect(Number(fila.estimated_cost || 0), `coste ${linea.nombre}`).toBeCloseTo(linea.total, 1);
    }
  });

  test('UI: vista de recetas del módulo Cocina muestra PASTA ESPEJO', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/cocina/recetas`);
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    expect(body.toLowerCase(), 'receta en la lista').toContain('pasta espejo');
  });

  test('UI: vista de escandallos carga sin error', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE}/admin/cocina/escandallos`);
    await page.waitForTimeout(2500);
    const body = await page.locator('body').innerText();
    expect(body.length).toBeGreaterThan(0);
  });
});
