import { test, expect } from '@playwright/test';

test('Capture Merge Error', async ({ page }) => {
  // Track all 404s and API calls
  page.on('response', async response => {
    const url = response.url();
    if (response.status() === 404) {
      console.log('=== 404 Error ===');
      console.log('URL:', url);
    }
    if (url.includes('/api/admin/contacts/merge')) {
      console.log('=== Merge API Response ===');
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
  await page.goto('http://localhost:3000/contacts/duplicates');
  await page.waitForTimeout(2000);
  
  if (page.url().includes('/login')) {
    await page.fill('input[type="email"]', 'cedric@lajoie.com');
    await page.fill('input[type="password"]', 'Liberte25');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto('http://localhost:3000/contacts/duplicates');
  }
  
  // Wait for duplicates to load
  await page.waitForTimeout(3000);
  
  console.log('Looking for merge button...');
  
  // Find and click first "Merge into Target" button
  const mergeButton = page.locator('button:has-text("Merge into Target")').first();
  if (await mergeButton.isVisible()) {
    console.log('Found merge button, clicking...');
    await mergeButton.click();

    // Wait for API call and dialog
    await page.waitForTimeout(3000);

    // Check if dialog opened
    const dialogTitle = page.locator('h2:has-text("Merge Preview")');
    const dialogVisible = await dialogTitle.isVisible();
    console.log('Dialog visible:', dialogVisible);

    if (dialogVisible) {
      console.log('Dialog opened successfully!');
      // Check for any errors or warnings in dialog
      const errorAlert = page.locator('[role="alert"]');
      const alertCount = await errorAlert.count();
      console.log('Number of alerts in dialog:', alertCount);

      // Take screenshot of dialog
      await page.screenshot({ path: '/tmp/merge-dialog-open.png', fullPage: true });
      console.log('Dialog screenshot saved');
    } else {
      console.log('Dialog did NOT open - checking for error toast...');
      const toast = page.locator('[data-sonner-toast]').first();
      const toastVisible = await toast.isVisible().catch(() => false);
      console.log('Toast visible:', toastVisible);

      if (toastVisible) {
        const toastText = await toast.textContent();
        console.log('Toast text:', toastText);
      }

      // Take screenshot anyway
      await page.screenshot({ path: '/tmp/no-dialog-error.png', fullPage: true });
      console.log('Error screenshot saved');
    }
  } else {
    console.log('No merge button found - maybe no duplicates?');
  }
  
  await page.waitForTimeout(2000);
});
