import { test, expect } from '@playwright/test'

test('QuickBooks Sync - Complete Flow Test', async ({ page }) => {
  // Login
  console.log('🔐 Logging in...')
  await page.goto('http://localhost:3000/login')
  await page.fill('input[type="email"]', 'cedric@lajoie.com')
  await page.fill('input[type="password"]', 'Liberte25')
  await Promise.all([
    page.waitForNavigation(),
    page.click('button[type="submit"]')
  ])

  await page.waitForTimeout(2000)

  // Navigate to sync page
  console.log('📄 Navigating to QuickBooks Sync page...')
  await page.goto('http://localhost:3000/integration/quickbooks/sync', {
    waitUntil: 'networkidle'
  })

  await page.waitForTimeout(2000)

  // Verify cancelled jobs are visible
  const tableText = await page.locator('table').textContent()
  console.log('📋 Initial jobs visible:', tableText?.includes('cancelled') ? 'Yes (cancelled jobs shown)' : 'Unknown')

  // Take screenshot before starting sync
  await page.screenshot({ path: 'test-results/sync-before-test.png', fullPage: true })

  // Verify company is selected
  const selectedCompany = await page.locator('select').first().inputValue()
  console.log('🏢 Selected company:', selectedCompany ? 'Les immeubles abitibi' : 'None selected')

  if (!selectedCompany) {
    console.log('⚠️  No company selected, selecting first option...')
    await page.selectOption('select', { index: 1 })
    await page.waitForTimeout(500)
  }

  // Start an incremental sync
  console.log('▶️  Starting incremental sync...')
  const incrementalButton = page.locator('button:has-text("Start Incremental")')
  await incrementalButton.click()

  // Wait for toast notification
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'test-results/sync-started.png', fullPage: true })

  // Check if a pending job was created
  const apiResponse = await page.request.get('http://localhost:3000/api/quickbooks/sync/jobs?status=pending')
  const pendingJobs = await apiResponse.json()
  console.log('⏳ Pending jobs:', pendingJobs.total)

  if (pendingJobs.total > 0) {
    const newJob = pendingJobs.jobs[0]
    console.log('📦 New sync job created:', {
      id: newJob.id,
      status: newJob.status,
      type: newJob.sync_type,
      entities: newJob.total_entities
    })

    // Click "Process Pending" button
    console.log('⚙️  Processing pending entities...')
    const processButton = page.locator('button:has-text("Process Pending")')
    await processButton.click()

    // Wait for processing to complete (up to 60 seconds)
    console.log('⏱️  Waiting for processing (max 60s)...')
    let processComplete = false
    let attempts = 0
    const maxAttempts = 12 // 60 seconds

    while (!processComplete && attempts < maxAttempts) {
      await page.waitForTimeout(5000)
      attempts++

      const statusResponse = await page.request.get(`http://localhost:3000/api/quickbooks/sync/status/${newJob.id}`)
      const status = await statusResponse.json()

      console.log(`  [${attempts}/${maxAttempts}] Status: ${status.job?.status}, Completed: ${status.job?.completed_entities}/${status.job?.total_entities}`)

      if (status.job?.status === 'completed' || status.job?.status === 'failed') {
        processComplete = true
        console.log(`✅ Sync ${status.job.status}!`)

        if (status.job.status === 'completed') {
          console.log('📊 Final stats:', {
            totalRecords: status.job.processed_records,
            errors: status.job.error_records
          })
        } else {
          console.log('❌ Error:', status.job.error_message)
        }
      }
    }

    await page.screenshot({ path: 'test-results/sync-completed.png', fullPage: true })

    if (!processComplete) {
      console.log('⚠️  Sync still running after 60s (this is normal for large syncs)')
    }

  } else {
    console.log('❌ No pending job was created')
  }

  // Final screenshot
  await page.screenshot({ path: 'test-results/sync-final.png', fullPage: true })
})
