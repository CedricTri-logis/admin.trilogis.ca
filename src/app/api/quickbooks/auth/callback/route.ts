import { NextRequest, NextResponse } from 'next/server'
import axios from 'axios'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'

/**
 * GET /api/quickbooks/auth/callback
 * Handles QuickBooks OAuth callback and stores tokens
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const realmId = searchParams.get('realmId')
    const error = searchParams.get('error')

    // Handle OAuth errors
    if (error) {
      console.error('[QB Auth Callback] OAuth error:', error)
      return NextResponse.redirect(
        new URL(`/?error=quickbooks_oauth_failed&message=${error}`, request.url)
      )
    }

    if (!code || !realmId) {
      return NextResponse.json(
        { error: 'Missing authorization code or realm ID' },
        { status: 400 }
      )
    }

    const clientId = process.env.QUICKBOOKS_CLIENT_ID
    const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
    const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.json(
        { error: 'QuickBooks OAuth credentials not configured' },
        { status: 500 }
      )
    }

    console.log('[QB Auth Callback] Exchanging code for tokens, realm:', realmId)

    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
      }
    )

    const tokens = tokenResponse.data
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    console.log('[QB Auth Callback] Tokens received, storing in database')

    // Store tokens in database
    const supabase = createSupabaseServiceRoleClient()

    // First, deactivate any existing tokens for this realm
    await supabase
      .schema('quickbooks')
      .from('qb_auth_tokens')
      .update({ is_active: false })
      .eq('realm_id', realmId)

    // Insert new tokens
    const { error: dbError } = await supabase.schema('quickbooks').from('qb_auth_tokens').insert({
      realm_id: realmId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_token_expires_at: expiresAt,
      token_type: tokens.token_type || 'Bearer',
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (dbError) {
      console.error('[QB Auth Callback] Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to store tokens in database' },
        { status: 500 }
      )
    }

    console.log('[QB Auth Callback] Success! Tokens stored for realm:', realmId)

    // Redirect to success page or dashboard
    return NextResponse.redirect(
      new URL(`/?success=quickbooks_connected&realmId=${realmId}`, request.url)
    )
  } catch (error: any) {
    console.error('[GET /api/quickbooks/auth/callback] Error:', error)

    const errorMessage = error.response?.data?.error_description || error.message
    return NextResponse.redirect(
      new URL(`/?error=quickbooks_oauth_failed&message=${encodeURIComponent(errorMessage)}`, request.url)
    )
  }
}
