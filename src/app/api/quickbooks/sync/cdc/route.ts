/**
 * API Route: QuickBooks CDC (Change Data Capture) Sync
 *
 * POST /api/quickbooks/sync/cdc
 *
 * Fast incremental sync using QuickBooks CDC API
 * Returns only changed entities since last sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import { getAuthToken, makeQBRequest } from '@/lib/quickbooks/qb-service'
import { prepareEntityData, ENTITY_PREPARERS } from '@/lib/quickbooks/sync/entity-preparers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const ENTITY_TYPES = [
  'Customer', 'Vendor', 'Account', 'Invoice', 'Payment', 'Bill',
  'CompanyInfo', 'Class', 'Department', 'Item', 'Employee'
]

export async function POST(request: NextRequest) {
  try {
    const { realmId } = await request.json()

    if (!realmId) {
      return NextResponse.json({ error: 'realmId is required' }, { status: 400 })
    }

    const token = await getAuthToken(realmId)
    if (!token) {
      return NextResponse.json({ error: 'No active QuickBooks connection' }, { status: 404 })
    }

    const supabase = createSupabaseServiceRoleClient()
    const baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com'

    // Get last sync checkpoint
    const { data: lastSync } = await supabase
      .from('qb_cdc_sync_log')
      .select('last_sync_checkpoint')
      .eq('realm_id', realmId)
      .eq('status', 'success')
      .order('sync_completed_at', { ascending: false })
      .limit(1)
      .single()

    // Default to 30 days ago if no previous sync
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const changedSince = lastSync?.last_sync_checkpoint
      ? new Date(lastSync.last_sync_checkpoint)
      : thirtyDaysAgo

    console.log(`[CDC] Fetching changes since: ${changedSince.toISOString()}`)

    // Build CDC URL - fetches ALL entity types in ONE call
    const entities = ENTITY_TYPES.join(',')
    const cdcUrl = `${baseUrl}/v3/company/${realmId}/cdc?entities=${entities}&changedSince=${changedSince.toISOString()}`

    const startTime = Date.now()

    // Make CDC request with automatic token refresh
    const response = await makeQBRequest('GET', cdcUrl, token)

    const cdcData = response?.CDCResponse?.[0]

    if (!cdcData || !cdcData.QueryResponse) {
      console.log('[CDC] No changes found')

      // Log successful sync with no changes
      await supabase.from('qb_cdc_sync_log').insert({
        realm_id: realmId,
        sync_started_at: new Date(startTime),
        sync_completed_at: new Date(),
        changed_since: changedSince,
        last_sync_checkpoint: new Date(),
        status: 'success',
        total_changes: 0,
        sync_duration_seconds: Math.floor((Date.now() - startTime) / 1000)
      })

      return NextResponse.json({
        success: true,
        message: 'No changes found',
        stats: { created: 0, updated: 0, deleted: 0 },
        duration: Math.floor((Date.now() - startTime) / 1000)
      })
    }

    // Process changes using entity preparers
    const stats = { created: 0, updated: 0, deleted: 0, errors: 0 }
    const entitiesSynced: string[] = []

    for (const queryResponse of cdcData.QueryResponse) {
      for (const entityType of ENTITY_TYPES) {
        const entities = queryResponse[entityType]

        if (entities && entities.length > 0) {
          entitiesSynced.push(entityType)
          console.log(`[CDC] Processing ${entities.length} ${entityType} changes`)

          const tableName = getTableName(entityType)
          if (!tableName) continue

          for (const entity of entities) {
            try {
              // Handle deletions
              if (entity.status === 'Deleted') {
                await supabase.from(tableName)
                  .delete()
                  .eq('realm_id', realmId)
                  .eq('qb_id', entity.Id)

                stats.deleted++
              } else {
                // Check if we have a preparer for this entity type
                if (!ENTITY_PREPARERS[entityType]) {
                  console.log(`[CDC] Skipping ${entityType} - no preparer function`)
                  continue
                }

                // Prepare entity data
                const data = prepareEntityData(entity, entityType, realmId)

                // Upsert (update or insert)
                const { error } = await supabase.from(tableName).upsert(data, {
                  onConflict: 'realm_id,qb_id'
                })

                if (error) {
                  console.error(`[CDC] Error upserting ${entityType}:`, error)
                  stats.errors++
                } else {
                  stats.created++ // Could be update too, CDC doesn't distinguish
                }
              }
            } catch (err: any) {
              console.error(`[CDC] Error processing ${entityType}:`, err.message)
              stats.errors++
            }
          }
        }
      }
    }

    const duration = Math.floor((Date.now() - startTime) / 1000)

    // Log successful sync
    await supabase.from('qb_cdc_sync_log').insert({
      realm_id: realmId,
      sync_started_at: new Date(startTime),
      sync_completed_at: new Date(),
      changed_since: changedSince,
      last_sync_checkpoint: new Date(), // Store current time as checkpoint for next sync
      entities_synced: entitiesSynced,
      records_created: stats.created,
      records_updated: stats.updated,
      records_deleted: stats.deleted,
      total_changes: stats.created + stats.updated + stats.deleted,
      status: 'success',
      sync_duration_seconds: duration
    })

    console.log(`[CDC] Sync completed in ${duration}s:`, stats)

    return NextResponse.json({
      success: true,
      message: `Synced ${stats.created + stats.updated + stats.deleted} changes`,
      stats,
      duration,
      entitiesSynced
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0'
      }
    })

  } catch (error: any) {
    console.error('[CDC] Sync failed:', error)
    return NextResponse.json({
      error: error.message || 'CDC sync failed'
    }, { status: 500 })
  }
}

function getTableName(entityType: string): string | null {
  const mapping: Record<string, string> = {
    'CompanyInfo': 'qb_companies',
    'Customer': 'qb_customers',
    'Vendor': 'qb_vendors',
    'Account': 'qb_accounts',
    'Class': 'qb_classes',
    'Department': 'qb_departments',
    'Item': 'qb_items',
    'Employee': 'qb_employees',
    'Invoice': 'qb_invoices',
    'Bill': 'qb_bills',
    'Payment': 'qb_payments'
  }
  return mapping[entityType] || null
}
