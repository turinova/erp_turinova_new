import { useState, useEffect, useCallback } from 'react'

// Ultra-optimized data fetching hook with built-in caching
export function useUltraOptimizedData<T>(
  endpoint: string,
  options: {
    enabled?: boolean
    refetchOnMount?: boolean
    staleTime?: number
  } = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)

  const {
    enabled = true,
    refetchOnMount = true,
    staleTime = 5 * 60 * 1000 // 5 minutes default
  } = options

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return

    // Check if data is still fresh
    const now = Date.now()

    if (!force && data && (now - lastFetch) < staleTime) {
      console.log(`Using cached data for ${endpoint}`)
      
return
    }

    setLoading(true)
    setError(null)

    try {
      console.log(`Fetching fresh data from ${endpoint}`)
      const response = await fetch(endpoint)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      setData(result)
      setLastFetch(now)
      console.log(`Successfully fetched data from ${endpoint}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      console.error(`Error fetching ${endpoint}:`, errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [endpoint, enabled, data, lastFetch, staleTime])

  // Initial fetch
  useEffect(() => {
    if (refetchOnMount) {
      fetchData()
    }
  }, [fetchData, refetchOnMount])

  // Manual refetch function
  const refetch = useCallback(() => {
    fetchData(true)
  }, [fetchData])

  return {
    data,
    loading,
    error,
    refetch,
    isStale: data ? (Date.now() - lastFetch) > staleTime : true
  }
}

// Specific hooks for common data types
export function useUltraOptimizedUsers() {
  return useUltraOptimizedData('/api/users/ultra-optimized')
}

export function useUltraOptimizedCustomers() {
  return useUltraOptimizedData('/api/customers/ultra-optimized')
}

export function useUltraOptimizedBrands() {
  return useUltraOptimizedData('/api/brands/ultra-optimized')
}

export function useUltraOptimizedUnits() {
  return useUltraOptimizedData('/api/units/ultra-optimized')
}

export function useUltraOptimizedCurrencies() {
  return useUltraOptimizedData('/api/currencies/ultra-optimized')
}
