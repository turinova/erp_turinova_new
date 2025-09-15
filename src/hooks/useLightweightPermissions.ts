'use client'

import { usePermissions } from '@/contexts/PermissionContext'

/**
 * Lightweight permission hook that uses session-cached permissions
 * Replaces the heavy useSimplePagePermissions and useDatabaseNavigation hooks
 */
export function useLightweightPermissions() {
  const { permissions, isAdmin, loading, hasPermission, refreshPermissions } = usePermissions()

  // Check if user can access a specific page
  const canAccessPage = (pagePath: string): boolean => {
    return hasPermission(pagePath, 'view')
  }

  // Check if user can edit a specific page
  const canEditPage = (pagePath: string): boolean => {
    return hasPermission(pagePath, 'edit')
  }

  // Check if user can delete on a specific page
  const canDeleteOnPage = (pagePath: string): boolean => {
    return hasPermission(pagePath, 'delete')
  }

  // Get all accessible pages for navigation
  const getAccessiblePages = (): string[] => {
    if (isAdmin) {
      // Admin has access to all pages
      return ['/home', '/company', '/customers', '/vat', '/users', '/opti']
    }

    // Return pages the user has view access to
    return permissions
      .filter(p => p.can_view)
      .map(p => p.page_path)
  }

  return {
    permissions,
    isAdmin,
    loading,
    canAccessPage,
    canEditPage,
    canDeleteOnPage,
    getAccessiblePages,
    refreshPermissions
  }
}
