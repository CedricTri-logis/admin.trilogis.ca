import { test, expect } from '@playwright/test';

test('Verify Manual Merge Button', async ({ page }) => {
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);

  // Login
  console.log('Logging in...');
  await page.fill('input[type="email"]', 'cedric@lajoie.com');
  await page.fill('input[type="password"]', 'Liberte25');
  await page.click('button:has-text("Sign in")');

  // Wait for redirect
  await page.waitForTimeout(5000);

  console.log('Navigating to contacts...');
  await page.goto('http://localhost:3000/contacts');
  await page.waitForTimeout(5000);

  console.log('Current URL:', page.url());

  // Take screenshot
  await page.screenshot({ path: '/tmp/contacts-with-manual-merge.png', fullPage: true });
  console.log('Screenshot saved');

  // Check for Manual Merge button
  const manualMergeButton = page.locator('button:has-text("Manual Merge")');
  const buttonExists = await manualMergeButton.count() > 0;

  console.log('Manual Merge button exists:', buttonExists);

  if (buttonExists) {
    console.log('SUCCESS: Manual Merge button is visible!');

    // Try clicking it
    await manualMergeButton.click();
    await page.waitForTimeout(1000);

    // Check if dialog opened
    const dialogTitle = page.locator('text=Manual Contact Merge');
    const dialogVisible = await dialogTitle.isVisible().catch(() => false);

    console.log('Dialog opened:', dialogVisible);

    if (dialogVisible) {
      await page.screenshot({ path: '/tmp/manual-merge-dialog-open.png', fullPage: true });
      console.log('Dialog screenshot saved');
    }
  } else {
    console.log('ERROR: Manual Merge button not found');
  }

  await page.waitForTimeout(2000);
});
