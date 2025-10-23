import { test, expect } from '@playwright/test';

test('Test Contact Improvements', async ({ page }) => {
  // Navigate to login
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);

  // Login
  console.log('Logging in...');
  await page.fill('input[type="email"]', 'cedric@lajoie.com');
  await page.fill('input[type="password"]', 'Liberte25');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(5000);

  // Test 1: Verify Manual Merge button is NOT in header
  console.log('\n=== TEST 1: Manual Merge button removed from header ===');
  await page.goto('http://localhost:3000/contacts');
  await page.waitForTimeout(3000);

  const headerMergeButton = page.locator('button:has-text("Manual Merge")').first();
  const headerButtonCount = await headerMergeButton.count();
  console.log('Manual Merge buttons in header:', headerButtonCount);

  // Test 2: Verify dropdown menu has "Merge to Another Contact" option
  console.log('\n=== TEST 2: Dropdown has merge option ===');

  // Click first three-dot menu
  const firstDropdown = page.locator('button:has(svg)').filter({ hasText: '' }).first();
  await firstDropdown.click();
  await page.waitForTimeout(500);

  const mergeMenuItem = page.locator('text=Merge to Another Contact');
  const menuItemVisible = await mergeMenuItem.isVisible().catch(() => false);
  console.log('Merge menu item visible:', menuItemVisible);

  if (menuItemVisible) {
    await page.screenshot({ path: '/tmp/dropdown-with-merge.png' });
    console.log('Screenshot saved showing dropdown menu');

    // Click it to open dialog
    await mergeMenuItem.click();
    await page.waitForTimeout(1000);

    const dialog = page.locator('text=Manual Contact Merge');
    const dialogVisible = await dialog.isVisible().catch(() => false);
    console.log('Dialog opened from dropdown:', dialogVisible);

    if (dialogVisible) {
      await page.screenshot({ path: '/tmp/dialog-from-dropdown.png', fullPage: true });
      console.log('Dialog screenshot saved');

      // Check that source is pre-selected
      const sourceLabel = page.locator('text=1. Source Contact (will be merged away)');
      console.log('Source label visible:', await sourceLabel.isVisible());

      // Close dialog
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // Test 3: Check improved duplicate detection
  console.log('\n=== TEST 3: Check duplicate detection ===');
  await page.goto('http://localhost:3000/contacts/duplicates');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: '/tmp/duplicates-improved.png', fullPage: true });
  console.log('Duplicates screenshot saved');

  // Look for specific duplicate we know about
  const alimatouDuplicate = page.locator('text=Alimatou');
  const alimatouCount = await alimatouDuplicate.count();
  console.log('Alimatou duplicate entries found:', alimatouCount);

  await page.waitForTimeout(2000);
});
