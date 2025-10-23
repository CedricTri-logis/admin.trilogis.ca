import { test, expect } from '@playwright/test'

test('Check what browser receives from API', async ({ page }) => {
  // Intercept API calls
  page.on('response', async (response) => {
    if (response.url().includes('/api/quickbooks/sync/jobs')) {
      const data = await response.json()
      console.log('\n=== API RESPONSE ===')
      console.log('URL:', response.url())
      console.log('Status:', response.status())
      console.log('Cache-Control:', response.headers()['cache-control'])
      console.log('Jobs count:', data.jobs?.length || 0)
      if (data.jobs && data.jobs[0]) {
        console.log('First job:', {
          id: data.jobs[0].id.substring(0, 8),
          status: data.jobs[0].status,
          completed: data.jobs[0].completed_entities,
          total: data.jobs[0].total_entities,
          records: data.jobs[0].processed_records
        })
      }
    }
  })

  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'cedric@lajoie.com')
  await page.fill('input[type="password"]', 'Liberte25')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })

  // Go to sync page
  console.log('\n=== LOADING SYNC PAGE ===')
  await page.goto('http://localhost:3000/integration/quickbooks/sync')
  await page.waitForTimeout(3000)

  // Force a refresh by clicking the refresh button
  console.log('\n=== CLICKING REFRESH BUTTON ===')
  const refreshBtn = page.locator('button').filter({ has: page.locator('svg') }).first()
  if (await refreshBtn.isVisible()) {
    await refreshBtn.click()
    await page.waitForTimeout(2000)
  }

  // Check what the page is displaying
  const jobsTable = await page.locator('table').last()
  const firstRow = await jobsTable.locator('tbody tr').first()
  const statusBadge = await firstRow.locator('td').nth(3).textContent()
  const progressText = await firstRow.locator('td').nth(4).textContent()
  const recordsText = await firstRow.locator('td').nth(5).textContent()

  console.log('\n=== PAGE DISPLAY ===')
  console.log('Status:', statusBadge?.trim())
  console.log('Progress:', progressText?.trim())
  console.log('Records:', recordsText?.trim())

  await page.screenshot({ path: 'test-results/api-check.png', fullPage: true })
})
