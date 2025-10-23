/**
 * Mews Sync Worker
 * Handles Mews data import (space categories, spaces, reservations, accounting items)
 */

const axios = require('axios');

class MewsSyncWorker {
  constructor(jobId, supabase, options = {}) {
    this.jobId = jobId;
    this.supabase = supabase;

    // Import options
    this.from = options.from || this.getDefaultStartDate();
    this.to = options.to || new Date().toISOString().split('T')[0];
    this.truncate = options.truncate || false;
    this.batchDays = options.batchDays || 7;
    this.reservationBatchDays = options.reservationBatchDays || 31;
    this.reservationLeadDays = options.reservationLeadDays || 120;

    // Mews API config
    this.mewsApiUrl = process.env.MEWS_API_URL || 'https://api.mews.com';
    this.mewsClientToken = process.env.MEWS_CLIENT_TOKEN;
    this.mewsAccessToken = process.env.MEWS_ACCESS_TOKEN;
    this.mewsServiceId = process.env.MEWS_SERVICE_ID || '205b838c-02a3-47ae-a329-aee8010a0a25';

    // Template patterns for spaces
    this.templatePatterns = [
      /^APP2/,
      /^APP3/,
      /^LOFT/,
      /^SUITE/,
      /^DIVAN-LIT/,
      /^MINI LOFT/,
      /^LE CHAMBREUR$/
    ];

    // Stats
    this.stats = {
      categories: 0,
      spaces: 0,
      reservations: 0,
      accountingItems: 0,
      errors: 0
    };
  }

  getDefaultStartDate() {
    return '2020-01-01';
  }

  /**
   * Emit a progress event to the database for SSE streaming
   */
  async emit(eventType, data) {
    try {
      await this.supabase.from('mews_sync_events').insert({
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
      .from('mews_sync_jobs')
      .update(updates)
      .eq('id', this.jobId);
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if space is a template
   */
  isTemplateSpace(name) {
    if (!name) return false;
    return this.templatePatterns.some(pattern => pattern.test(name.toUpperCase()));
  }

  /**
   * Convert UTC to Eastern date
   */
  toEasternDate(utcString) {
    if (!utcString) return null;
    const date = new Date(utcString);
    if (Number.isNaN(date.getTime())) return null;

    const easternFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    return easternFormatter.format(date);
  }

  /**
   * Truncate mews2 tables
   */
  async truncateMews2Tables() {
    await this.emit('progress', { message: '🗑  Truncating mews2 tables...', emoji: '🗑' });

    const tables = ['accounting_items', 'reservations', 'spaces', 'space_categories'];
    for (const table of tables) {
      const { error, count } = await this.supabase
        .schema('mews2')
        .from(table)
        .delete({ count: 'exact' })
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (error) {
        console.error(`Failed to truncate ${table}:`, error.message);
        throw error;
      }

      await this.emit('progress', {
        message: `   ${table}: removed ${count || 0} rows`,
        emoji: '✅'
      });
    }
  }

  /**
   * Import space metadata (categories and spaces)
   */
  async importSpaceMetadata() {
    await this.emit('progress', { message: '📁 Importing space categories & spaces...', emoji: '📁' });

    try {
      const response = await axios.post(
        `${this.mewsApiUrl}/api/connector/v1/resources/getAll`,
        {
          ClientToken: this.mewsClientToken,
          AccessToken: this.mewsAccessToken,
          Client: 'Tri-Logis Import',
          ServiceIds: [this.mewsServiceId],
          Extent: {
            Resources: true,
            ResourceCategories: true,
            ResourceCategoryAssignments: true,
            Inactive: true
          }
        }
      );

      const categories = response.data.ResourceCategories || [];
      const resources = response.data.Resources || [];
      const assignments = response.data.ResourceCategoryAssignments || [];

      // Prepare categories
      const categoryRows = categories.map(cat => ({
        id: cat.Id,
        name: cat.Names?.en || cat.Name || 'Unknown',
        short_name: cat.ShortName || null,
        capacity: cat.Capacity || null,
        extra_capacity: cat.ExtraCapacity || null,
        is_active: cat.IsActive !== false,
        created_at: cat.CreatedUtc || new Date().toISOString(),
        updated_at: cat.UpdatedUtc || cat.CreatedUtc || new Date().toISOString()
      }));

      // Build category map
      const categoryMap = new Map();
      assignments.forEach(assign => {
        if (assign.ResourceId && assign.ResourceCategoryId) {
          categoryMap.set(assign.ResourceId, assign.ResourceCategoryId);
        }
      });

      // Prepare spaces
      const spaceRows = resources.map(resource => ({
        id: resource.Id,
        category_id: categoryMap.get(resource.Id) || null,
        name: resource.Name || resource.ShortName || 'Unknown',
        code: resource.ShortName || null,
        floor: resource.Floor || null,
        is_active: resource.IsActive !== false,
        is_template: this.isTemplateSpace(resource.Name || ''),
        metadata: resource,
        created_at: resource.CreatedUtc || new Date().toISOString(),
        updated_at: resource.UpdatedUtc || resource.CreatedUtc || new Date().toISOString()
      }));

      // Insert categories
      if (categoryRows.length) {
        const { error } = await this.supabase
          .schema('mews2')
          .from('space_categories')
          .upsert(categoryRows, { onConflict: 'id' });

        if (error) throw error;
      }

      // Insert spaces in batches
      if (spaceRows.length) {
        const batchSize = 500;
        for (let i = 0; i < spaceRows.length; i += batchSize) {
          const chunk = spaceRows.slice(i, i + batchSize);
          const { error } = await this.supabase
            .schema('mews2')
            .from('spaces')
            .upsert(chunk, { onConflict: 'id' });

          if (error) throw error;
        }
      }

      this.stats.categories = categoryRows.length;
      this.stats.spaces = spaceRows.length;

      await this.emit('progress', {
        message: `   Imported ${categoryRows.length} categories and ${spaceRows.length} spaces`,
        emoji: '✅'
      });

      return { categoryCount: categoryRows.length, spaceCount: spaceRows.length };
    } catch (error) {
      console.error('Failed to import spaces:', error.response?.data?.Message || error.message);
      throw error;
    }
  }

  /**
   * Import reservations
   */
  async importReservations() {
    await this.emit('progress', { message: '🛏  Importing reservations...', emoji: '🛏' });

    const reservationToSpace = new Map();
    const startUtc = new Date(`${this.from}T00:00:00Z`);
    const endUtc = new Date(`${this.to}T23:59:59Z`);

    const fetchStart = new Date(startUtc);
    fetchStart.setDate(fetchStart.getDate() - this.reservationLeadDays);
    const fetchEnd = new Date(endUtc);
    fetchEnd.setDate(fetchEnd.getDate() + this.reservationLeadDays);

    let cursor = new Date(fetchStart);
    let imported = 0;

    while (cursor <= fetchEnd) {
      const batchStart = new Date(cursor);
      const batchEnd = new Date(cursor);
      batchEnd.setDate(batchEnd.getDate() + this.reservationBatchDays);
      if (batchEnd > fetchEnd) batchEnd.setTime(fetchEnd.getTime());

      try {
        const response = await axios.post(
          `${this.mewsApiUrl}/api/connector/v1/reservations/getAll`,
          {
            ClientToken: this.mewsClientToken,
            AccessToken: this.mewsAccessToken,
            Client: 'Tri-Logis Import',
            ServiceIds: [this.mewsServiceId],
            StartUtc: batchStart.toISOString(),
            EndUtc: batchEnd.toISOString(),
            Extent: {
              Reservations: true
            }
          }
        );

        const reservations = response.data.Reservations || [];
        if (reservations.length) {
          const rows = reservations.map(res => {
            if (res.Id && res.AssignedResourceId) {
              reservationToSpace.set(res.Id, res.AssignedResourceId);
            }
            return {
              id: res.Id,
              state: res.State,
              start_utc: res.StartUtc || null,
              end_utc: res.EndUtc || null,
              created_utc: res.CreatedUtc || null,
              updated_utc: res.UpdatedUtc || null,
              assigned_space_id: res.AssignedResourceId || null,
              customer_id: res.CustomerId || res.AccountId || null,
              company_id: res.CompanyId || null,
              total_amount: null,
              currency_code: res.Currency || 'CAD',
              synced_at: new Date().toISOString()
            };
          });

          // Insert in batches
          const batchSize = 500;
          for (let i = 0; i < rows.length; i += batchSize) {
            const chunk = rows.slice(i, i + batchSize);
            const { error } = await this.supabase
              .schema('mews2')
              .from('reservations')
              .upsert(chunk, { onConflict: 'id' });

            if (error) throw error;
          }

          imported += reservations.length;
          await this.emit('progress', {
            message: `   ${batchStart.toISOString().slice(0, 10)} → ${batchEnd.toISOString().slice(0, 10)}: ${reservations.length} reservations`,
            emoji: '📊'
          });
        }
      } catch (error) {
        console.error('Reservation batch failed:', error.response?.data?.Message || error.message);
        this.stats.errors++;
      }

      cursor.setDate(cursor.getDate() + this.reservationBatchDays);
      await this.sleep(250);
    }

    this.stats.reservations = imported;
    await this.emit('progress', {
      message: `   Total reservations imported: ${imported}`,
      emoji: '✅'
    });

    return reservationToSpace;
  }

  /**
   * Normalize accounting item
   */
  normalizeAccountingItem(item, reservationToSpace) {
    const consumedDate = this.toEasternDate(
      item.ConsumptionUtc || item.ConsumedUtc || item.ClosedUtc || item.CreatedUtc
    );

    if (!consumedDate) {
      return null;
    }

    const reservationIdRaw = item.ServiceOrderId || item.OrderId || null;
    const reservationId = reservationToSpace.has(reservationIdRaw) ? reservationIdRaw : null;
    const spaceId = reservationId
      ? reservationToSpace.get(reservationId) || null
      : item.ResourceId || null;
    const amount = item.Amount?.NetValue ?? item.Amount?.Value ?? 0;
    const normalizedType = item.Type === 'ServiceRevenue' ? 'SpaceOrder' : item.Type;
    const canceledUtc = item.CanceledUtc || item.CancelledUtc || null;

    return {
      id: item.Id,
      consumed_utc: item.ConsumptionUtc || item.ConsumedUtc || item.ClosedUtc || null,
      consumed_date: consumedDate,
      order_id: item.OrderId || null,
      reservation_id: reservationId,
      space_id: spaceId,
      amount,
      currency_code: item.Amount?.Currency || 'CAD',
      type: normalizedType,
      sub_type: item.SubType || null,
      accounting_state: item.State || null,
      canceled_utc: canceledUtc,
      created_at: item.CreatedUtc || new Date().toISOString(),
      updated_at: item.UpdatedUtc || item.CreatedUtc || new Date().toISOString()
    };
  }

  /**
   * Import accounting items
   */
  async importAccountingItems(reservationToSpace) {
    await this.emit('progress', { message: '💰 Importing accounting items...', emoji: '💰' });

    const startUtc = new Date(`${this.from}T00:00:00Z`);
    const endUtc = new Date(`${this.to}T23:59:59Z`);

    let cursor = new Date(startUtc);
    const stats = {
      batches: 0,
      received: 0,
      inserted: 0,
      skipped: 0
    };

    while (cursor <= endUtc) {
      const batchStart = new Date(cursor);
      const batchEnd = new Date(cursor);
      batchEnd.setDate(batchEnd.getDate() + this.batchDays);
      if (batchEnd > endUtc) batchEnd.setTime(endUtc.getTime());

      try {
        const response = await axios.post(
          `${this.mewsApiUrl}/api/connector/v1/accountingItems/getAll`,
          {
            ClientToken: this.mewsClientToken,
            AccessToken: this.mewsAccessToken,
            Client: 'Tri-Logis Import',
            ServiceIds: [this.mewsServiceId],
            StartUtc: batchStart.toISOString(),
            EndUtc: batchEnd.toISOString(),
            States: ['Closed', 'Open'],
            Types: ['ServiceRevenue', 'ProductRevenue', 'AdditionalRevenue']
          }
        );

        const items = response.data.AccountingItems || [];
        stats.received += items.length;

        const normalized = items
          .map(item => this.normalizeAccountingItem(item, reservationToSpace))
          .filter(Boolean);

        stats.skipped += items.length - normalized.length;

        if (normalized.length > 0) {
          const batchSize = 500;
          for (let i = 0; i < normalized.length; i += batchSize) {
            const chunk = normalized.slice(i, i + batchSize);
            const { error, count } = await this.supabase
              .schema('mews2')
              .from('accounting_items')
              .upsert(chunk, { onConflict: 'id', count: 'exact' });

            if (error) {
              console.error('Upsert error:', error.message);
              this.stats.errors++;
            } else {
              stats.inserted += count || chunk.length;
            }
          }
        }

        if (normalized.length > 0) {
          await this.emit('progress', {
            message: `   ${batchStart.toISOString().slice(0, 10)} → ${batchEnd.toISOString().slice(0, 10)}: ${normalized.length} items (${stats.inserted} total)`,
            emoji: '📊'
          });
        }
      } catch (error) {
        console.error('Accounting batch failed:', error.response?.data?.Message || error.message);
        this.stats.errors++;
      }

      stats.batches += 1;
      cursor.setDate(cursor.getDate() + this.batchDays);
      await this.sleep(250);
    }

    this.stats.accountingItems = stats.inserted;

    await this.emit('progress', {
      message: `   Received: ${stats.received}, inserted: ${stats.inserted}, skipped: ${stats.skipped}`,
      emoji: '✅'
    });

    return stats;
  }

  /**
   * Run the Mews sync process
   */
  async run() {
    try {
      await this.updateJobStatus('in_progress');
      await this.emit('progress', { message: '🚀 Starting Mews import...', emoji: '🚀' });
      await this.emit('progress', {
        message: `📅 Date range: ${this.from} → ${this.to}`,
        emoji: '📅'
      });

      // Truncate if requested
      if (this.truncate) {
        await this.truncateMews2Tables();
      }

      // Import space metadata
      await this.importSpaceMetadata();

      // Import reservations
      const reservationToSpace = await this.importReservations();

      // Import accounting items
      await this.importAccountingItems(reservationToSpace);

      // Complete
      await this.updateJobStatus('completed', this.stats);
      await this.emit('complete', { stats: this.stats });

      console.log('✅ Mews import completed successfully');
    } catch (error) {
      console.error('❌ Mews import failed:', error.message);
      await this.updateJobStatus('failed', null, error.message);
      await this.emit('error', { message: error.message });
      throw error;
    }
  }
}

module.exports = MewsSyncWorker;
