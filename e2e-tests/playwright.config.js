/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  testDir: './e2e-tests',
  timeout: 90000,
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
};
module.exports = config;
