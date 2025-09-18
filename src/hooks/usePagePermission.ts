'use client'

import { useMemo } from 'react'
import { usePermissions } from '@/permissions/PermissionProvider'

/**
 * Optimized hook for checking page permissions
 * Uses pre-computed permissions to avoid repeated calculations
 */
export function usePagePermission(pagePath: string) {
  const { canAccess, loading, pagePermissions } = usePermissions()
  
  // Use pre-computed permission if available, fallback to canAccess
  const hasAccess = useMemo(() => {
    return pagePermissions[pagePath] ?? canAccess(pagePath)
  }, [pagePath, pagePermissions, canAccess])
  
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
  const { canAccess, loading, pagePermissions } = usePermissions()
  
  const permissions = useMemo(() => {
    const result: Record<string, boolean> = {}
    
    pagePaths.forEach(path => {
      result[path] = pagePermissions[path] ?? canAccess(path)
    })
    
    return result
  }, [pagePaths, pagePermissions, canAccess])
  
  return {
    permissions,
    loading,
    isLoading: loading
  }
}
