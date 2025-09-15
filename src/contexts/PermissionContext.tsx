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

  // Check if user is admin (first user in the system)
  const checkIfAdmin = async (userId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/permissions/check-admin/${userId}`)
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

  // Fetch user permissions (only once per session)
  const fetchPermissions = async () => {
    if (!user?.id) {
      setPermissions([])
      setIsAdmin(false)
      return
    }

    setLoading(true)
    try {
      // Check if user is admin first
      const adminStatus = await checkIfAdmin(user.id)
      setIsAdmin(adminStatus)

      if (adminStatus) {
        // Admin has access to all pages - no need to fetch from database
        setPermissions([])
        setLoading(false)
        return
      }

      // For regular users, fetch their specific permissions
      const response = await fetch(`/api/permissions/simple/user/${user.id}`)
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
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }

  // Check if user has permission for a specific page
  const hasPermission = (pagePath: string, permissionType: 'view' | 'edit' | 'delete' = 'view'): boolean => {
    // Admin has access to everything
    if (isAdmin) return true

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
    fetchPermissions()
  }, [user?.id])

  const value: PermissionContextType = {
    permissions,
    isAdmin,
    loading,
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
