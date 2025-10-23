/**
 * API Route: Cancel Sync Jobs
 *
 * POST /api/quickbooks/sync/cancel
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()

    const supabase = createSupabaseServiceRoleClient()

    const { data, error } = await supabase
      .schema('quickbooks')
      .from('sync_jobs')
      .update({
        status: 'cancelled',
        error_message: 'Cancelled by user',
        completed_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single()

    if (error) {
      console.error('[sync/cancel] Error cancelling job:', error)
      return NextResponse.json(
        { error: 'Failed to cancel sync job' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, job: data })

  } catch (error: any) {
    console.error('[sync/cancel] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
