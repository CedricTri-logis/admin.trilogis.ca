import { test, expect } from '@playwright/test';

test('Test Business Duplicates Detection', async ({ page }) => {
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

  // Take screenshot
  await page.screenshot({ path: '/tmp/business-duplicates.png', fullPage: true });
  console.log('Screenshot saved');

  // Look for Tri-Logis
  const pageText = await page.textContent('body');
  const hasTriLogis = pageText?.includes('Tri-Logis') || pageText?.includes('Tri-logis');

  console.log('Tri-Logis found in duplicates:', hasTriLogis);

  if (hasTriLogis) {
    console.log('✓ SUCCESS: Business duplicates are now showing!');

    // Count how many Tri-Logis entries there are
    const triLogisCount = (pageText?.match(/Tri-[Ll]ogis/g) || []).length;
    console.log('Tri-Logis mentions:', triLogisCount);
  } else {
    console.log('✗ Tri-Logis not found in duplicates page');
  }

  // Check for duplicate groups count
  const duplicateGroups = page.locator('[class*="space-y-4"] > div').count();
  console.log('Total duplicate groups visible:', await duplicateGroups);

  await page.waitForTimeout(2000);
});
