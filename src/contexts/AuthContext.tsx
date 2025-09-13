'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/supabase-js'
import type { PermissionMatrix } from '@/types/permission'

interface AuthContextType {
  user: User | null
  loading: boolean
  permissions: PermissionMatrix[]
  permissionsLoading: boolean
  signOut: () => Promise<void>
  hasPermission: (pagePath: string, permissionType: 'view' | 'edit' | 'delete') => boolean
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [permissions, setPermissions] = useState<PermissionMatrix[]>([])
  const [permissionsLoading, setPermissionsLoading] = useState(false)
  const supabase = createClientComponentClient()

  // Simplified - no complex permission fetching
  const refreshPermissions = async () => {
    // No-op for simple permission system
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      setLoading(false)
      
      // Don't fetch permissions on initial load for performance
      // They will be fetched when needed
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        
        if (session?.user) {
          // Simple permission system - no database calls needed
          setPermissions([])
        } else {
          setPermissions([])
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signOut = async () => {
    try {
      // Clear local state immediately
      setUser(null)
      setPermissions([])
      
      // Clear any cached data immediately
      if (typeof window !== 'undefined') {
        localStorage.clear()
        sessionStorage.clear()
        
        // Clear all cookies
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
      }
      
      // Then sign out from Supabase with scope: 'global' to clear all sessions
      await supabase.auth.signOut({ scope: 'global' })
      
      // Force redirect to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    } catch (error) {
      console.error('Error during sign out:', error)
      // Still clear local state even if Supabase signOut fails
      setUser(null)
      setPermissions([])
      
      // Force redirect to login even on error
      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }
  }

  const hasPermission = (pagePath: string, permissionType: 'view' | 'edit' | 'delete'): boolean => {
    if (!user) return false
    
    // If permissions are still loading or failed to load, allow access (fallback)
    if (permissionsLoading || permissions.length === 0) {
      return true
    }
    
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

  const value = {
    user,
    loading,
    permissions,
    permissionsLoading,
    signOut,
    hasPermission,
    refreshPermissions,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}