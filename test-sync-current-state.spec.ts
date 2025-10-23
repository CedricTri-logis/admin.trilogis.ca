import { test, expect } from '@playwright/test'

test('QuickBooks Sync - Current State', async ({ page }) => {
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

  await page.waitForTimeout(3000)

  // Take screenshot
  await page.screenshot({ path: 'test-results/sync-current-state.png', fullPage: true })

  // Get all table rows
  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()
  console.log(`📊 Total rows: ${rowCount}`)

  // Extract data from each row
  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i)
    const text = await row.textContent()

    // Extract key information
    const cells = row.locator('td')
    const cellCount = await cells.count()

    if (cellCount > 0) {
      const company = await cells.nth(1).textContent()
      const type = await cells.nth(2).textContent()
      const status = await cells.nth(3).textContent()
      const progress = await cells.nth(4).textContent()
      const records = await cells.nth(5).textContent()

      console.log(`\n📋 Row ${i + 1}:`)
      console.log(`  Company: ${company}`)
      console.log(`  Type: ${type}`)
      console.log(`  Status: ${status}`)
      console.log(`  Progress: ${progress}`)
      console.log(`  Records: ${records}`)
    }
  }

  // Check if any job shows progress > 0
  const progressText = await page.locator('table').textContent()
  const hasProgress = progressText?.includes('imported') && !progressText?.includes('0 imported')
  console.log(`\n✅ Has progress shown: ${hasProgress}`)

  // Get API data directly
  const apiResponse = await page.request.get('http://localhost:3000/api/quickbooks/sync/jobs?limit=10')
  const apiData = await apiResponse.json()
  console.log(`\n🔍 API returned ${apiData.jobs?.length} jobs`)

  if (apiData.jobs && apiData.jobs.length > 0) {
    console.log('\n📊 API Job Details:')
    apiData.jobs.forEach((job: any, i: number) => {
      console.log(`  Job ${i + 1}: ${job.status} - ${job.completed_entities}/${job.total_entities} entities - ${job.processed_records} records`)
    })
  }
})
