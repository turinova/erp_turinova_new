'use client'

import type { ReactNode } from 'react'
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

interface PermissionContextType {
  allowedPaths: string[]
  canAccess: (path: string) => boolean
  reloadPermissions: (userId: string) => Promise<void>
  loading: boolean
  error: string | null
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

interface PermissionProviderProps {
  children: ReactNode
}

// Extract the existing permission SQL/logic into a single function (reuse existing query from API)
async function fetchAllowedPaths(userId: string): Promise<string[]> {
  
  try {
    // Reuse the same query logic from the existing API endpoint
    // This eliminates the need for HTTP calls and uses direct Supabase client
    const { data, error } = await supabase
      .from('user_permissions')
      .select(`
        can_view,
        pages!inner(path)
      `)
      .eq('user_id', userId)
      .eq('can_view', true)

    if (error) {
      console.error('Error fetching permissions directly:', error)
      return [] // Return empty permissions on error
    }

    const paths = data?.map((item: any) => item.pages.path) || []
    
    
    return paths
  } catch (error) {
    console.error('Error in fetchAllowedPaths:', error)
    return [] // Return empty permissions on exception
  }
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const [allowedPaths, setAllowedPaths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const router = useRouter()
  const mountedRef = useRef(true)

  // Normalize path for comparison
  const normalizePath = useCallback((path: string): string => {
    // Ensure leading slash and remove trailing slash
    const normalized = path.startsWith('/') ? path : `/${path}`
    return normalized.endsWith('/') && normalized !== '/' ? normalized.slice(0, -1) : normalized
  }, [])

  // Check if user can access a path (CLIENT-ONLY - NO API CALL)
  const canAccess = useCallback((path: string): boolean => {
    const normalizedPath = normalizePath(path)
    
    // Check for exact match
    if (allowedPaths.includes(normalizedPath)) {
      return true
    }
    
    // Check for parent prefix match (e.g., /materials/123/edit matches /materials)
    return allowedPaths.some(allowedPath => {
      const normalizedAllowed = normalizePath(allowedPath)
      return normalizedPath.startsWith(normalizedAllowed + '/') || normalizedPath === normalizedAllowed
    })
  }, [allowedPaths, normalizePath])

  // Load permissions ONCE on login/session change and cache them
  const loadUserPermissions = useCallback(async (userId: string): Promise<void> => {
    if (!mountedRef.current) return
    
    setLoading(true)
    setError(null)

    try {
      // Call fetchAllowedPaths ONCE and cache the result
      const paths = await fetchAllowedPaths(userId)
      const normalizedPaths = paths.map(path => normalizePath(path))
      
      if (!mountedRef.current) return
      
      setAllowedPaths(normalizedPaths)
      setCurrentUserId(userId)

    } catch (err) {
      console.error('Error loading user permissions:', err)
      if (!mountedRef.current) return
      
      setError(err instanceof Error ? err.message : 'Unknown error')
      
      // Don't sign out user on permission fetch failure during page refresh
      // Only sign out if it's a persistent error (not a temporary network issue)
      if (err instanceof Error && err.message.includes('Failed to fetch')) {
        // Network error - don't sign out, just set loading to false
        if (mountedRef.current) {
          setLoading(false)
        }
        return
      }
      
      // Only sign out on persistent errors
      try {
        await supabase.auth.signOut()
        router.push('/login')
      } catch (signOutError) {
        console.error('Error signing out user:', signOutError)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [normalizePath, router])

  // Reload permissions for a specific user (on demand)
  const reloadPermissions = useCallback(async (userId: string): Promise<void> => {
    await loadUserPermissions(userId)
  }, [loadUserPermissions])

  // Monitor auth state changes - fetch permissions ONCE on login/session detection
  useEffect(() => {
    mountedRef.current = true

    const initializePermissions = async () => {
      try {
        // Get initial session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Error getting session:', sessionError)
          if (mountedRef.current) {
            setError('Session error')
            setLoading(false)
          }
          return
        }

        if (!session?.user?.id) {
          if (mountedRef.current) {
            setAllowedPaths([])
            setCurrentUserId(null)
            setLoading(false)
            setError(null)
          }
          return
        }

        // Only fetch if user changed - CACHE PERMISSIONS ONCE
        if (session.user.id !== currentUserId) {
          await loadUserPermissions(session.user.id)
        } else if (mountedRef.current) {
          setLoading(false)
        }
      } catch (err) {
        console.error('Error initializing permissions:', err)
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unknown error')
          setLoading(false)
        }
      }
    }

    initializePermissions()

    // Listen for auth state changes - fetch permissions ONCE on login
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return

      if (event === 'SIGNED_OUT' || !session?.user?.id) {
        setAllowedPaths([])
        setCurrentUserId(null)
        setLoading(false)
        setError(null)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Only fetch if user changed - CACHE PERMISSIONS ONCE
        if (session.user.id !== currentUserId) {
          await loadUserPermissions(session.user.id)
        }
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [currentUserId, loadUserPermissions])

  const value: PermissionContextType = {
    allowedPaths,
    canAccess,
    reloadPermissions,
    loading,
    error
  }

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermissions(): PermissionContextType {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionProvider')
  }
  return context
}