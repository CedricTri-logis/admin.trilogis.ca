/**
 * API Route: List QuickBooks Sync Jobs
 *
 * GET /api/quickbooks/sync/jobs
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServiceRoleClient()

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status')

    let query = supabase
      .schema('quickbooks')
      .from('sync_jobs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: jobs, error, count } = await query

    if (error) {
      console.error('[sync/jobs] Error fetching jobs:', error)
      return NextResponse.json(
        { error: 'Failed to fetch sync jobs' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      jobs: jobs || [],
      total: count || 0,
      limit,
      offset
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })

  } catch (error: any) {
    console.error('[sync/jobs] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
