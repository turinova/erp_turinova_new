'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserPermission, PermissionCache, createPermissionCache, isPermissionCacheValid, hasPagePermission } from '@/lib/permissions'

interface PermissionContextType {
  permissions: UserPermission[]
  loading: boolean
  hasPermission: (pagePath: string) => boolean
  canAccess: (pagePath: string) => boolean  // Backward compatibility
  refreshPermissions: () => Promise<void>
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<UserPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [permissionCache, setPermissionCache] = useState<PermissionCache | null>(null)

  const loadPermissions = async () => {
    try {
      setLoading(true)
      
      // Check if we have a valid cache
      if (permissionCache && isPermissionCacheValid(permissionCache)) {
        setPermissions(permissionCache.permissions)
        setLoading(false)
        return
      }

      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (sessionError || !session?.user) {
        // This is normal when user is not logged in - don't log as error
        // No permissions when not authenticated
        const defaultPermissions: UserPermission[] = []
        setPermissions(defaultPermissions)
        setLoading(false)
        return
      }

      const user = session.user

      // Add timeout to RPC call to prevent infinite loading
      const PERMISSION_FETCH_TIMEOUT = 5000 // 5 seconds
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Permission fetch timeout')), PERMISSION_FETCH_TIMEOUT)
      })
      
      // Get user permissions directly from Supabase instead of API route
      const rpcPromise = supabase.rpc('get_user_permissions', {
        user_uuid: user.id
      })
      
      let data, error
      try {
        const result = await Promise.race([rpcPromise, timeoutPromise]) as any
        data = result.data
        error = result.error
      } catch (timeoutError) {
        console.error('Permission fetch timeout or error:', timeoutError)
        // No permissions on timeout (fail-closed)
        const defaultPermissions: UserPermission[] = []
        setPermissions(defaultPermissions)
        setLoading(false)
        return
      }

      if (error) {
        console.error('Error fetching user permissions:', error)
        // No permissions on error (fail-closed)
        const defaultPermissions: UserPermission[] = []
        setPermissions(defaultPermissions)
        setLoading(false)
        return
      }

      if (!data || data.length === 0) {
        console.log('No permissions data returned from RPC')
        // No permissions when no data found
        const defaultPermissions: UserPermission[] = []
        setPermissions(defaultPermissions)
        setLoading(false)
        return
      }

      const userPermissions: UserPermission[] = data.map((p: any) => ({
        page_path: p.page_path,
        can_access: p.can_access
      }))
      
      // Create new cache
      const newCache = createPermissionCache(userPermissions)
      setPermissionCache(newCache)
      setPermissions(userPermissions)
      
    } catch (error) {
      console.error('Error loading permissions:', error)
      // No permissions on error (fail-closed)
      const defaultPermissions: UserPermission[] = []
      setPermissions(defaultPermissions)
    } finally {
      setLoading(false)
    }
  }

  const hasPermission = (pagePath: string): boolean => {
    return hasPagePermission(pagePath, permissions)
  }

  const canAccess = (pagePath: string): boolean => {
    return hasPagePermission(pagePath, permissions)
  }

  const refreshPermissions = async () => {
    setPermissionCache(null) // Clear cache to force reload
    await loadPermissions()
  }

  useEffect(() => {
    loadPermissions()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        loadPermissions()
      } else if (event === 'SIGNED_OUT') {
        // No permissions when signed out
        const defaultPermissions: UserPermission[] = []
        setPermissions(defaultPermissions)
        setPermissionCache(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const value: PermissionContextType = {
    permissions,
    loading,
    hasPermission,
    canAccess,
    refreshPermissions,
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
