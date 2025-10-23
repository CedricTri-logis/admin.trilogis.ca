import { test, expect } from '@playwright/test';

test('Test Contacts Page', async ({ page }) => {
  // Track all API calls
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/admin/contacts')) {
      console.log('=== API Response ===');
      console.log('URL:', url);
      console.log('Status:', response.status());
      try {
        const body = await response.text();
        console.log('Body:', body);
      } catch (e) {
        console.log('Could not read body');
      }
    }
  });

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser Error:', msg.text());
    }
  });

  // Navigate and login
  await page.goto('http://localhost:3000/contacts');
  await page.waitForTimeout(2000);

  if (page.url().includes('/login')) {
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'cedric@lajoie.com');
    await page.fill('input[type="password"]', 'Liberte25');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto('http://localhost:3000/contacts');
  }

  // Wait for page to load
  await page.waitForTimeout(5000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/contacts-page.png', fullPage: true });
  console.log('Screenshot saved');

  await page.waitForTimeout(2000);
});
