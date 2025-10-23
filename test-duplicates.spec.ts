import { test, expect } from '@playwright/test';

test('Test Contact Duplicates Page', async ({ page }) => {
  // Navigate to duplicates page
  console.log('Navigating to duplicates page...');
  await page.goto('http://localhost:3000/contacts/duplicates');
  
  // Wait for redirect
  await page.waitForTimeout(2000);
  
  // Check if we need to login
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);
  
  if (currentUrl.includes('/login')) {
    console.log('Need to login first...');
    
    // Fill in credentials
    await page.fill('input[type="email"]', 'cedric@lajoie.com');
    await page.fill('input[type="password"]', 'Liberte25');
    
    console.log('Submitting login...');
    await page.click('button[type="submit"]');
    
    // Wait for redirect after login
    await page.waitForTimeout(3000);
    
    console.log('Logged in! Current URL:', page.url());
    
    // Navigate to duplicates page
    console.log('Navigating to duplicates page...');
    await page.goto('http://localhost:3000/contacts/duplicates');
    await page.waitForTimeout(2000);
  }
  
  console.log('On duplicates page! URL:', page.url());
  
  // Check for page title
  const title = await page.locator('h1').first().textContent();
  console.log('Page title:', title);
  expect(title).toContain('Contact Duplicates');
  
  // Check for tabs
  const tabs = await page.locator('[role="tab"]').all();
  console.log(`Found ${tabs.length} tabs`);
  expect(tabs.length).toBe(3);
  
  for (const tab of tabs) {
    const tabText = await tab.textContent();
    console.log(`  - Tab: ${tabText}`);
  }
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/duplicates-page.png', fullPage: true });
  console.log('Screenshot saved: /tmp/duplicates-page.png');
  
  // Wait to see the page
  console.log('Waiting 10 seconds for you to view the page...');
  await page.waitForTimeout(10000);
});
