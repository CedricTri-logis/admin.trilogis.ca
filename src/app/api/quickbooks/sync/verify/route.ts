/**
 * API Route: Verify QuickBooks Sync Counts
 *
 * GET /api/quickbooks/sync/verify?realmId=xxx
 *
 * Compares entity counts between QuickBooks and Supabase
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import { getAuthToken } from '@/lib/quickbooks/qb-service'
import axios from 'axios'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ENTITIES_TO_VERIFY = [
  { type: 'Customer', table: 'qb_customers' },
  { type: 'Vendor', table: 'qb_vendors' },
  { type: 'Account', table: 'qb_accounts' },
  { type: 'Invoice', table: 'qb_invoices' },
  { type: 'Payment', table: 'qb_payments' },
  { type: 'Bill', table: 'qb_bills' },
]

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const realmId = searchParams.get('realmId')

    if (!realmId) {
      return NextResponse.json(
        { error: 'realmId parameter is required' },
        { status: 400 }
      )
    }

    // Get auth token
    const token = await getAuthToken(realmId)
    if (!token) {
      return NextResponse.json(
        { error: 'No active QuickBooks connection found' },
        { status: 404 }
      )
    }

    const supabase = createSupabaseServiceRoleClient()
    const baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com'

    const results = []
    let totalQB = 0
    let totalSupabase = 0
    let allMatch = true

    for (const entity of ENTITIES_TO_VERIFY) {
      try {
        // Get count from QuickBooks
        const qbResponse = await axios.get(
          `${baseUrl}/v3/company/${realmId}/query`,
          {
            params: {
              query: `SELECT COUNT(*) FROM ${entity.type}`
            },
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        )

        const qbCount = qbResponse.data?.QueryResponse?.totalCount || 0

        // Get count from Supabase
        const { count: supabaseCount, error } = await supabase
          .schema('quickbooks')
          .from(entity.table)
          .select('*', { count: 'exact', head: true })
          .eq('realm_id', realmId)

        if (error) {
          console.error(`[verify] Error counting ${entity.type}:`, error)
        }

        const sbCount = supabaseCount || 0
        const matches = qbCount === sbCount

        if (!matches) {
          allMatch = false
        }

        totalQB += qbCount
        totalSupabase += sbCount

        results.push({
          entity: entity.type,
          table: entity.table,
          quickbooks: qbCount,
          supabase: sbCount,
          difference: qbCount - sbCount,
          matches
        })

      } catch (error: any) {
        console.error(`[verify] Error verifying ${entity.type}:`, error.message)
        results.push({
          entity: entity.type,
          table: entity.table,
          quickbooks: 0,
          supabase: 0,
          difference: 0,
          matches: false,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      realmId,
      companyName: token.company_name,
      verifiedAt: new Date().toISOString(),
      summary: {
        totalQuickBooks: totalQB,
        totalSupabase: totalSupabase,
        totalDifference: totalQB - totalSupabase,
        allMatch
      },
      entities: results
    })

  } catch (error: any) {
    console.error('[verify] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
