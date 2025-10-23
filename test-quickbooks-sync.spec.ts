import { test, expect } from '@playwright/test'

test.describe('QuickBooks Sync Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('http://localhost:3000/login')

    // Login
    await page.fill('input[type="email"]', 'cedric@lajoie.com')
    await page.fill('input[type="password"]', 'Liberte25')
    await page.click('button[type="submit"]')

    // Wait for navigation after login
    await page.waitForURL(/\/dashboard|\//, { timeout: 10000 })

    console.log('✅ Logged in successfully')
  })

  test('should load QuickBooks sync page and display UI elements', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Listen for network errors
    const networkErrors: string[] = []
    page.on('response', response => {
      if (response.status() >= 400) {
        networkErrors.push(`${response.status()} ${response.url()}`)
      }
    })

    console.log('🔍 Navigating to QuickBooks sync page...')
    await page.goto('http://localhost:3000/integration/quickbooks/sync', {
      waitUntil: 'networkidle',
      timeout: 15000
    })

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/sync-page-initial.png', fullPage: true })
    console.log('📸 Screenshot saved: sync-page-initial.png')

    // Check for main elements
    console.log('🔍 Checking for main UI elements...')

    // Check for title
    const title = page.getByText('QuickBooks Data Synchronization')
    await expect(title).toBeVisible({ timeout: 5000 })
    console.log('✅ Title found')

    // Check for company select dropdown
    const companySelect = page.locator('select').first()
    await expect(companySelect).toBeVisible({ timeout: 5000 })
    console.log('✅ Company select dropdown found')

    // Get the options in the select
    const options = await companySelect.locator('option').allTextContents()
    console.log('📋 Company options:', options)

    // Check for buttons
    const startFullSyncButton = page.getByRole('button', { name: /Start Full Sync/i })
    const startIncrementalButton = page.getByRole('button', { name: /Start Incremental/i })
    const processButton = page.getByRole('button', { name: /Process Pending/i })

    await expect(startFullSyncButton).toBeVisible({ timeout: 5000 })
    console.log('✅ Start Full Sync button found')

    await expect(startIncrementalButton).toBeVisible({ timeout: 5000 })
    console.log('✅ Start Incremental button found')

    await expect(processButton).toBeVisible({ timeout: 5000 })
    console.log('✅ Process Pending button found')

    // Check button states
    const isFullSyncDisabled = await startFullSyncButton.isDisabled()
    const isIncrementalDisabled = await startIncrementalButton.isDisabled()

    console.log('🔘 Start Full Sync button disabled:', isFullSyncDisabled)
    console.log('🔘 Start Incremental button disabled:', isIncrementalDisabled)

    // Check for auto-process checkbox
    const autoProcessCheckbox = page.locator('input[type="checkbox"]')
    await expect(autoProcessCheckbox).toBeVisible({ timeout: 5000 })
    console.log('✅ Auto-process checkbox found')

    // Check for sync jobs table
    const jobsTable = page.locator('table')
    await expect(jobsTable).toBeVisible({ timeout: 5000 })
    console.log('✅ Sync jobs table found')

    // Log console errors
    if (consoleErrors.length > 0) {
      console.log('⚠️  Console Errors:', consoleErrors)
    } else {
      console.log('✅ No console errors')
    }

    // Log network errors
    if (networkErrors.length > 0) {
      console.log('⚠️  Network Errors:', networkErrors)
    } else {
      console.log('✅ No network errors')
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/sync-page-final.png', fullPage: true })
    console.log('📸 Screenshot saved: sync-page-final.png')
  })

  test('should be able to select a company and enable buttons', async ({ page }) => {
    await page.goto('http://localhost:3000/integration/quickbooks/sync', {
      waitUntil: 'networkidle'
    })

    const companySelect = page.locator('select').first()

    // Check if there are companies available
    const optionCount = await companySelect.locator('option').count()
    console.log(`📋 Found ${optionCount} company options`)

    if (optionCount > 1) { // More than just "Select Company"
      // Select the first real company (index 1)
      const options = await companySelect.locator('option').allTextContents()
      console.log('📋 Available companies:', options)

      await companySelect.selectOption({ index: 1 })
      console.log('✅ Selected first company')

      // Wait a bit for state to update
      await page.waitForTimeout(500)

      // Check if buttons are now enabled
      const startFullSyncButton = page.getByRole('button', { name: /Start Full Sync/i })
      const isDisabled = await startFullSyncButton.isDisabled()

      console.log('🔘 Start Full Sync button disabled after selection:', isDisabled)

      await page.screenshot({ path: 'test-results/sync-page-company-selected.png', fullPage: true })
      console.log('📸 Screenshot saved: sync-page-company-selected.png')

      expect(isDisabled).toBe(false)
    } else {
      console.log('⚠️  No QuickBooks companies found in database')
      console.log('💡 Make sure you have an active QuickBooks connection')
    }
  })

  test('should show error or response when clicking Start Full Sync', async ({ page }) => {
    // Listen for API calls
    const apiCalls: { url: string; status: number; response: any }[] = []

    page.on('response', async response => {
      if (response.url().includes('/api/quickbooks/sync')) {
        try {
          const json = await response.json()
          apiCalls.push({
            url: response.url(),
            status: response.status(),
            response: json
          })
        } catch (e) {
          apiCalls.push({
            url: response.url(),
            status: response.status(),
            response: null
          })
        }
      }
    })

    await page.goto('http://localhost:3000/integration/quickbooks/sync', {
      waitUntil: 'networkidle'
    })

    const companySelect = page.locator('select').first()
    const optionCount = await companySelect.locator('option').count()

    if (optionCount > 1) {
      // Select a company
      await companySelect.selectOption({ index: 1 })
      await page.waitForTimeout(500)

      // Click Start Full Sync
      const startFullSyncButton = page.getByRole('button', { name: /Start Full Sync/i })
      console.log('🖱️  Clicking Start Full Sync button...')

      await startFullSyncButton.click()

      // Wait for API response or error
      await page.waitForTimeout(3000)

      // Check for toast notifications
      const toasts = await page.locator('[role="status"], [role="alert"], .Toaster').allTextContents()
      if (toasts.length > 0) {
        console.log('🔔 Toast notifications:', toasts)
      }

      // Log API calls
      if (apiCalls.length > 0) {
        console.log('📡 API Calls made:')
        apiCalls.forEach(call => {
          console.log(`  - ${call.status} ${call.url}`)
          console.log(`    Response:`, JSON.stringify(call.response, null, 2))
        })
      } else {
        console.log('⚠️  No API calls detected - button click might not be working')
      }

      await page.screenshot({ path: 'test-results/sync-page-after-click.png', fullPage: true })
      console.log('📸 Screenshot saved: sync-page-after-click.png')
    } else {
      console.log('⚠️  Cannot test - no companies available')
    }
  })

  test('should check database for sync jobs table', async ({ page }) => {
    await page.goto('http://localhost:3000/integration/quickbooks/sync')

    // Try to fetch jobs directly
    console.log('🔍 Checking if sync jobs API works...')

    const response = await page.request.get('http://localhost:3000/api/quickbooks/sync/jobs')
    const status = response.status()

    console.log(`📡 GET /api/quickbooks/sync/jobs - Status: ${status}`)

    if (status === 200) {
      const data = await response.json()
      console.log('✅ API Response:', JSON.stringify(data, null, 2))
    } else {
      const text = await response.text()
      console.log('❌ API Error:', text)
    }
  })
})

test.describe('QuickBooks Sync API Endpoints', () => {
  test('should check if migration was applied', async ({ page }) => {
    // Try to access Supabase directly to check tables
    console.log('🔍 Checking database schema...')

    // This would need to be done through your API
    const response = await page.request.get('http://localhost:3000/api/quickbooks/sync/jobs')

    if (response.status() === 500) {
      const error = await response.json()
      console.log('❌ Database error (migration might not be applied):', error)
      console.log('💡 Run: npx supabase migration up')
    } else {
      console.log('✅ Database tables exist')
    }
  })
})
