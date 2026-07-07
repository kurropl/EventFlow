import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'https://eventcater.duckdns.org',
    headless: true,
    screenshot: 'only-on-failure',
    ignoreHTTPSErrors: true,
    navigationTimeout: 30000,
  },
  webServer: undefined,
});