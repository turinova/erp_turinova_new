/**
 * Retry a function with exponential backoff
 * Specifically handles 429 (rate limit) errors with appropriate delays
 */

export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  retryableStatusCodes?: number[]
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 60 seconds
  backoffMultiplier: 2,
  retryableStatusCodes: [429, 500, 502, 503, 504] // Rate limit and server errors
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry (should return a Response or throw an error)
 * @param options Retry options
 * @returns Promise that resolves with the function's result
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any = null

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn()
      
      // If result is a Response, check status code
      if (result instanceof Response) {
        if (result.ok || !opts.retryableStatusCodes.includes(result.status)) {
          return result as T
        }
        
        // Retryable status code
        if (attempt < opts.maxRetries) {
          const delay = calculateDelay(attempt, opts)
          console.log(`[RETRY] Status ${result.status} on attempt ${attempt + 1}/${opts.maxRetries + 1}, retrying in ${delay}ms...`)
          await sleep(delay)
          continue
        }
        
        // Max retries reached
        throw new Error(`Request failed with status ${result.status} after ${opts.maxRetries + 1} attempts`)
      }
      
      // Non-Response result - return as-is
      return result
    } catch (error: any) {
      lastError = error
      
      // Check if error has a status code
      const statusCode = error.status || error.statusCode || (error.response?.status)
      
      // If it's a retryable status code and we haven't exceeded max retries
      if (statusCode && opts.retryableStatusCodes.includes(statusCode) && attempt < opts.maxRetries) {
        const delay = calculateDelay(attempt, opts)
        console.log(`[RETRY] Error ${statusCode} on attempt ${attempt + 1}/${opts.maxRetries + 1}, retrying in ${delay}ms...`)
        await sleep(delay)
        continue
      }
      
      // Not retryable or max retries reached
      throw error
    }
  }
  
  // Should never reach here, but TypeScript needs it
  throw lastError || new Error('Retry failed')
}

/**
 * Calculate delay for exponential backoff
 */
function calculateDelay(attempt: number, opts: Required<RetryOptions>): number {
  const delay = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt)
  return Math.min(delay, opts.maxDelayMs)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a fetch request with exponential backoff
 * Convenience wrapper for retryWithBackoff specifically for fetch calls
 */
export async function retryFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retryWithBackoff(
    () => fetch(url, options),
    {
      ...retryOptions,
      retryableStatusCodes: [429, 500, 502, 503, 504] // Focus on rate limit and server errors
    }
  )
}
