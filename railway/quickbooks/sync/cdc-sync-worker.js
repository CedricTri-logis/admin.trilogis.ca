/**
 * CDC Sync Worker
 * Handles QuickBooks Change Data Capture synchronization
 */

const { getAuthToken, makeQBRequest, getQuickBooksBaseUrl } = require('./qb-auth');
const { prepareEntityData, getTableName } = require('./entity-preparers');

class CDCSyncWorker {
  constructor(realmId, jobId, supabase, verify = false) {
    this.realmId = realmId;
    this.jobId = jobId;
    this.supabase = supabase;
    this.verify = verify;

    // All entity types to sync via CDC
    // CDC supports all API entities EXCEPT: journalCode, taxAgency, timeActivity, taxCode, taxRate
    // Source: https://blogs.intuit.com/2023/08/24/building-smarter-with-intuit-stay-in-sync-with-cdc/
    this.entityTypes = [
      'CompanyInfo',
      'Customer',
      'Vendor',
      'Account',
      'Class',
      'Department',
      'Item',
      'Employee',
      'Invoice',
      'Bill',
      'Payment',
      'BillPayment',
      'CreditMemo',
      'Deposit',
      'Estimate',
      'JournalEntry',
      'Purchase',
      'SalesReceipt',
      'Transfer',
      'VendorCredit'
    ];

    this.stats = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: 0
    };
  }

  /**
   * Emit a progress event to the database for SSE streaming
   */
  async emit(eventType, data) {
    try {
      await this.supabase.from('qb_sync_events').insert({
        job_id: this.jobId,
        event_type: eventType,
        event_data: data,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to emit event:', error.message);
    }
  }

  /**
   * Update job status in database
   */
  async updateJobStatus(status, stats = null, errorMessage = null) {
    const updates = {
      status,
      ...(status === 'in_progress' && { started_at: new Date().toISOString() }),
      ...(status === 'completed' && { completed_at: new Date().toISOString() }),
      ...(stats && { stats }),
      ...(errorMessage && { error_message: errorMessage })
    };

    await this.supabase
      .from('qb_sync_jobs')
      .update(updates)
      .eq('id', this.jobId);
  }

  /**
   * Get the last sync checkpoint timestamp
   */
  async getLastSyncCheckpoint() {
    // Check for the latest CDC sync log entry
    const { data: lastSync } = await this.supabase
      .from('qb_cdc_sync_log')
      .select('last_sync_checkpoint')
      .eq('realm_id', this.realmId)
      .eq('status', 'completed')
      .order('sync_completed_at', { ascending: false })
      .limit(1)
      .single();

    if (lastSync && lastSync.last_sync_checkpoint) {
      return lastSync.last_sync_checkpoint;
    }

    // Fallback: get latest updated_at from any table
    const tables = this.entityTypes.map(type => getTableName(type)).filter(Boolean);
    let latestUpdate = null;

    for (const table of tables) {
      const { data } = await this.supabase
        .from(table)
        .select('updated_at')
        .eq('realm_id', this.realmId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (data && data.updated_at) {
        const updateTime = new Date(data.updated_at);
        if (!latestUpdate || updateTime > latestUpdate) {
          latestUpdate = updateTime;
        }
      }
    }

    // CDC has 30-day limit
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const startPoint = latestUpdate || thirtyDaysAgo;

    return startPoint > thirtyDaysAgo
      ? startPoint.toISOString()
      : thirtyDaysAgo.toISOString();
  }

  /**
   * Fetch CDC data from QuickBooks
   */
  async fetchCDCData(token, changedSince) {
    const baseUrl = getQuickBooksBaseUrl();
    const entities = this.entityTypes.join(',');

    // Format timestamp for QuickBooks CDC API
    // QuickBooks expects ISO format with timezone: YYYY-MM-DDTHH:mm:ss+00:00
    const date = new Date(changedSince);
    const isoString = date.toISOString();

    // Convert from "2025-10-23T15:54:55.417Z" to "2025-10-23T15:54:55+00:00"
    const formattedTimestamp = isoString.split('.')[0] + '+00:00';

    const url = `${baseUrl}/v3/company/${this.realmId}/cdc?entities=${entities}&changedSince=${encodeURIComponent(formattedTimestamp)}`;

    return await makeQBRequest('GET', url, token, this.supabase);
  }

  /**
   * Process entity changes (creates/updates/deletes)
   */
  async processEntities(entities, entityType) {
    const tableName = getTableName(entityType);
    if (!tableName) {
      console.log(`⚠️  No table mapping for ${entityType}, skipping`);
      return { created: 0, updated: 0, deleted: 0, errors: 0 };
    }

    const stats = { created: 0, updated: 0, deleted: 0, errors: 0 };

    for (const entity of entities) {
      try {
        // Handle deletions
        if (entity.status === 'Deleted') {
          // Log deletion
          await this.supabase.from('qb_deletion_log').upsert({
            realm_id: this.realmId,
            entity_type: entityType,
            qb_id: entity.Id,
            deleted_at: entity.MetaData?.LastUpdatedTime || new Date().toISOString()
          });

          // Mark as deleted (soft delete)
          await this.supabase
            .from(tableName)
            .update({ is_deleted: true })
            .eq('realm_id', this.realmId)
            .eq('qb_id', entity.Id);

          stats.deleted++;
        } else {
          // Prepare entity data
          const data = prepareEntityData(entity, entityType, this.realmId);

          // Upsert (insert or update)
          const { error } = await this.supabase
            .from(tableName)
            .upsert(data, {
              onConflict: 'realm_id,qb_id',
              ignoreDuplicates: false
            });

          if (error) {
            console.error(`Error upserting ${entityType} ${entity.Id}:`, error.message);
            stats.errors++;
          } else {
            stats.created++; // CDC doesn't distinguish between create/update
          }
        }
      } catch (err) {
        console.error(`Error processing ${entityType} ${entity.Id}:`, err.message);
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Extract entities from CDC response
   */
  extractEntities(cdcData, entityType) {
    const entities = [];

    if (!cdcData.CDCResponse || !Array.isArray(cdcData.CDCResponse)) {
      return entities;
    }

    for (const cdcResponse of cdcData.CDCResponse) {
      if (cdcResponse.QueryResponse && Array.isArray(cdcResponse.QueryResponse)) {
        for (const queryResponse of cdcResponse.QueryResponse) {
          if (queryResponse[entityType] && Array.isArray(queryResponse[entityType])) {
            entities.push(...queryResponse[entityType]);
          }
        }
      }
    }

    return entities;
  }

  /**
   * Verify entity counts between QuickBooks and Database
   */
  async verifyEntityCounts(token) {
    const results = [];
    const baseUrl = getQuickBooksBaseUrl();

    for (const entityType of this.entityTypes) {
      try {
        // Query QuickBooks for count
        const queryUrl = `${baseUrl}/v3/company/${this.realmId}/query?query=SELECT COUNT(*) FROM ${entityType}`;
        const qbData = await makeQBRequest('GET', queryUrl, token, this.supabase);

        const qbCount = qbData?.QueryResponse?.totalCount || 0;

        // Query Database for count
        const tableName = getTableName(entityType);
        if (!tableName) continue;

        const { count: dbCount } = await this.supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true })
          .eq('realm_id', this.realmId)
          .eq('is_deleted', false);

        const match = qbCount === dbCount;

        results.push({
          entity: entityType,
          qbCount,
          dbCount,
          match,
          emoji: match ? '✅' : '❌'
        });
      } catch (err) {
        console.error(`Verification error for ${entityType}:`, err.message);
        results.push({
          entity: entityType,
          qbCount: '?',
          dbCount: '?',
          match: false,
          emoji: '⚠️',
          error: err.message
        });
      }
    }

    return results;
  }

  /**
   * Run the CDC sync process
   */
  async run() {
    try {
      await this.updateJobStatus('in_progress');
      await this.emit('progress', { message: '🚀 Starting CDC sync...', emoji: '🚀' });

      // Get auth token
      const token = await getAuthToken(this.realmId, this.supabase);
      if (!token) {
        throw new Error('No active QuickBooks connection');
      }

      // Get last sync checkpoint
      const changedSince = await this.getLastSyncCheckpoint();
      await this.emit('progress', {
        message: `📅 Syncing changes since ${changedSince}`,
        emoji: '📅'
      });

      // Fetch CDC data
      await this.emit('progress', {
        message: '📊 Fetching changes from QuickBooks...',
        emoji: '📊'
      });

      const cdcData = await this.fetchCDCData(token, changedSince);

      // Process each entity type
      for (const entityType of this.entityTypes) {
        const entities = this.extractEntities(cdcData, entityType);

        if (entities.length > 0) {
          await this.emit('progress', {
            message: `Processing ${entities.length} ${entityType} changes`,
            entity: entityType,
            count: entities.length,
            emoji: '📊'
          });

          const result = await this.processEntities(entities, entityType);

          this.stats.created += result.created;
          this.stats.updated += result.updated;
          this.stats.deleted += result.deleted;
          this.stats.errors += result.errors;

          await this.emit('progress', {
            message: `✅ ${entityType} complete (${result.created} created, ${result.deleted} deleted)`,
            entity: entityType,
            emoji: '✅'
          });
        }
      }

      // Verification mode
      if (this.verify) {
        await this.emit('progress', {
          message: '🔍 Verifying entity counts...',
          emoji: '🔍'
        });

        const verificationResults = await this.verifyEntityCounts(token);
        await this.emit('verification', { results: verificationResults });
      }

      // Log sync completion
      await this.supabase.from('qb_cdc_sync_log').insert({
        realm_id: this.realmId,
        sync_started_at: new Date().toISOString(),
        sync_completed_at: new Date().toISOString(),
        last_sync_checkpoint: new Date().toISOString(),
        changed_since: changedSince,
        records_created: this.stats.created,
        records_updated: this.stats.updated,
        records_deleted: this.stats.deleted,
        total_changes: this.stats.created + this.stats.updated + this.stats.deleted,
        status: 'completed'
      });

      // Complete
      await this.updateJobStatus('completed', this.stats);
      await this.emit('complete', { stats: this.stats });

      console.log('✅ CDC Sync completed successfully');
    } catch (error) {
      console.error('❌ CDC Sync failed:', error.message);
      await this.updateJobStatus('failed', null, error.message);
      await this.emit('error', { message: error.message });
      throw error;
    }
  }
}

module.exports = CDCSyncWorker;
