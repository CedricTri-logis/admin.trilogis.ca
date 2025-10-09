const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text());
  });

  // Capture network requests
  page.on('request', request => {
    if (request.url().includes('lease-discrepancies')) {
      console.log(`[REQUEST] ${request.method()} ${request.url()}`);
    }
  });

  // Capture network responses
  page.on('response', async response => {
    if (response.url().includes('lease-discrepancies')) {
      console.log(`[RESPONSE] ${response.status()} ${response.url()}`);
      if (response.status() >= 400) {
        try {
          const body = await response.text();
          console.log(`[RESPONSE BODY]:`, body);
        } catch (e) {
          console.log('[RESPONSE BODY]: Could not read');
        }
      }
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    console.log(`[PAGE ERROR]:`, error.message);
  });

  try {
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    console.log('2. Checking if already logged in...');
    const currentUrl = page.url();

    if (!currentUrl.includes('/portal')) {
      console.log('3. Logging in...');
      // Fill login form
      await page.fill('input[type="email"]', 'cedric@lajoie.com');
      await page.fill('input[type="password"]', 'Liberte25');
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);
    } else {
      console.log('3. Already logged in');
    }

    console.log('4. Navigating to lease discrepancies page...');
    await page.goto('http://localhost:3000/integration/lease-discrepancies');
    await page.waitForTimeout(3000);

    console.log('5. Waiting for discrepancies to load...');
    await page.waitForSelector('text=DOCUMENT #1', { timeout: 10000 });
    console.log('   ✅ Discrepancies loaded!');

    console.log('6. Clicking on first "Voir" button...');
    const voirButton = await page.locator('button:has-text("Voir")').first();
    await voirButton.click();
    console.log('   ✅ Clicked "Voir" button');

    console.log('7. Waiting for response...');
    await page.waitForTimeout(3000);

    // Check if dialog opened
    const dialogVisible = await page.locator('[role="dialog"]').isVisible();
    console.log(`   Dialog visible: ${dialogVisible}`);

    if (dialogVisible) {
      // Check if iframe exists
      const iframeExists = await page.locator('iframe[title="PDF Viewer"]').count();
      console.log(`   Iframe count: ${iframeExists}`);

      if (iframeExists > 0) {
        const iframeSrc = await page.locator('iframe[title="PDF Viewer"]').getAttribute('src');
        console.log(`   Iframe src: ${iframeSrc}`);
      }
    }

    console.log('\n8. Keeping browser open for inspection...');
    console.log('   Press Ctrl+C to close');

    // Keep browser open
    await page.waitForTimeout(300000); // 5 minutes

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    // await browser.close();
  }
})();
