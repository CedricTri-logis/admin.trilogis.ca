import { test, expect } from '@playwright/test';

test('Test Duplicate Target Selection', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);

  console.log('Logging in...');
  await page.fill('input[type="email"]', 'cedric@lajoie.com');
  await page.fill('input[type="password"]', 'Liberte25');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(5000);

  // Go to duplicates page
  console.log('Navigating to duplicates page...');
  await page.goto('http://localhost:3000/contacts/duplicates');
  await page.waitForTimeout(5000);

  // Take initial screenshot
  await page.screenshot({ path: '/tmp/duplicates-with-target-selection.png', fullPage: true });
  console.log('Initial screenshot saved');

  // Look for "Set as Target" button
  const setAsTargetButton = page.locator('button:has-text("Set as Target")').first();
  const buttonVisible = await setAsTargetButton.isVisible().catch(() => false);

  console.log('Set as Target button visible:', buttonVisible);

  if (buttonVisible) {
    console.log('✓ SUCCESS: Set as Target button found!');

    // Click it to change the target
    await setAsTargetButton.click();
    await page.waitForTimeout(1000);

    // Take screenshot after selection
    await page.screenshot({ path: '/tmp/after-target-selection.png', fullPage: true });
    console.log('After selection screenshot saved');

    // Check if the badge changed to "Target (Keep)"
    const targetBadge = page.locator('text=Target (Keep)');
    const targetBadgeCount = await targetBadge.count();
    console.log('Target (Keep) badges found:', targetBadgeCount);
  } else {
    console.log('✗ No duplicates or Set as Target button not found');
  }

  await page.waitForTimeout(2000);
});
