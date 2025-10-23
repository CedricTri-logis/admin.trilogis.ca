import { test, expect } from '@playwright/test'

test.describe('QuickBooks Sync Authentication', () => {
  test('should login and navigate to sync page successfully', async ({ page }) => {
    // Navigate to login page
    console.log('🔍 Navigating to login page...')
    await page.goto('http://localhost:3000/login')
    await page.screenshot({ path: 'test-results/01-login-page.png', fullPage: true })

    // Fill in login form
    console.log('📝 Filling login form...')
    await page.fill('input[type="email"]', 'cedric@lajoie.com')
    await page.fill('input[type="password"]', 'Liberte25')
    await page.screenshot({ path: 'test-results/02-login-filled.png', fullPage: true })

    // Click sign in
    console.log('🖱️  Clicking Sign in...')
    await page.click('button[type="submit"]')

    // Wait for navigation and check URL
    console.log('⏳ Waiting for navigation...')
    await page.waitForTimeout(3000) // Give it time to authenticate

    const currentUrl = page.url()
    console.log('📍 Current URL after login:', currentUrl)
    await page.screenshot({ path: 'test-results/03-after-login.png', fullPage: true })

    // Check cookies
    const cookies = await page.context().cookies()
    console.log('🍪 Cookies:', cookies.map(c => c.name))

    // Try to navigate to dashboard first
    console.log('🔍 Navigating to dashboard...')
    await page.goto('http://localhost:3000/dashboard')
    await page.waitForTimeout(2000)

    const dashboardUrl = page.url()
    console.log('📍 Dashboard URL:', dashboardUrl)
    await page.screenshot({ path: 'test-results/04-dashboard.png', fullPage: true })

    if (dashboardUrl.includes('login')) {
      console.log('❌ Still on login page after dashboard navigation')
      console.log('🔍 Checking if user is authenticated...')

      // Check local storage
      const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage))
      console.log('💾 LocalStorage:', localStorage)

      // Check session storage
      const sessionStorage = await page.evaluate(() => JSON.stringify(window.sessionStorage))
      console.log('💾 SessionStorage:', sessionStorage)
    } else {
      console.log('✅ Successfully navigated to dashboard')

      // Now try sync page
      console.log('🔍 Navigating to sync page...')
      await page.goto('http://localhost:3000/integration/quickbooks/sync')
      await page.waitForTimeout(2000)

      const syncUrl = page.url()
      console.log('📍 Sync page URL:', syncUrl)
      await page.screenshot({ path: 'test-results/05-sync-page.png', fullPage: true })

      if (syncUrl.includes('login')) {
        console.log('❌ Redirected to login from sync page')
      } else {
        console.log('✅ Successfully loaded sync page')

        // Check for the title
        const title = await page.textContent('h1, h2, h3')
        console.log('📝 Page title:', title)
      }
    }
  })

  test('should check if sync page exists in routing', async ({ page, request }) => {
    // Check if the page file exists by trying to access it directly
    console.log('🔍 Checking if sync page route exists...')

    const response = await request.get('http://localhost:3000/integration/quickbooks/sync')
    console.log('📡 Response status:', response.status())
    console.log('📡 Response headers:', response.headers())

    if (response.status() === 404) {
      console.log('❌ Route does not exist (404)')
      console.log('💡 The page file might not be created yet or there\'s a routing issue')
    } else if (response.status() === 302 || response.status() === 307) {
      console.log('🔄 Route redirects (302/307) - likely auth redirect')
    } else if (response.status() === 200) {
      console.log('✅ Route exists and responds')
    }
  })

  test('should login with proper authentication flow', async ({ page }) => {
    // Go to login
    await page.goto('http://localhost:3000/login')

    // Listen for all requests
    page.on('request', request => {
      if (request.url().includes('auth')) {
        console.log('🔐 Auth request:', request.method(), request.url())
      }
    })

    page.on('response', response => {
      if (response.url().includes('auth')) {
        console.log('🔐 Auth response:', response.status(), response.url())
      }
    })

    // Fill and submit
    await page.fill('input[type="email"]', 'cedric@lajoie.com')
    await page.fill('input[type="password"]', 'Liberte25')

    // Click submit and wait for navigation
    await Promise.all([
      page.waitForNavigation({ timeout: 10000 }),
      page.click('button[type="submit"]')
    ])

    console.log('📍 URL after login:', page.url())

    // Wait a bit more for auth to settle
    await page.waitForTimeout(2000)

    // Now go to sync page
    console.log('🔍 Navigating to sync page after proper auth...')
    await page.goto('http://localhost:3000/integration/quickbooks/sync', {
      waitUntil: 'networkidle'
    })

    const finalUrl = page.url()
    console.log('📍 Final URL:', finalUrl)

    await page.screenshot({ path: 'test-results/final-sync-page.png', fullPage: true })

    // Check if we're still on login
    if (finalUrl.includes('login')) {
      console.log('❌ Still redirected to login')
      console.log('🔍 Checking page content...')

      const bodyText = await page.textContent('body')
      console.log('📄 Page contains "Sign in":', bodyText?.includes('Sign in'))
    } else {
      console.log('✅ Successfully on sync page!')

      // Look for any text on the page
      const allText = await page.textContent('body')
      console.log('📄 Page content preview:', allText?.substring(0, 200))
    }
  })
})
