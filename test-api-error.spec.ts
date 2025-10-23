import { test, expect } from '@playwright/test';

test('Capture API Error', async ({ page }) => {
  // Listen for API responses
  page.on('response', async response => {
    if (response.url().includes('/api/admin/contacts/duplicates')) {
      console.log('=== API Response ===');
      console.log('URL:', response.url());
      console.log('Status:', response.status());
      try {
        const body = await response.text();
        console.log('Body:', body);
      } catch (e) {
        console.log('Could not read body');
      }
    }
  });

  // Listen for console logs
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser Error:', msg.text());
    }
  });

  // Navigate and login
  await page.goto('http://localhost:3000/contacts/duplicates');
  await page.waitForTimeout(2000);
  
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"]', 'cedric@lajoie.com');
    await page.fill('input[type="password"]', 'Liberte25');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto('http://localhost:3000/contacts/duplicates');
  }
  
  // Wait for API call
  await page.waitForTimeout(5000);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/duplicates-error-detail.png', fullPage: true });
  console.log('Screenshot saved');
});
