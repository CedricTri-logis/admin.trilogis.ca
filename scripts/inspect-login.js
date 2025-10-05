const { chromium } = require('@playwright/test');

const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002';
const EMAIL = process.env.TEST_EMAIL || 'cedric@lajoie.com';
const PASSWORD = process.env.TEST_PASSWORD || 'Liberte25';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    console.log(`[console:${msg.type()}] ${msg.text()}`);
  });

  try {
    const loginUrl = new URL('/login', DEFAULT_BASE_URL).toString();
    console.log(`Navigating to ${loginUrl}`);
    await page.goto(loginUrl, { waitUntil: 'networkidle' });

    await page.fill('input[name="email"]', EMAIL);
    await page.fill('input[name="password"]', PASSWORD);

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle' }),
      page.getByRole('button', { name: /sign in/i }).click(),
    ]);

    console.log(`Arrived at ${page.url()}`);
  } catch (error) {
    console.error('Playwright script failed:', error);
  } finally {
    await browser.close();
  }
})();
