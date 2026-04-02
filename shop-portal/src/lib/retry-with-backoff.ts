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

/** Exported for tests / call sites that need the same delay helper */
export { sleep }

/**
 * True for timeouts, dropped TLS/TCP, and undici "fetch failed" (Vercel ↔ Supabase / ShopRenter).
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (error == null) return false
  const err = error as { name?: string; code?: number | string; message?: string; cause?: unknown }
  const name = err.name || ''
  const code = err.code
  let message = String(err.message || error)
  const cause = err.cause as { message?: string; code?: string } | undefined
  if (cause?.message) message += ` ${cause.message}`
  if (cause?.code) message += ` ${cause.code}`
  if (name === 'TimeoutError' || code === 23 || code === 'ETIMEDOUT') return true
  if (/fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket|other side closed|UND_ERR|ENOTFOUND|network/i.test(message)) {
    return true
  }
  return false
}

/**
 * Supabase PostgREST client often returns { error: { message: 'TypeError: fetch failed', ... } } without throwing.
 */
export function isTransientSupabaseClientError(error: { message?: string; details?: string } | null | undefined): boolean {
  if (!error) return false
  const m = `${error.message || ''} ${error.details || ''}`
  return /fetch failed|ECONNRESET|other side closed|timeout|ETIMEDOUT|socket|ECONNREFUSED|NetworkError/i.test(m)
}

export interface RetryTransientOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

/**
 * Retry an async operation when it throws a transient network error (timeouts, connection resets).
 */
export async function retryTransientAsync<T>(
  fn: () => Promise<T>,
  options: RetryTransientOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 4
  let delay = options.initialDelayMs ?? 400
  const maxDelay = options.maxDelayMs ?? 20000
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e
      if (attempt === maxRetries || !isTransientNetworkError(e)) {
        throw e
      }
      const wait = Math.min(delay, maxDelay)
      console.warn(`[RETRY] Transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${wait}ms:`, e instanceof Error ? e.message : e)
      await sleep(wait)
      delay = Math.min(delay * 2, maxDelay)
    }
  }
  throw lastError
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
