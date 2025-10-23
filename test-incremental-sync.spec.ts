import { test, expect } from '@playwright/test'

test('Check incremental sync status', async ({ page }) => {
  // Login
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'cedric@lajoie.com')
  await page.fill('input[type="password"]', 'Liberte25')
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 })

  // Go to sync page
  await page.goto('http://localhost:3000/integration/quickbooks/sync')
  await page.waitForTimeout(2000)

  // Take screenshot
  await page.screenshot({ path: 'test-results/sync-page-status.png', fullPage: true })

  // Check what jobs are showing
  const jobsTable = await page.locator('table').last()
  const rows = await jobsTable.locator('tbody tr').all()

  console.log(`\n=== JOBS TABLE (${rows.length} rows) ===`)

  for (let i = 0; i < Math.min(rows.length, 3); i++) {
    const cells = await rows[i].locator('td').allTextContents()
    console.log(`Row ${i + 1}:`, cells.join(' | '))
  }

  // Check if there's a running job
  const runningJobs = await page.locator('text=/running/i').count()
  console.log(`\nRunning jobs visible: ${runningJobs}`)

  // Check progress indicators
  const progressBars = await page.locator('[role="progressbar"], .progress').count()
  console.log(`Progress bars found: ${progressBars}`)

  // Check if Process Pending button is visible
  const processPendingBtn = page.locator('button:has-text("Process Pending")')
  const isProcessBtnVisible = await processPendingBtn.isVisible()
  const isProcessBtnDisabled = await processPendingBtn.isDisabled()

  console.log(`\nProcess Pending button:`)
  console.log(`  - Visible: ${isProcessBtnVisible}`)
  console.log(`  - Disabled: ${isProcessBtnDisabled}`)

  // Get the latest job status from the page
  const firstRow = rows[0]
  if (firstRow) {
    const statusCell = await firstRow.locator('td').nth(3).textContent()
    const progressCell = await firstRow.locator('td').nth(4).textContent()
    const recordsCell = await firstRow.locator('td').nth(5).textContent()

    console.log(`\nLatest Job Details:`)
    console.log(`  Status: ${statusCell?.trim()}`)
    console.log(`  Progress: ${progressCell?.trim()}`)
    console.log(`  Records: ${recordsCell?.trim()}`)
  }

  // Check if auto-process is checked
  const autoProcessCheckbox = page.locator('input[type="checkbox"]')
  const isAutoProcessChecked = await autoProcessCheckbox.isChecked()
  console.log(`\nAuto-process enabled: ${isAutoProcessChecked}`)

  // Click Process Pending if it's not disabled
  if (isProcessBtnVisible && !isProcessBtnDisabled) {
    console.log(`\nClicking "Process Pending"...`)
    await processPendingBtn.click()
    await page.waitForTimeout(3000)

    // Take another screenshot after clicking
    await page.screenshot({ path: 'test-results/sync-after-process.png', fullPage: true })

    // Check if anything changed
    const updatedRow = await rows[0].locator('td').nth(5).textContent()
    console.log(`Records after processing: ${updatedRow?.trim()}`)
  }

  await page.waitForTimeout(2000)
})
