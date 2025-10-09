import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/quickbooks/auth/debug
 * Debug endpoint to check QuickBooks OAuth configuration
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI
  const environment = process.env.QUICKBOOKS_ENVIRONMENT
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET

  return NextResponse.json({
    hasClientId: !!clientId,
    hasClientSecret: !!clientSecret,
    hasRedirectUri: !!redirectUri,
    clientIdPrefix: clientId ? clientId.substring(0, 10) + '...' : 'missing',
    redirectUri: redirectUri || 'missing',
    environment: environment || 'missing',
    timestamp: new Date().toISOString(),
  })
}
