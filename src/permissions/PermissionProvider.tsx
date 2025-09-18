'use client'

import type { ReactNode } from 'react'
import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase'

interface PermissionContextType {
  allowedPaths: string[]
  canAccess: (path: string) => boolean
  reloadPermissions: (userId: string) => Promise<void>
  loading: boolean
  error: string | null
  // Pre-computed permissions for common pages
  pagePermissions: Record<string, boolean>
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

interface PermissionProviderProps {
  children: ReactNode
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

  // Check if user can access a path
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

  // Simple pre-computed permissions - only for the most common pages
  const pagePermissions = useMemo(() => {
    const commonPages = ['/home', '/users', '/materials', '/customers']
    const permissions: Record<string, boolean> = {}
    
    commonPages.forEach(page => {
      permissions[page] = allowedPaths.includes(normalizePath(page))
    })
    
    return permissions
  }, [allowedPaths, normalizePath])

  // Fetch permissions for a user - using useRef to avoid circular dependency
  const fetchUserPermissionsRef = useRef(async (userId: string): Promise<void> => {
    console.log('🚀 fetchUserPermissions called for user:', userId)
    try {
      if (!mountedRef.current) return
      
      setLoading(true)
      setError(null)

      // Use API endpoint to fetch permissions server-side
      const response = await fetch(`/api/permissions/user/${userId}`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch permissions')
      }

      const { paths } = await response.json()
      const normalizedPaths = paths?.map((path: string) => normalizePath(path)) || []
      
      if (!mountedRef.current) return
      
      console.log('🔧 About to set allowedPaths:', normalizedPaths)
      setAllowedPaths(normalizedPaths)
      setCurrentUserId(userId)
      console.log('🔧 setAllowedPaths called')

    } catch (err) {
      console.error('Error in fetchUserPermissions:', err)
      if (!mountedRef.current) return
      
      setError(err instanceof Error ? err.message : 'Unknown error')
      
      // Sign out user on permission fetch failure
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
  })

  // Update the ref when dependencies change
  useEffect(() => {
    fetchUserPermissionsRef.current = async (userId: string): Promise<void> => {
      console.log('🚀 fetchUserPermissions called for user:', userId)
      try {
        if (!mountedRef.current) return
        
        setLoading(true)
        setError(null)

        // Use API endpoint to fetch permissions server-side
        const response = await fetch(`/api/permissions/user/${userId}`)
        
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to fetch permissions')
        }

        const { paths } = await response.json()
        const normalizedPaths = paths?.map((path: string) => normalizePath(path)) || []
        
        if (!mountedRef.current) return
        
        console.log('🔧 About to set allowedPaths:', normalizedPaths)
        setAllowedPaths(normalizedPaths)
        setCurrentUserId(userId)
        console.log('🔧 setAllowedPaths called')

      } catch (err) {
        console.error('Error in fetchUserPermissions:', err)
        if (!mountedRef.current) return
        
        setError(err instanceof Error ? err.message : 'Unknown error')
        
        // Sign out user on permission fetch failure
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
    }
  }, [normalizePath, router])

  // Reload permissions for a specific user
  const reloadPermissions = useCallback(async (userId: string): Promise<void> => {
    await fetchUserPermissionsRef.current(userId)
  }, [])

  // Monitor when allowedPaths changes (reduced logging for performance)
  useEffect(() => {
    if (allowedPaths.length > 0) {
      console.log('✅ Permissions loaded successfully!', allowedPaths.length, 'pages')
    }
  }, [allowedPaths])

  // Monitor auth state changes
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

        // Only fetch if user changed
        if (session.user.id !== currentUserId) {
          await fetchUserPermissionsRef.current(session.user.id)
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

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return

      // Auth state changed

      if (event === 'SIGNED_OUT' || !session?.user?.id) {
        setAllowedPaths([])
        setCurrentUserId(null)
        setLoading(false)
        setError(null)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Only fetch if user changed
        if (session.user.id !== currentUserId) {
          await fetchUserPermissionsRef.current(session.user.id)
        }
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [currentUserId])

  const value: PermissionContextType = {
    allowedPaths,
    canAccess,
    reloadPermissions,
    loading,
    error,
    pagePermissions
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