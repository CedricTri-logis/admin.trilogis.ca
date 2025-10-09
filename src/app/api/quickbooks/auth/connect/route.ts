import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/quickbooks/auth/connect
 * Initiates QuickBooks OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.QUICKBOOKS_CLIENT_ID
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI
    const environment = process.env.QUICKBOOKS_ENVIRONMENT || 'production'

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'QuickBooks OAuth is not configured. Missing CLIENT_ID or REDIRECT_URI' },
        { status: 500 }
      )
    }

    // Generate state parameter for CSRF protection
    const state = Math.random().toString(36).substring(7)

    // Build QuickBooks OAuth URL
    const authUrl = new URL(
      environment === 'production'
        ? 'https://appcenter.intuit.com/connect/oauth2'
        : 'https://appcenter.intuit.com/connect/oauth2'
    )

    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('scope', 'com.intuit.quickbooks.accounting')
    authUrl.searchParams.set('state', state)

    console.log('[QB Auth] Redirecting to QuickBooks OAuth:', authUrl.toString())

    // Redirect to QuickBooks OAuth page
    return NextResponse.redirect(authUrl.toString())
  } catch (error: any) {
    console.error('[GET /api/quickbooks/auth/connect] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to initiate OAuth flow' },
      { status: 500 }
    )
  }
}
