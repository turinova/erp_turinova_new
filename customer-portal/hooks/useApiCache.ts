'use client'

import { useState, useEffect, useCallback } from 'react'

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

interface UseApiCacheOptions {
  ttl?: number // Cache time to live in milliseconds (default: 5 minutes)
  staleWhileRevalidate?: boolean // Return stale data while fetching fresh data
}

// Global cache store
const cache = new Map<string, CacheEntry<any>>()

export function useApiCache<T>(
  endpoint: string,
  options: UseApiCacheOptions = {}
) {
  const { ttl = 5 * 60 * 1000, staleWhileRevalidate = true } = options // Default 5 minutes TTL
  
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async (forceRefresh = false) => {
    const cacheKey = endpoint
    const cachedEntry = cache.get(cacheKey)
    const now = Date.now()

    // Check if we have valid cached data
    if (!forceRefresh && cachedEntry && (now - cachedEntry.timestamp) < cachedEntry.ttl) {
      setData(cachedEntry.data)
      setIsLoading(false)
      setError(null)
      
return cachedEntry.data
    }

    // If we have stale data and staleWhileRevalidate is enabled, return it immediately
    if (staleWhileRevalidate && cachedEntry) {
      setData(cachedEntry.data)
      setIsLoading(false)
      setError(null)
    } else {
      setIsLoading(true)
    }

    try {
      const response = await fetch(endpoint)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const freshData = await response.json()
      
      // Update cache
      cache.set(cacheKey, {
        data: freshData,
        timestamp: now,
        ttl
      })

      setData(freshData)
      setIsLoading(false)
      setError(null)
      
return freshData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      setError(errorMessage)
      setIsLoading(false)
      
      // If we have stale data and there's an error, keep showing it
      if (staleWhileRevalidate && cachedEntry) {
        setData(cachedEntry.data)
        setIsLoading(false)
      }
      
      throw err
    }
  }, [endpoint, ttl, staleWhileRevalidate])

  const invalidateCache = useCallback(() => {
    cache.delete(endpoint)
  }, [endpoint])

  const refresh = useCallback(() => {
    return fetchData(true)
  }, [fetchData])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
    isLoading,
    error,
    refresh,
    invalidateCache
  }
}

// Utility function to invalidate cache for specific endpoints
export function invalidateApiCache(endpoint: string) {
  cache.delete(endpoint)
}

// Utility function to invalidate all cache
export function clearApiCache() {
  cache.clear()
}

// Utility function to get cache stats
export function getCacheStats() {
  const now = Date.now()
  const entries = Array.from(cache.entries())
  
  return {
    totalEntries: entries.length,
    validEntries: entries.filter(([_, entry]) => (now - entry.timestamp) < entry.ttl).length,
    staleEntries: entries.filter(([_, entry]) => (now - entry.timestamp) >= entry.ttl).length,
    entries: entries.map(([key, entry]) => ({
      key,
      age: now - entry.timestamp,
      ttl: entry.ttl,
      isValid: (now - entry.timestamp) < entry.ttl
    }))
  }
}
