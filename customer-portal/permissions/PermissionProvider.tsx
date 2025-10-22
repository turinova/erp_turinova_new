'use client'

import type { ReactNode } from 'react'
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

import { supabase } from '@/lib/supabase-client'

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

// For customer portal, all authenticated users have access to all customer features
// No complex permission system needed
async function fetchAllowedPaths(userId: string): Promise<string[]> {
  // Customer portal: Grant access to all customer-facing pages
  return [
    '/home',
    '/opti',
    '/saved',
    '/orders',
    '/search',
    '/settings',
    '/quotes'
    // Add more customer-facing routes as needed
  ]
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  const [allowedPaths, setAllowedPaths] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Normalize path for comparison
  const normalizePath = useCallback((path: string): string => {
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
    
    // Check for parent prefix match
    return allowedPaths.some(allowedPath => {
      const normalizedAllowed = normalizePath(allowedPath)
      return normalizedPath.startsWith(normalizedAllowed + '/') || normalizedPath === normalizedAllowed
    })
  }, [allowedPaths, normalizePath])

  // Load permissions
  const loadUserPermissions = useCallback(async (userId: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      const paths = await fetchAllowedPaths(userId)
      const normalizedPaths = paths.map(path => normalizePath(path))
      
      setAllowedPaths(normalizedPaths)
    } catch (err) {
      console.error('Error loading permissions:', err)
      setError('Failed to load permissions')
      setAllowedPaths([])
    } finally {
      setLoading(false)
    }
  }, [normalizePath])

  const reloadPermissions = useCallback(async (userId: string): Promise<void> => {
    await loadUserPermissions(userId)
  }, [loadUserPermissions])

  // Load permissions when user logs in
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          await loadUserPermissions(session.user.id)
        } else {
          setAllowedPaths([])
          setLoading(false)
        }
      } catch (err) {
        console.error('Error checking session:', err)
        setAllowedPaths([])
        setLoading(false)
      }
    }

    checkUser()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserPermissions(session.user.id)
      } else {
        setAllowedPaths([])
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [loadUserPermissions])

  return (
    <PermissionContext.Provider 
      value={{ 
        allowedPaths, 
        canAccess, 
        reloadPermissions, 
        loading, 
        error 
      }}
    >
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
