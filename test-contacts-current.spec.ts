import { test, expect } from '@playwright/test';

test('Check Contacts Page', async ({ page }) => {
  // Track console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser Error:', msg.text());
    }
  });

  // Track API responses
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/')) {
      console.log('API:', response.status(), url);
      if (!response.ok()) {
        try {
          const body = await response.text();
          console.log('Error body:', body);
        } catch (e) {}
      }
    }
  });

  console.log('Navigating to contacts page...');
  await page.goto('http://localhost:3000/contacts');

  await page.waitForTimeout(5000);

  console.log('Current URL:', page.url());

  // Take screenshot
  await page.screenshot({ path: '/tmp/contacts-current.png', fullPage: true });
  console.log('Screenshot saved to /tmp/contacts-current.png');

  await page.waitForTimeout(2000);
});
