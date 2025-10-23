import { test, expect } from '@playwright/test';

test('Final Verification of Contact Improvements', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);

  console.log('Logging in...');
  await page.fill('input[type="email"]', 'cedric@lajoie.com');
  await page.fill('input[type="password"]', 'Liberte25');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(5000);

  // Go to contacts page
  console.log('\n=== Testing Contacts Page ===');
  await page.goto('http://localhost:3000/contacts');
  await page.waitForTimeout(5000);

  // Take screenshot of page
  await page.screenshot({ path: '/tmp/contacts-final.png', fullPage: true });
  console.log('Contacts page screenshot saved');

  // Click first row's three-dot menu
  console.log('\nOpening dropdown menu...');
  const moreButtons = page.locator('[aria-label="More options"], button:has-text("")').filter({ has: page.locator('svg') });
  const count = await moreButtons.count();
  console.log('Found dropdown buttons:', count);

  if (count > 0) {
    // Click the last visible three-dot button in the table
    const tableButtons = page.locator('table').locator('button').filter({ has: page.locator('svg.lucide-more-vertical') });
    const tableButtonCount = await tableButtons.count();
    console.log('Found table menu buttons:', tableButtonCount);

    if (tableButtonCount > 0) {
      await tableButtons.first().click();
      await page.waitForTimeout(1000);

      await page.screenshot({ path: '/tmp/dropdown-menu-open.png' });
      console.log('Dropdown menu screenshot saved');

      // Check for "Merge to Another Contact" option
      const mergeOption = page.locator('text=Merge to Another Contact');
      const mergeVisible = await mergeOption.isVisible().catch(() => false);
      console.log('Merge option visible:', mergeVisible);

      if (mergeVisible) {
        console.log('✓ SUCCESS: Merge to Another Contact option found in dropdown!');
      } else {
        console.log('✗ FAIL: Merge option not found');
      }
    }
  }

  // Check duplicates page
  console.log('\n=== Testing Duplicates Detection ===');
  await page.goto('http://localhost:3000/contacts/duplicates');
  await page.waitForTimeout(5000);

  await page.screenshot({ path: '/tmp/duplicates-final.png', fullPage: true });
  console.log('Duplicates page screenshot saved');

  // Look for Alimatou
  const pageText = await page.textContent('body');
  const hasAlimatou = pageText?.includes('Alimatou');
  console.log('Alimatou duplicate detected:', hasAlimatou);

  if (hasAlimatou) {
    console.log('✓ SUCCESS: Improved duplicate detection is working!');
  }

  await page.waitForTimeout(2000);
});
