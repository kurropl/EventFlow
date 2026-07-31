/**
 * EventFlow — WP-FIX-01: Navegación del módulo Cocina
 *
 * Verifica que /admin/cocina/* hereda el layout admin global:
 *   (a) el sidebar lateral global es visible y contiene las mismas
 *       entradas top-level que en /admin/staffing,
 *   (b) la subnavegación de Cocina (children del sidebar) lista los
 *       8 subapartados: Panel, Recetas, Escandallos, Producción,
 *       Carga, Logística, APPCC, Compras,
 *   (c) cada subapartado carga sin error de consola.
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@eventflow.test';
const ADMIN_PASSWORD = 'admin123';

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.getByRole('button', { name: /Entrar|Login|Acceder/i }).click();
  await page.waitForURL(/\/admin/i, { timeout: 8000 });
}

/** Selectores del sidebar global (desktop: <aside> con la navegación). */
const SIDEBAR = 'aside.hidden.md\\:flex, aside[class*="w-64"]';

const SUBAPPARTADOS = [
  { label: 'Recetas', href: '/admin/cocina/recetas' },
  { label: 'Escandallos', href: '/admin/cocina/escandallos' },
  { label: 'Producción', href: '/admin/cocina/produccion' },
  { label: 'Carga', href: '/admin/cocina/carga' },
  { label: 'Logística', href: '/admin/cocina/logistica' },
  { label: 'APPCC', href: '/admin/cocina/appcc' },
  { label: 'Compras', href: '/admin/cocina/compras' },
];

/** Entradas top-level que el sidebar debe mostrar (mismas en cocina y staffing). */
const TOP_LEVEL = [
  'Resumen',
  'Leads',
  'Pipeline',
  'Clientes',
  'Agenda',
  'Catálogo',
  'Cocina',
  'Personal',
  'Inventario',
  'Proveedores',
  'Cobros',
  'Configuración',
];

test.describe('WP-FIX-01 — Navegación del módulo Cocina', () => {
  test('sidebar global visible en /admin/cocina con mismas entradas que staffing', async ({ page }) => {
    await loginAsAdmin(page);

    // Recoger entradas del sidebar en staffing
    await page.goto('/admin/staffing');
    await page.waitForTimeout(1200);
    const sidebarStaffing = page.locator('aside');
    expect(await sidebarStaffing.count()).toBeGreaterThan(0);
    const staffingTexts = (await sidebarStaffing.first().innerText()).toLowerCase();

    // Entradas top-level esperadas en staffing
    for (const entry of TOP_LEVEL) {
      expect(staffingTexts, `staffing debería mostrar "${entry}"`).toContain(entry.toLowerCase());
    }

    // Ir a cocina: el sidebar debe seguir presente con las mismas entradas
    await page.goto('/admin/cocina');
    await page.waitForTimeout(1200);
    const sidebarCocina = page.locator('aside');
    expect(await sidebarCocina.count()).toBeGreaterThan(0);
    const cocinaTexts = (await sidebarCocina.first().innerText()).toLowerCase();

    for (const entry of TOP_LEVEL) {
      expect(cocinaTexts, `cocina debería mostrar "${entry}"`).toContain(entry.toLowerCase());
    }
  });

  test('subnav de Cocina lista los 8 subapartados', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/cocina');
    await page.waitForTimeout(1200);

    const sidebar = page.locator('aside').first();
    const text = await sidebar.innerText();

    // Panel (raíz) + 7 subapartados = 8
    expect(text.toLowerCase()).toContain('panel');
    for (const s of SUBAPPARTADOS) {
      expect(text.toLowerCase(), `subapartado "${s.label}" debería estar en el sidebar`).toContain(s.label.toLowerCase());
    }
  });

  for (const sub of SUBAPPARTADOS) {
    test(`subapartado "${sub.label}" carga sin error de consola`, async ({ page }) => {
      await loginAsAdmin(page);

      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => consoleErrors.push(String(err)));

      await page.goto(sub.href);
      await page.waitForTimeout(1500);

      // La página responde (no hay error fatal de render)
      const body = await page.locator('body').innerText();
      expect(body.length).toBeGreaterThan(0);

      // El sidebar global sigue visible en cada subapartado
      const sidebar = page.locator('aside');
      expect(await sidebar.count(), `sidebar visible en ${sub.href}`).toBeGreaterThan(0);

      // Sin errores de consola críticos (404 de API sí se permiten, errores de JS no)
      const jsErrors = consoleErrors.filter(e =>
        !e.includes('Failed to load resource') &&
        !e.includes('404') &&
        !e.includes('ERR_FAILED')
      );
      expect(jsErrors, `errores de consola en ${sub.href}: ${jsErrors.join(' | ')}`).toEqual([]);
    });
  }
});
