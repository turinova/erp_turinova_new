'use client'

import { useMemo } from 'react'
import { usePermissions } from '@/permissions/PermissionProvider'

/**
 * Optimized hook for checking page permissions
 * Uses cached permissions with local checks (no API calls)
 */
export function usePagePermission(pagePath: string) {
  const { canAccess, loading } = usePermissions()
  
  // Use cached permissions with local check - no API calls
  const hasAccess = useMemo(() => {
    return canAccess(pagePath)
  }, [pagePath, canAccess])
  
  return {
    hasAccess,
    loading,
    isLoading: loading
  }
}

/**
 * Hook for checking multiple page permissions at once
 */
export function useMultiplePagePermissions(pagePaths: string[]) {
  const { canAccess, loading } = usePermissions()
  
  const permissions = useMemo(() => {
    const result: Record<string, boolean> = {}
    
    pagePaths.forEach(path => {
      result[path] = canAccess(path)
    })
    
    return result
  }, [pagePaths, canAccess])
  
  return {
    permissions,
    loading,
    isLoading: loading
  }
}
