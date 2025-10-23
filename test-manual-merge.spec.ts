import { test, expect } from '@playwright/test';

test('Test Manual Merge Dialog', async ({ page }) => {
  // Navigate
  console.log('Navigating to contacts page...');
  await page.goto('http://localhost:3000/contacts');

  // Wait a bit for page
  await page.waitForTimeout(5000);

  // Take initial screenshot
  await page.screenshot({ path: '/tmp/contacts-page-initial.png', fullPage: true });
  console.log('Initial screenshot saved');

  // Check if we're on login page
  if (page.url().includes('/login')) {
    console.log('On login page - test cannot proceed without manual login');
    await page.screenshot({ path: '/tmp/login-page.png' });
    return;
  }

  console.log('Current URL:', page.url());

  // Look for Manual Merge button
  console.log('Looking for Manual Merge button...');

  // Wait for page to be fully loaded
  await page.waitForTimeout(3000);

  // Try to find the button
  const manualMergeButton = page.locator('button', { hasText: 'Manual Merge' });
  const buttonCount = await manualMergeButton.count();
  console.log('Found Manual Merge buttons:', buttonCount);

  if (buttonCount === 0) {
    console.log('Manual Merge button not found!');
    await page.screenshot({ path: '/tmp/no-button-found.png', fullPage: true });
    return;
  }

  // Click the button
  await manualMergeButton.first().click();
  console.log('Clicked Manual Merge button');

  // Wait for dialog
  await page.waitForTimeout(1000);

  // Check for dialog
  const dialogTitle = page.locator('text=Manual Contact Merge');
  const dialogVisible = await dialogTitle.isVisible().catch(() => false);

  if (!dialogVisible) {
    console.log('Dialog not visible');
    await page.screenshot({ path: '/tmp/dialog-not-visible.png', fullPage: true });
    return;
  }

  console.log('Dialog is visible!');
  await page.screenshot({ path: '/tmp/manual-merge-dialog.png', fullPage: true });

  // Try to interact with search
  const sourceInput = page.locator('input[placeholder*="source"]').first();
  if (await sourceInput.isVisible()) {
    await sourceInput.fill('Jean');
    console.log('Filled source search');

    // Click search button
    await page.locator('button:has-text("Search")').first().click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/manual-merge-search.png', fullPage: true });
    console.log('Search results screenshot saved');
  }

  await page.waitForTimeout(1000);
});
