'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useAuth } from './AuthContext'

interface Permission {
  page_path: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

interface PermissionContextType {
  permissions: Permission[]
  isAdmin: boolean
  loading: boolean
  hasPermission: (pagePath: string, permissionType?: 'view' | 'edit' | 'delete') => boolean
  refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

interface PermissionProviderProps {
  children: ReactNode
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)

  // Check if user is admin (first user in the system)
  const checkIfAdmin = async (userId: string): Promise<boolean> => {
    try {
        const response = await fetch(`/api/permissions/check-admin/${userId}/optimized`)
      if (response.ok) {
        const data = await response.json()
        return data.isAdmin || false
      }
      return false
    } catch (error) {
      console.error('Error checking admin status:', error)
      return false
    }
  }

  // Fetch user permissions (only once per session) - Non-blocking
  const fetchPermissions = async () => {
    if (!user?.id) {
      setPermissions([])
      setIsAdmin(false)
      setPermissionsLoaded(true)
      return
    }

    // Don't set loading to true immediately - allow UI to render first
    try {
      // Check if user is admin first
      const adminStatus = await checkIfAdmin(user.id)
      setIsAdmin(adminStatus)

      if (adminStatus) {
        // Admin has access to all pages - no need to fetch from database
        setPermissions([])
        setPermissionsLoaded(true)
        return
      }

      // For regular users, fetch their specific permissions
      const response = await fetch(`/api/permissions/simple/user/${user.id}/optimized`)
      if (response.ok) {
        const data = await response.json()
        // Transform the simple permissions format to match our interface
        const transformedPermissions = data.permissions?.map((p: any) => ({
          page_path: p.page_path,
          can_view: p.can_access,
          can_edit: false, // Simple system only has view access
          can_delete: false // Simple system only has view access
        })) || []
        setPermissions(transformedPermissions)
      } else {
        setPermissions([])
      }
      setPermissionsLoaded(true)
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setPermissions([])
      setPermissionsLoaded(true)
    }
  }

  // Check if user has permission for a specific page
  const hasPermission = (pagePath: string, permissionType: 'view' | 'edit' | 'delete' = 'view'): boolean => {
    // Admin has access to everything
    if (isAdmin) return true

    // During loading, allow access to prevent blocking the login flow
    // This ensures users can access pages while permissions load in the background
    if (!permissionsLoaded) {
      return true
    }

    // Check user's specific permissions
    const permission = permissions.find(p => p.page_path === pagePath)
    if (!permission) return false

    switch (permissionType) {
      case 'view':
        return permission.can_view
      case 'edit':
        return permission.can_edit
      case 'delete':
        return permission.can_delete
      default:
        return false
    }
  }

  // Refresh permissions (useful for when permissions are updated)
  const refreshPermissions = async () => {
    await fetchPermissions()
  }

  // Fetch permissions when user changes
  useEffect(() => {
    const fetchUserPermissions = async () => {
      if (!user?.id) {
        setPermissions([])
        setIsAdmin(false)
        setPermissionsLoaded(true)
        return
      }

      try {
        // Check if user is admin first
        const adminStatus = await checkIfAdmin(user.id)
        setIsAdmin(adminStatus)

        if (adminStatus) {
          // Admin has access to all pages - no need to fetch from database
          setPermissions([])
          setPermissionsLoaded(true)
          return
        }

        // For regular users, fetch their specific permissions
        const response = await fetch(`/api/permissions/simple/user/${user.id}/optimized`)
        if (response.ok) {
          const data = await response.json()
          // Transform the simple permissions format to match our interface
          const transformedPermissions = data.permissions?.map((p: any) => ({
            page_path: p.page_path,
            can_view: p.can_access,
            can_edit: false, // Simple system only has view access
            can_delete: false // Simple system only has view access
          })) || []
          setPermissions(transformedPermissions)
        } else {
          setPermissions([])
        }
        setPermissionsLoaded(true)
      } catch (error) {
        console.error('Error fetching permissions:', error)
        setPermissions([])
        setPermissionsLoaded(true)
      }
    }

    // Reset permissions loaded state when user changes
    setPermissionsLoaded(false)
    fetchUserPermissions()
  }, [user?.id]) // Only depend on user.id to prevent infinite loops

  const value: PermissionContextType = {
    permissions,
    isAdmin,
    loading: !permissionsLoaded, // Loading is true until permissions are loaded
    hasPermission,
    refreshPermissions
  }

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions() {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}
