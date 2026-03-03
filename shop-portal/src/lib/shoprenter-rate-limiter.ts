/**
 * Rate limiter for ShopRenter API
 * Enforces maximum 3 requests per second (180 per minute) as per ShopRenter API documentation
 */
export class ShopRenterRateLimiter {
  private readonly maxRequestsPerSecond = 3
  private readonly minDelayMs = 1000 / this.maxRequestsPerSecond // ~333ms between requests
  private lastRequestTime = 0
  private pendingPromise: Promise<void> = Promise.resolve()

  /**
   * Execute a function with rate limiting
   * @param fn Function to execute
   * @returns Promise that resolves with the function's result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Chain the new request after the previous one
    this.pendingPromise = this.pendingPromise.then(async () => {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      // Wait if we need to respect rate limit
      if (timeSinceLastRequest < this.minDelayMs) {
        const waitTime = this.minDelayMs - timeSinceLastRequest
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }

      this.lastRequestTime = Date.now()
    })

    // Wait for our turn, then execute the function
    await this.pendingPromise
    return fn()
  }

  /**
   * Get current queue length (always 0 for this implementation)
   */
  getQueueLength(): number {
    return 0
  }

  /**
   * Clear the queue (no-op for this implementation)
   */
  clear(): void {
    // Reset the promise chain
    this.pendingPromise = Promise.resolve()
    this.lastRequestTime = 0
  }
}

// Tenant-specific rate limiters (one per tenant)
const tenantRateLimiters = new Map<string, ShopRenterRateLimiter>()

/**
 * Get or create a rate limiter instance for a specific tenant
 * Each tenant has its own rate limiter to prevent one tenant from blocking others
 * @param tenantId The tenant ID (UUID)
 * @returns ShopRenterRateLimiter instance for the tenant
 */
export function getShopRenterRateLimiter(tenantId?: string): ShopRenterRateLimiter {
  // If no tenant ID provided, use global fallback (backward compatibility)
  if (!tenantId) {
    // For backward compatibility, return a default limiter
    // In production, tenant ID should always be provided
    const defaultKey = 'default'
    if (!tenantRateLimiters.has(defaultKey)) {
      tenantRateLimiters.set(defaultKey, new ShopRenterRateLimiter())
    }
    return tenantRateLimiters.get(defaultKey)!
  }

  // Get or create tenant-specific limiter
  if (!tenantRateLimiters.has(tenantId)) {
    tenantRateLimiters.set(tenantId, new ShopRenterRateLimiter())
  }
  return tenantRateLimiters.get(tenantId)!
}

/**
 * Clear rate limiter for a specific tenant (useful for testing or cleanup)
 * @param tenantId The tenant ID (UUID)
 */
export function clearTenantRateLimiter(tenantId: string): void {
  tenantRateLimiters.delete(tenantId)
}
