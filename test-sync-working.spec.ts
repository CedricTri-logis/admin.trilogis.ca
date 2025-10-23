import { test, expect } from '@playwright/test'

test('QuickBooks Sync - Verify Jobs Now Visible', async ({ page }) => {
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
  console.log('🔍 Navigating to sync page...')
  await page.goto('http://localhost:3000/integration/quickbooks/sync', {
    waitUntil: 'networkidle'
  })

  await page.waitForTimeout(3000)

  // Check if jobs are now visible
  const tableText = await page.locator('table').textContent()
  console.log('📋 Table content:', tableText)

  // Should NOT see "No sync jobs yet"
  const noJobsMessage = page.locator('text=No sync jobs yet')
  const hasNoJobsMessage = await noJobsMessage.isVisible()

  if (hasNoJobsMessage) {
    console.log('❌ Still showing "No sync jobs yet"')
  } else {
    console.log('✅ Jobs are now visible!')
  }

  // Check for job status badges
  const badges = page.locator('[class*="badge"]')
  const badgeCount = await badges.count()
  console.log(`🏷️ Found ${badgeCount} status badges`)

  // Check for progress bars
  const progressBars = page.locator('[role="progressbar"]')
  const progressCount = await progressBars.count()
  console.log(`📊 Found ${progressCount} progress bars`)

  // Take screenshot
  await page.screenshot({ path: 'test-results/sync-after-rls-fix.png', fullPage: true })

  // Test API call directly
  const apiResponse = await page.request.get('http://localhost:3000/api/quickbooks/sync/jobs')
  const apiData = await apiResponse.json()
  console.log('✅ API Response:', JSON.stringify(apiData, null, 2))

  expect(apiData.jobs.length).toBeGreaterThan(0)
})
