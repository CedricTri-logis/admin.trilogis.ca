import { test, expect } from '@playwright/test';

test('Complete Merge Flow', async ({ page }) => {
  // Track all merge API calls
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/admin/contacts/merge') || url.includes('/api/admin/contacts/duplicates')) {
      console.log('=== API Response ===');
      console.log('URL:', url);
      console.log('Status:', response.status());
      try {
        const body = await response.text();
        console.log('Body:', body.substring(0, 1000));
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
    console.log('Logging in...');
    await page.fill('input[type="email"]', 'cedric@lajoie.com');
    await page.fill('input[type="password"]', 'Liberte25');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);
    await page.goto('http://localhost:3000/contacts/duplicates');
  }

  // Wait for duplicates to load
  await page.waitForTimeout(3000);
  console.log('Duplicates page loaded');

  // Find and click first "Merge into Target" button
  const mergeButton = page.locator('button:has-text("Merge into Target")').first();
  if (await mergeButton.isVisible()) {
    console.log('Found merge button, clicking...');
    await mergeButton.click();

    // Wait for dialog to open
    await page.waitForTimeout(2000);

    const dialogTitle = page.locator('h2:has-text("Merge Preview")');
    const dialogVisible = await dialogTitle.isVisible();
    console.log('Dialog visible:', dialogVisible);

    if (dialogVisible) {
      console.log('Dialog opened successfully!');

      // Check if there are any conflicts that need resolution
      const conflictRadios = page.locator('input[type="radio"]');
      const conflictCount = await conflictRadios.count();
      console.log('Number of conflict radio buttons:', conflictCount);

      // If there are conflicts, select the first option for each
      if (conflictCount > 0) {
        console.log('Resolving conflicts...');
        // Get all radio buttons and click the first one in each group
        const radios = await conflictRadios.all();
        for (let i = 0; i < radios.length; i += 3) { // Assuming 3 options per conflict (source, target, manual)
          await radios[i].click();
          await page.waitForTimeout(100);
        }
      }

      // Take screenshot before merge
      await page.screenshot({ path: '/tmp/before-merge.png', fullPage: true });
      console.log('Before merge screenshot saved');

      // Click Confirm Merge button
      const confirmButton = page.locator('button:has-text("Confirm Merge")');
      const isEnabled = await confirmButton.isEnabled();
      console.log('Confirm button enabled:', isEnabled);

      if (isEnabled) {
        console.log('Clicking Confirm Merge button...');
        await confirmButton.click();

        // Wait for merge to complete
        await page.waitForTimeout(5000);

        // Check for success toast
        const toast = page.locator('[data-sonner-toast]').first();
        const toastVisible = await toast.isVisible().catch(() => false);

        if (toastVisible) {
          const toastText = await toast.textContent();
          console.log('Toast after merge:', toastText);
        }

        // Check if dialog closed
        const dialogStillOpen = await dialogTitle.isVisible().catch(() => false);
        console.log('Dialog still open after merge:', dialogStillOpen);

        // Take screenshot after merge
        await page.screenshot({ path: '/tmp/after-merge.png', fullPage: true });
        console.log('After merge screenshot saved');
      } else {
        console.log('Confirm button is disabled - checking why...');
        const reasonField = page.locator('textarea#reason');
        const reasonValue = await reasonField.inputValue();
        console.log('Reason field value:', reasonValue);
      }
    } else {
      console.log('Dialog did NOT open');
    }
  } else {
    console.log('No merge button found - maybe no duplicates?');
  }

  await page.waitForTimeout(2000);
});
