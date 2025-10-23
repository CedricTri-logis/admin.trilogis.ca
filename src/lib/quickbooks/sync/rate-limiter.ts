/**
 * Rate Limiter for QuickBooks API
 *
 * QuickBooks API limits:
 * - 500 requests per minute per realm
 * - Recommended: 5-8 requests/second with burst capacity
 */

import Bottleneck from 'bottleneck'

export interface RateLimiterOptions {
  requestsPerSecond?: number
  burstCapacity?: number
  maxConcurrent?: number
}

export interface RateLimiterStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  rateLimitHits: number
  currentReservoir?: number
  queuedRequests?: number
}

export class QuickBooksRateLimiter {
  private limiter: Bottleneck
  private stats: {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    rateLimitHits: number
  }

  constructor(options: RateLimiterOptions = {}) {
    const {
      requestsPerSecond = 8,  // Increased from 5 (QB allows 500/min = 8.3/sec)
      burstCapacity = 20,     // Increased from 10
      maxConcurrent = 10      // Increased from 6
    } = options

    // Create rate limiter with token bucket algorithm
    this.limiter = new Bottleneck({
      reservoir: burstCapacity,           // Initial burst capacity
      reservoirRefreshAmount: requestsPerSecond, // Tokens added per interval
      reservoirRefreshInterval: 1000,     // Refresh every 1 second
      maxConcurrent: maxConcurrent,       // Max concurrent requests
      minTime: 1000 / requestsPerSecond   // Minimum time between requests
    })

    // Track stats
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitHits: 0
    }

    // Monitor reservoir level
    this.limiter.on('depleted', () => {
      this.stats.rateLimitHits++
    })

    this.limiter.on('done', (info) => {
      this.stats.totalRequests++
      if (info.error) {
        this.stats.failedRequests++
      } else {
        this.stats.successfulRequests++
      }
    })
  }

  /**
   * Schedule a request through the rate limiter
   */
  async schedule<T>(fn: () => Promise<T>): Promise<T> {
    return this.limiter.schedule(fn)
  }

  /**
   * Get current stats
   */
  getStats(): RateLimiterStats {
    return {
      ...this.stats,
      currentReservoir: this.limiter.counts().RECEIVED - this.limiter.counts().EXECUTING,
      queuedRequests: this.limiter.counts().QUEUED
    }
  }

  /**
   * Reset the limiter
   */
  async reset(): Promise<void> {
    await this.limiter.stop({ dropWaitingJobs: false })
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rateLimitHits: 0
    }
  }

  /**
   * Stop the limiter and clean up
   */
  async stop(): Promise<void> {
    if (this.limiter) {
      await this.limiter.stop({ dropWaitingJobs: false })
    }
  }
}
