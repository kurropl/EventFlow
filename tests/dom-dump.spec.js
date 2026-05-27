// Quick DOM dump to understand the actual UI structure
const { test, expect } = require('@playwright/test');

test('dump login page DOM', async ({ page }) => {
  await page.goto('http://localhost:3020/admin/login');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(() => ({
    heading: document.querySelector('h1')?.textContent?.trim(),
    inputs: Array.from(document.querySelectorAll('input')).map(i => ({ t: i.type, p: i.placeholder, n: i.name })),
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean),
    form: document.querySelector('form') ? 'yes' : 'no',
  }));
  console.log('LOGIN:', JSON.stringify(info, null, 2));
  expect(info.heading).toBeTruthy();
});

test('dump landing page DOM', async ({ page }) => {
  await page.goto('http://localhost:3020/');
  await page.waitForLoadState('networkidle');
  const info = await page.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim(),
    buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(Boolean).slice(0, 8),
    links: Array.from(document.querySelectorAll('a')).map(a => a.textContent.trim()).filter(Boolean).slice(0, 10),
  }));
  console.log('LANDING:', JSON.stringify(info, null, 2));
  expect(info.h1).toBeTruthy();
});

test('admin login and sidebar', async ({ page }) => {
  await page.goto('http://localhost:3020/admin/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="admin"]', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/admin/**', { timeout: 5000 });
  const adminInfo = await page.evaluate(() => ({
    url: window.location.href,
    nav: Array.from(document.querySelectorAll('nav a, a[href*="/admin/"]')).map(a => ({ t: a.textContent.trim(), h: a.getAttribute('href') })).slice(0, 10),
  }));
  console.log('ADMIN:', JSON.stringify(adminInfo, null, 2));
  expect(adminInfo.url).toContain('/admin');
});