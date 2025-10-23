import { test, expect } from '@playwright/test'

test('QuickBooks Sync - Final Test', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'cedric@lajoie.com')
  await page.fill('input[type="password"]', 'Liberte25')
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ])

  await page.waitForTimeout(2000)

  // Navigate to sync page
  await page.goto('http://localhost:3000/integration/quickbooks/sync', {
    waitUntil: 'networkidle'
  })

  console.log('📍 Current URL:', page.url())
  await page.screenshot({ path: 'test-results/sync-loaded.png', fullPage: true })

  // Wait for the page to fully load
  await page.waitForTimeout(3000)

  // Check table content
  const tableText = await page.locator('table').textContent()
  console.log('📋 Table content:', tableText)

  // Try clicking refresh
  console.log('🔄 Clicking refresh button...')
  const refreshButton = page.locator('button[aria-label="Refresh"], button:has-text("Refresh")').last()
  if (await refreshButton.isVisible()) {
    await refreshButton.click()
    await page.waitForTimeout(2000)

    const tableTextAfter = await page.locator('table').textContent()
    console.log('📋 Table content after refresh:', tableTextAfter)

    await page.screenshot({ path: 'test-results/sync-after-refresh.png', fullPage: true })
  }

  // Check network requests
  console.log('🔍 Checking if API calls were made...')

  // Make API call directly to verify it works
  const apiResponse = await page.request.get('http://localhost:3000/api/quickbooks/sync/jobs')
  const apiData = await apiResponse.json()
  console.log('✅ Direct API call result:', JSON.stringify(apiData, null, 2))

  // Check browser console
  const consoleLogs = await page.evaluate(() => {
    return {
      localStorage: JSON.stringify(window.localStorage),
      // @ts-ignore
      errors: window.__errors || []
    }
  })

  console.log('💾 Browser state:', consoleLogs)

  await page.screenshot({ path: 'test-results/sync-final-state.png', fullPage: true })
})
