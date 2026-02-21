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

// Global rate limiter instance (shared across all requests)
let globalRateLimiter: ShopRenterRateLimiter | null = null

/**
 * Get or create the global rate limiter instance
 */
export function getShopRenterRateLimiter(): ShopRenterRateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = new ShopRenterRateLimiter()
  }
  return globalRateLimiter
}
