/**
 * API Route: Get QuickBooks Sync Job Status
 *
 * GET /api/quickbooks/sync/status/[jobId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceRoleClient()

    // Get sync job with entity jobs
    const { data: syncJob, error: jobError } = await supabase
      .schema('quickbooks')
      .from('sync_jobs')
      .select(`
        *,
        sync_entity_jobs (
          id,
          entity_type,
          status,
          total_count,
          processed_count,
          error_count,
          started_at,
          completed_at,
          error_message
        )
      `)
      .eq('id', jobId)
      .single()

    if (jobError || !syncJob) {
      return NextResponse.json(
        { error: 'Sync job not found' },
        { status: 404 }
      )
    }

    // Calculate progress
    const totalEntities = syncJob.total_entities || 0
    const completedEntities = syncJob.completed_entities || 0
    const progressPercent = totalEntities > 0
      ? Math.round((completedEntities / totalEntities) * 100)
      : 0

    // Calculate time stats
    const startedAt = syncJob.started_at ? new Date(syncJob.started_at) : null
    const completedAt = syncJob.completed_at ? new Date(syncJob.completed_at) : null
    const now = new Date()

    const elapsed = startedAt
      ? Math.round((completedAt || now).getTime() - startedAt.getTime()) / 1000
      : 0

    return NextResponse.json({
      id: syncJob.id,
      realmId: syncJob.realm_id,
      companyName: syncJob.company_name,
      status: syncJob.status,
      syncType: syncJob.sync_type,
      dateRange: {
        start: syncJob.start_date,
        end: syncJob.end_date
      },
      progress: {
        totalEntities,
        completedEntities,
        failedEntities: syncJob.failed_entities || 0,
        progressPercent,
        totalRecords: syncJob.total_records || 0,
        processedRecords: syncJob.processed_records || 0,
        errorRecords: syncJob.error_records || 0
      },
      timing: {
        startedAt: syncJob.started_at,
        completedAt: syncJob.completed_at,
        elapsedSeconds: elapsed
      },
      entities: syncJob.sync_entity_jobs || [],
      errorMessage: syncJob.error_message
    })

  } catch (error: any) {
    console.error('[sync/status] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
