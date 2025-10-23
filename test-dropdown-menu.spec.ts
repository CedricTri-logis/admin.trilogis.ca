import { test, expect } from '@playwright/test';

test('Test Dropdown Menu with Merge Option', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login');
  await page.waitForTimeout(2000);

  console.log('Logging in...');
  await page.fill('input[type="email"]', 'cedric@lajoie.com');
  await page.fill('input[type="password"]', 'Liberte25');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(5000);

  // Go to contacts page
  await page.goto('http://localhost:3000/contacts');
  await page.waitForTimeout(5000);

  console.log('Looking for three-dot menu button...');

  // Find the MoreVertical icon button in the table
  const tableRow = page.locator('table tbody tr').first();
  const moreButton = tableRow.locator('button').last();

  console.log('Clicking three-dot menu...');
  await moreButton.click();
  await page.waitForTimeout(1000);

  // Take screenshot of opened menu
  await page.screenshot({ path: '/tmp/dropdown-opened.png', fullPage: true });
  console.log('Screenshot of opened dropdown saved');

  // Check all menu items
  const menuItems = page.locator('[role="menuitem"]');
  const itemCount = await menuItems.count();
  console.log('Menu items found:', itemCount);

  for (let i = 0; i < itemCount; i++) {
    const text = await menuItems.nth(i).textContent();
    console.log(`Menu item ${i + 1}:`, text);
  }

  // Check for specific options
  const mergeOption = page.locator('text=Merge to Another Contact');
  const convertOption = page.locator('text=Convert to Business');

  console.log('Merge option visible:', await mergeOption.isVisible().catch(() => false));
  console.log('Convert option visible:', await convertOption.isVisible().catch(() => false));

  await page.waitForTimeout(2000);
});
