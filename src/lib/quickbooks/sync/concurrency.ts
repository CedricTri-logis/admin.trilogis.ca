/**
 * Concurrency Control Utilities
 *
 * Helper functions for managing parallel operations
 */

import pLimit from 'p-limit'

export interface ProcessResult<T> {
  index: number
  item: any
  result: T
}

export interface ProcessError {
  index: number
  item: any
  error: Error
}

export interface ConcurrentResults<T> {
  results: ProcessResult<T>[]
  errors: ProcessError[]
}

/**
 * Process array of items in parallel batches with concurrency limit
 */
export async function processConcurrent<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency = 10
): Promise<PromiseSettledResult<R>[]> {
  const limit = pLimit(concurrency)

  const promises = items.map((item, index) =>
    limit(() => processor(item, index))
  )

  return Promise.allSettled(promises)
}

/**
 * Process array of items in parallel batches
 * Collects results and errors separately
 */
export async function processConcurrentWithResults<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  concurrency = 10,
  timeout = 600000 // 10 minutes
): Promise<ConcurrentResults<R>> {
  const limit = pLimit(concurrency)

  const promises = items.map((item, index) =>
    limit(async () => {
      // Add timeout wrapper
      return Promise.race([
        processor(item, index),
        new Promise<R>((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout after ${timeout}ms for item ${index}`)), timeout)
        )
      ])
    })
  )

  const settled = await Promise.allSettled(promises)

  const results: ProcessResult<R>[] = []
  const errors: ProcessError[] = []

  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      results.push({
        index,
        item: items[index],
        result: result.value
      })
    } else {
      errors.push({
        index,
        item: items[index],
        error: result.reason
      })
    }
  })

  return { results, errors }
}

/**
 * Chunk array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  baseDelay = 2000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      // Check if error is retryable
      const isRetryable =
        error.response?.status === 502 ||
        error.response?.status === 503 ||
        error.response?.status === 429 ||
        error.response?.status === 500 ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.message?.includes('timeout') ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('502 Bad Gateway')

      if (!isRetryable || i === maxRetries - 1) {
        throw error
      }

      // Exponential backoff with jitter (2s, 4s, 8s, 16s, 32s)
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 2000
      await sleep(delay)
    }
  }

  throw new Error('Max retries reached')
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Create a progress tracker
 */
export class ProgressTracker {
  private total: number
  private current: number
  private label: string
  private startTime: number

  constructor(total: number, label = 'Progress') {
    this.total = total
    this.current = 0
    this.label = label
    this.startTime = Date.now()
  }

  increment(amount = 1): void {
    this.current += amount
  }

  getProgress(): {
    current: number
    total: number
    percent: number
    elapsed: number
    rate: number
    eta: number
  } {
    const percent = Math.round((this.current / this.total) * 100)
    const elapsed = Math.round((Date.now() - this.startTime) / 1000)
    const rate = this.current / (elapsed || 1)
    const eta = Math.round((this.total - this.current) / (rate || 1))

    return {
      current: this.current,
      total: this.total,
      percent,
      elapsed,
      rate,
      eta
    }
  }
}
