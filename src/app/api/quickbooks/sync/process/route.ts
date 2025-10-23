/**
 * API Route: Process QuickBooks Synchronization Batches
 *
 * POST /api/quickbooks/sync/process
 *
 * This endpoint processes pending sync jobs. It runs for max 50 seconds
 * and can be called repeatedly until all jobs are complete.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import { QuickBooksImporter } from '@/lib/quickbooks/sync/qb-importer'
import { getAuthToken } from '@/lib/quickbooks/qb-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // Vercel Pro: 60 seconds max

export async function POST(request: NextRequest) {
  const maxExecutionTime = 50000 // 50 seconds (stay under 60s limit)
  const startTime = Date.now()

  try {
    const supabase = createSupabaseServiceRoleClient()

    let processedEntities = 0
    let errors: string[] = []

    // Process entities until time runs out
    while ((Date.now() - startTime) < maxExecutionTime) {
      // Get next pending entity job
      const { data: entityJob, error: fetchError } = await supabase
        .schema('quickbooks')
        .from('sync_entity_jobs')
        .select(`
          *,
          sync_jobs (
            realm_id,
            company_name,
            start_date,
            end_date
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      // No more pending jobs
      if (fetchError || !entityJob) {
        break
      }

      const syncJob = Array.isArray(entityJob.sync_jobs)
        ? entityJob.sync_jobs[0]
        : entityJob.sync_jobs

      if (!syncJob) {
        console.error('[sync/process] No sync job found for entity job:', entityJob.id)
        await supabase
          .schema('quickbooks')
          .from('sync_entity_jobs')
          .update({
            status: 'failed',
            error_message: 'Parent sync job not found'
          })
          .eq('id', entityJob.id)
        continue
      }

      console.log(`[sync/process] Processing ${entityJob.entity_type} for ${syncJob.company_name}`)

      // Mark as running
      await supabase
        .schema('quickbooks')
        .from('sync_entity_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString()
        })
        .eq('id', entityJob.id)

      try {
        // Get auth token
        const token = await getAuthToken(syncJob.realm_id)
        if (!token) {
          throw new Error('Failed to get auth token')
        }

        // Initialize importer
        const importer = new QuickBooksImporter({
          startDate: syncJob.start_date || undefined,
          endDate: syncJob.end_date || undefined
        })

        // Import the entity
        const result = await importer.importEntity(
          entityJob.entity_type,
          token,
          syncJob.start_date || undefined,
          syncJob.end_date || undefined
        )

        // Update entity job with results
        await supabase
          .schema('quickbooks')
          .from('sync_entity_jobs')
          .update({
            status: 'completed',
            total_count: result.total,
            processed_count: result.imported,
            error_count: result.errors,
            completed_at: new Date().toISOString()
          })
          .eq('id', entityJob.id)

        processedEntities++
        console.log(`[sync/process] Completed ${entityJob.entity_type}: ${result.imported}/${result.total}`)

        // Cleanup
        await importer.cleanup()

      } catch (error: any) {
        console.error(`[sync/process] Error processing ${entityJob.entity_type}:`, error)

        // Mark entity job as failed
        await supabase
          .schema('quickbooks')
          .from('sync_entity_jobs')
          .update({
            status: 'failed',
            error_message: error.message,
            completed_at: new Date().toISOString()
          })
          .eq('id', entityJob.id)

        errors.push(`${entityJob.entity_type}: ${error.message}`)
      }

      // Check if we're running out of time
      const elapsed = Date.now() - startTime
      if (elapsed > maxExecutionTime * 0.9) {
        console.log('[sync/process] Approaching timeout, stopping')
        break
      }
    }

    const totalElapsed = (Date.now() - startTime) / 1000

    return NextResponse.json({
      success: true,
      processed: processedEntities,
      elapsed: totalElapsed,
      errors: errors.length > 0 ? errors : undefined,
      message: processedEntities > 0
        ? `Processed ${processedEntities} entities in ${totalElapsed.toFixed(1)}s`
        : 'No pending entities to process'
    })

  } catch (error: any) {
    console.error('[sync/process] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
