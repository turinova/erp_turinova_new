// Advanced API caching system for performance optimization
// Provides in-memory caching with TTL and invalidation

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class ApiCache {
  private cache = new Map<string, CacheEntry<any>>()
  private defaultTTL = 5 * 60 * 1000 // 5 minutes

  // Set cache entry
  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  // Get cache entry
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      
return null
    }

    return entry.data
  }

  // Invalidate cache entry
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  // Invalidate all cache entries matching pattern
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern)

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
  }

  // Get cache stats
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Singleton instance
export const apiCache = new ApiCache()

// Cache key generators
export const cacheKeys = {
  users: () => 'users:all',
  user: (id: string) => `user:${id}`,
  customers: () => 'customers:all',
  customer: (id: string) => `customer:${id}`,
  brands: () => 'brands:all',
  brand: (id: string) => `brand:${id}`,
  units: () => 'units:all',
  unit: (id: string) => `unit:${id}`,
  currencies: () => 'currencies:all',
  currency: (id: string) => `currency:${id}`,
  vat: () => 'vat:all',
  permissions: (userId: string) => `permissions:${userId}`,
  adminCheck: (userId: string) => `admin:${userId}`,
}

// Cache TTL constants
export const cacheTTL = {
  short: 1 * 60 * 1000,    // 1 minute
  medium: 5 * 60 * 1000,    // 5 minutes
  long: 15 * 60 * 1000,    // 15 minutes
  veryLong: 60 * 60 * 1000, // 1 hour
}

// Utility function to wrap API calls with caching
export async function withCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = cacheTTL.medium
): Promise<T> {
  // Try to get from cache first
  const cached = apiCache.get<T>(key)

  if (cached) {
    console.log(`Cache hit for ${key}`)
    
return cached
  }

  // Fetch fresh data
  console.log(`Cache miss for ${key}, fetching fresh data`)
  const data = await fetchFn()
  
  // Cache the result
  apiCache.set(key, data, ttl)
  
  return data
}
