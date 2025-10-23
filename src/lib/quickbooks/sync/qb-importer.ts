/**
 * QuickBooks Data Importer
 *
 * Main class for importing QuickBooks data to Supabase
 */

import axios, { AxiosError } from 'axios'
import { createSupabaseServiceRoleClient } from '@/lib/supabase/service-role-client'
import { QuickBooksRateLimiter } from './rate-limiter'
import { chunkArray, retryWithBackoff, sleep } from './concurrency'
import { ENTITY_PREPARERS, ENTITY_CONFIG, PreparedEntity } from './entity-preparers'
import { getAuthToken, refreshToken } from '../qb-service'
import type { QBAuthToken } from '../types'

export interface ImportOptions {
  startDate?: string
  endDate?: string
  entities?: string[]
  batchSize?: number
  chunkSize?: number
}

export interface ImportResult {
  entityType: string
  total: number
  imported: number
  errors: number
  elapsed?: number
  rate?: number
}

export interface BatchInfo {
  position: number
  size: number
}

export class QuickBooksImporter {
  private baseUrl: string
  private rateLimiter: QuickBooksRateLimiter
  private supabase: ReturnType<typeof createSupabaseServiceRoleClient>

  // Configuration
  private BATCH_SIZE = 1000
  private CHUNK_SIZE = 250  // Reduced to prevent Supabase 502s

  constructor(options: ImportOptions = {}) {
    this.baseUrl = process.env.QUICKBOOKS_ENVIRONMENT === 'production'
      ? 'https://quickbooks.api.intuit.com'
      : 'https://sandbox-quickbooks.api.intuit.com'

    this.rateLimiter = new QuickBooksRateLimiter({
      requestsPerSecond: 5,
      burstCapacity: 10,
      maxConcurrent: 6
    })

    this.supabase = createSupabaseServiceRoleClient()

    if (options.batchSize) this.BATCH_SIZE = options.batchSize
    if (options.chunkSize) this.CHUNK_SIZE = options.chunkSize
  }

  /**
   * Make a QuickBooks API request with rate limiting and retry
   */
  private async makeRequest(url: string, token: QBAuthToken, retries = 3): Promise<any> {
    return this.rateLimiter.schedule(async () => {
      return retryWithBackoff(async () => {
        try {
          const response = await axios.get(url, {
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Accept': 'application/json'
            },
            timeout: 60000
          })
          return response.data
        } catch (error: any) {
          // Handle 401 (expired token)
          if (error.response?.status === 401) {
            const refreshed = await refreshToken(token)
            if (!refreshed) {
              throw new Error('Failed to refresh token')
            }
            // Retry with new token
            const response = await axios.get(url, {
              headers: {
                'Authorization': `Bearer ${token.access_token}`,
                'Accept': 'application/json'
              },
              timeout: 60000
            })
            return response.data
          }
          throw error
        }
      }, retries)
    })
  }

  /**
   * Import QuickBooks CompanyInfo
   */
  async importCompanyInfo(token: QBAuthToken): Promise<ImportResult> {
    console.log(`[importCompanyInfo] Importing CompanyInfo for ${token.company_name}`)

    try {
      const url = `${this.baseUrl}/v3/company/${token.realm_id}/companyinfo/${token.realm_id}?minorversion=65`
      const response = await this.makeRequest(url, token)

      if (response && response.CompanyInfo) {
        const prepareFunc = ENTITY_PREPARERS.CompanyInfo
        const companyData = prepareFunc(response.CompanyInfo, token.realm_id)

        const { error } = await this.supabase
          .schema('quickbooks')
          .from('qb_companies')
          .upsert(companyData, {
            onConflict: 'realm_id',
            ignoreDuplicates: false
          })

        if (error) {
          console.error(`[importCompanyInfo] Error:`, error.message)
          return { entityType: 'CompanyInfo', total: 1, imported: 0, errors: 1 }
        }

        return { entityType: 'CompanyInfo', total: 1, imported: 1, errors: 0 }
      }

      return { entityType: 'CompanyInfo', total: 0, imported: 0, errors: 0 }
    } catch (error: any) {
      console.error(`[importCompanyInfo] Error:`, error.message)
      return { entityType: 'CompanyInfo', total: 1, imported: 0, errors: 1 }
    }
  }

  /**
   * Get total count for an entity
   */
  async getEntityCount(
    entityType: string,
    token: QBAuthToken,
    startDate?: string,
    endDate?: string
  ): Promise<number> {
    const config = ENTITY_CONFIG[entityType]
    if (!config) {
      throw new Error(`Unknown entity type: ${entityType}`)
    }

    const isTransactional = config.isTransactional
    const minorVersion = config.minorVersion || '65'

    let countQuery: string
    if (isTransactional && startDate && endDate) {
      countQuery = `SELECT COUNT(*) FROM ${entityType} WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}'`
    } else {
      countQuery = `SELECT COUNT(*) FROM ${entityType}`
    }

    const countUrl = `${this.baseUrl}/v3/company/${token.realm_id}/query?query=${encodeURIComponent(countQuery)}&minorversion=${minorVersion}`
    const countResponse = await this.makeRequest(countUrl, token)
    return countResponse.QueryResponse?.totalCount || 0
  }

  /**
   * Fetch a batch of entities
   */
  async fetchEntityBatch(
    entityType: string,
    token: QBAuthToken,
    batch: BatchInfo,
    startDate?: string,
    endDate?: string
  ): Promise<any[]> {
    const config = ENTITY_CONFIG[entityType]
    const isTransactional = config.isTransactional
    const minorVersion = config.minorVersion || '65'

    let dataQuery: string
    if (isTransactional && startDate && endDate) {
      dataQuery = `SELECT * FROM ${entityType} WHERE TxnDate >= '${startDate}' AND TxnDate <= '${endDate}' STARTPOSITION ${batch.position} MAXRESULTS ${batch.size}`
    } else {
      dataQuery = `SELECT * FROM ${entityType} STARTPOSITION ${batch.position} MAXRESULTS ${batch.size}`
    }

    const url = `${this.baseUrl}/v3/company/${token.realm_id}/query?query=${encodeURIComponent(dataQuery)}&minorversion=${minorVersion}`
    const response = await this.makeRequest(url, token)
    return response.QueryResponse?.[entityType] || []
  }

  /**
   * Import a single batch of entities
   */
  async importEntityBatch(
    entityType: string,
    entities: any[],
    token: QBAuthToken
  ): Promise<{ imported: number; errors: number }> {
    const config = ENTITY_CONFIG[entityType]
    const prepareFunc = ENTITY_PREPARERS[entityType]

    if (!prepareFunc) {
      throw new Error(`No preparer function for entity type: ${entityType}`)
    }

    // Prepare data
    const dataToInsert = entities.map(entity => prepareFunc(entity, token.realm_id))

    // Bulk insert in chunks
    const chunks = chunkArray(dataToInsert, this.CHUNK_SIZE)

    let imported = 0
    let errors = 0

    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
      const chunk = chunks[chunkIdx]

      // Retry database operations up to 3 times
      let success = false
      let lastError: any = null

      for (let retry = 0; retry < 3; retry++) {
        const { error } = await this.supabase
          .schema('quickbooks')
          .from(config.table)
          .upsert(chunk, {
            onConflict: 'realm_id,qb_id',
            ignoreDuplicates: false
          })

        if (!error) {
          success = true
          break
        }

        lastError = error

        // Only retry on network errors
        const isNetworkError = error.message?.includes('fetch failed') ||
                               error.message?.includes('ECONNRESET') ||
                               error.message?.includes('ETIMEDOUT')

        if (!isNetworkError || retry === 2) {
          break
        }

        // Wait before retry
        await sleep(1000 * Math.pow(2, retry))
      }

      if (success) {
        imported += chunk.length
      } else {
        console.error(`[importEntityBatch] ${entityType} DB error:`, lastError?.message)
        errors += chunk.length
      }

      // Small delay between chunks
      if (chunkIdx < chunks.length - 1) {
        await sleep(100)
      }
    }

    return { imported, errors }
  }

  /**
   * Import a single entity type
   */
  async importEntity(
    entityType: string,
    token: QBAuthToken,
    startDate?: string,
    endDate?: string
  ): Promise<ImportResult> {
    const startTime = Date.now()

    console.log(`[importEntity] Starting ${entityType} import`)

    // Get total count
    const totalCount = await this.getEntityCount(entityType, token, startDate, endDate)

    if (totalCount === 0) {
      console.log(`[importEntity] No ${entityType} records found`)
      return { entityType, total: 0, imported: 0, errors: 0 }
    }

    console.log(`[importEntity] Found ${totalCount} ${entityType} records`)

    // Generate batches
    const batches: BatchInfo[] = []
    for (let position = 1; position <= totalCount; position += this.BATCH_SIZE) {
      batches.push({ position, size: this.BATCH_SIZE })
    }

    let totalImported = 0
    let totalErrors = 0

    // Process batches sequentially (to respect Vercel timeout limits)
    for (const batch of batches) {
      console.log(`[importEntity] Processing ${entityType} batch ${batch.position}/${totalCount}`)

      const entities = await this.fetchEntityBatch(entityType, token, batch, startDate, endDate)

      if (entities.length > 0) {
        const { imported, errors } = await this.importEntityBatch(entityType, entities, token)
        totalImported += imported
        totalErrors += errors
      }
    }

    const elapsed = (Date.now() - startTime) / 1000
    const rate = totalImported / elapsed

    console.log(`[importEntity] Completed ${entityType}: ${totalImported}/${totalCount} in ${elapsed.toFixed(1)}s`)

    return {
      entityType,
      total: totalCount,
      imported: totalImported,
      errors: totalErrors,
      elapsed,
      rate
    }
  }

  /**
   * Get rate limiter stats
   */
  getStats() {
    return this.rateLimiter.getStats()
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.rateLimiter.stop()
  }
}
