import { useState, useEffect, useCallback } from 'react'

import { useApiCache } from './useApiCache'

interface EdgeMaterial {
  id: string
  brand_id: string
  type: string
  thickness: number
  width: number
  decor: string
  price: number
  vat_id: string
  created_at: string
  updated_at: string
  brands: {
    name: string
  }
  vat: {
    name: string
    kulcs: number
  }
}

interface Brand {
  id: string
  name: string
}

interface VatRate {
  id: string
  name: string
  kulcs: number
}

// Hook for fetching edge materials with caching
export function useEdgeMaterials() {
  const {
    data: edgeMaterials,
    isLoading,
    error,
    refresh,
    invalidateCache
  } = useApiCache<EdgeMaterial[]>('/api/edge-materials/optimized', {
    ttl: 15 * 60 * 1000, // 15 minutes cache
    staleWhileRevalidate: true
  })

  return {
    edgeMaterials: edgeMaterials || [],
    isLoading,
    error,
    refresh,
    invalidateCache
  }
}

// Hook for fetching individual edge material with caching
export function useEdgeMaterial(id: string) {
  const {
    data: edgeMaterial,
    isLoading,
    error,
    refresh,
    invalidateCache
  } = useApiCache<EdgeMaterial>(`/api/edge-materials/${id}/optimized`, {
    ttl: 30 * 60 * 1000, // 30 minutes cache
    staleWhileRevalidate: true
  })

  return {
    edgeMaterial,
    isLoading,
    error,
    refresh,
    invalidateCache
  }
}

// Hook for fetching brands with caching
export function useBrands() {
  const {
    data: brands,
    isLoading,
    error,
    refresh
  } = useApiCache<Brand[]>('/api/brands/ultra-optimized', {
    ttl: 60 * 60 * 1000, // 1 hour cache - brands don't change often
    staleWhileRevalidate: true
  })

  return {
    brands: brands || [],
    isLoading,
    error,
    refresh
  }
}

// Hook for fetching VAT rates with caching
export function useVatRates() {
  const {
    data: vatRates,
    isLoading,
    error,
    refresh
  } = useApiCache<VatRate[]>('/api/vat', {
    ttl: 60 * 60 * 1000, // 1 hour cache - VAT rates don't change often
    staleWhileRevalidate: true
  })

  return {
    vatRates: vatRates || [],
    isLoading,
    error,
    refresh
  }
}

// Hook for creating edge material with cache invalidation
export function useCreateEdgeMaterial() {
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createEdgeMaterial = useCallback(async (edgeMaterialData: Partial<EdgeMaterial>) => {
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/edge-materials/optimized', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(edgeMaterialData),
      })

      if (response.ok) {
        const result = await response.json()

        console.log('Create response:', result)
        
        // Invalidate cache to force refresh
        const { invalidateApiCache } = await import('./useApiCache')

        invalidateApiCache('/api/edge-materials/optimized')
        
        return result
      } else {
        const errorData = await response.json()

        console.error('Create error response:', errorData)
        throw new Error(errorData.message || 'Létrehozás sikertelen')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      setError(errorMessage)
      throw err
    } finally {
      setIsCreating(false)
    }
  }, [])

  return {
    createEdgeMaterial,
    isCreating,
    error
  }
}

// Hook for updating edge material with cache invalidation
export function useUpdateEdgeMaterial() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateEdgeMaterial = useCallback(async (id: string, edgeMaterialData: Partial<EdgeMaterial>) => {
    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`/api/edge-materials/${id}/optimized`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(edgeMaterialData),
      })

      if (response.ok) {
        const result = await response.json()

        console.log('Update response:', result)
        
        // Invalidate caches to force refresh
        const { invalidateApiCache } = await import('./useApiCache')

        invalidateApiCache(`/api/edge-materials/${id}/optimized`)
        invalidateApiCache('/api/edge-materials/optimized')
        
        return result
      } else {
        const errorData = await response.json()

        console.error('Update error response:', errorData)
        throw new Error(errorData.message || 'Mentés sikertelen')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      setError(errorMessage)
      throw err
    } finally {
      setIsUpdating(false)
    }
  }, [])

  return {
    updateEdgeMaterial,
    isUpdating,
    error
  }
}

// Hook for deleting edge material with cache invalidation
export function useDeleteEdgeMaterial() {
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deleteEdgeMaterial = useCallback(async (id: string) => {
    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/edge-materials/${id}/optimized`, {
        method: 'DELETE',
      })

      if (response.ok) {
        const result = await response.json()

        console.log('Delete response:', result)
        
        // Invalidate caches to force refresh
        const { invalidateApiCache } = await import('./useApiCache')

        invalidateApiCache(`/api/edge-materials/${id}/optimized`)
        invalidateApiCache('/api/edge-materials/optimized')
        
        return result
      } else {
        const errorData = await response.json()

        console.error('Delete error response:', errorData)
        throw new Error(errorData.message || 'Törlés sikertelen')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'

      setError(errorMessage)
      throw err
    } finally {
      setIsDeleting(false)
    }
  }, [])

  return {
    deleteEdgeMaterial,
    isDeleting,
    error
  }
}
