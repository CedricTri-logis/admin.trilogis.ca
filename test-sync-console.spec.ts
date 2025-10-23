import { test } from '@playwright/test'

test('QuickBooks Sync - Check Console Logs', async ({ page }) => {
  // Collect all console messages
  const consoleLogs: { type: string; text: string }[] = []

  page.on('console', msg => {
    consoleLogs.push({
      type: msg.type(),
      text: msg.text()
    })
  })

  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'cedric@lajoie.com')
  await page.fill('input[type="password"]', 'Liberte25')
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ])

  await page.waitForTimeout(2000)

  // Clear console logs before navigating to sync page
  consoleLogs.length = 0

  // Navigate to sync page
  console.log('🔍 Navigating to sync page...')
  await page.goto('http://localhost:3000/integration/quickbooks/sync', {
    waitUntil: 'networkidle'
  })

  // Wait for fetch to complete
  await page.waitForTimeout(5000)

  // Print all console logs
  console.log('\n📋 ===== BROWSER CONSOLE LOGS =====')
  consoleLogs.forEach(log => {
    if (log.text.includes('[fetchJobs]') || log.text.includes('Error') || log.text.includes('sync')) {
      console.log(`  [${log.type.toUpperCase()}] ${log.text}`)
    }
  })
  console.log('===== END CONSOLE LOGS =====\n')

  // Take screenshot
  await page.screenshot({ path: 'test-results/sync-with-console.png', fullPage: true })
})
