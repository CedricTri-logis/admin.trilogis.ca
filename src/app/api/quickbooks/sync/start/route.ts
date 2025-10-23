/**
 * API Route: Start QuickBooks Synchronization
 *
 * POST /api/quickbooks/sync/start
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import { ENTITY_CONFIG } from '@/lib/quickbooks/sync/entity-preparers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface StartSyncRequest {
  realmId: string
  startDate?: string
  endDate?: string
  entities?: string[]
  syncType?: 'full' | 'incremental' | 'entity_specific'
}

export async function POST(request: NextRequest) {
  try {
    const body: StartSyncRequest = await request.json()
    const { realmId, startDate, endDate, entities, syncType = 'full' } = body

    if (!realmId) {
      return NextResponse.json(
        { error: 'realmId is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceRoleClient()

    // Get auth token to verify realm exists
    const { data: token, error: tokenError } = await supabase
      .schema('quickbooks')
      .from('qb_auth_tokens')
      .select('*')
      .eq('realm_id', realmId)
      .eq('is_active', true)
      .single()

    if (tokenError || !token) {
      return NextResponse.json(
        { error: 'Invalid or inactive realm ID' },
        { status: 404 }
      )
    }

    // Determine which entities to sync
    let entitiesToSync: string[]
    if (syncType === 'entity_specific' && entities && entities.length > 0) {
      entitiesToSync = entities.filter(e => ENTITY_CONFIG[e])
    } else {
      entitiesToSync = Object.keys(ENTITY_CONFIG)
    }

    if (entitiesToSync.length === 0) {
      return NextResponse.json(
        { error: 'No valid entities specified' },
        { status: 400 }
      )
    }

    // Create sync job
    const { data: syncJob, error: jobError } = await supabase
      .schema('quickbooks')
      .from('sync_jobs')
      .insert({
        realm_id: realmId,
        company_name: token.company_name,
        status: 'pending',
        sync_type: syncType,
        start_date: startDate || null,
        end_date: endDate || null,
        entities_to_sync: entitiesToSync,
        total_entities: entitiesToSync.length,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (jobError || !syncJob) {
      console.error('[sync/start] Error creating sync job:', jobError)
      return NextResponse.json(
        { error: 'Failed to create sync job' },
        { status: 500 }
      )
    }

    // Create entity jobs for each entity
    const entityJobs = entitiesToSync.map(entityType => ({
      sync_job_id: syncJob.id,
      entity_type: entityType,
      entity_table: ENTITY_CONFIG[entityType].table,
      status: 'pending',
      batch_size: 1000
    }))

    const { error: entityJobError } = await supabase
      .schema('quickbooks')
      .from('sync_entity_jobs')
      .insert(entityJobs)

    if (entityJobError) {
      console.error('[sync/start] Error creating entity jobs:', entityJobError)
      // Rollback sync job
      await supabase
        .schema('quickbooks')
        .from('sync_jobs')
        .update({ status: 'failed', error_message: 'Failed to create entity jobs' })
        .eq('id', syncJob.id)

      return NextResponse.json(
        { error: 'Failed to create entity jobs' },
        { status: 500 }
      )
    }

    // Update sync job to running
    await supabase
      .schema('quickbooks')
      .from('sync_jobs')
      .update({ status: 'running' })
      .eq('id', syncJob.id)

    console.log(`[sync/start] Created sync job ${syncJob.id} for ${entitiesToSync.length} entities`)

    return NextResponse.json({
      success: true,
      jobId: syncJob.id,
      entities: entitiesToSync,
      message: `Sync job created for ${entitiesToSync.length} entities`
    })
  } catch (error: any) {
    console.error('[sync/start] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
