'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useLightweightPermissions } from '@/hooks/useLightweightPermissions'

interface PermissionGuardProps {
  children: React.ReactNode
  requiredPage: string
  fallbackPath?: string
}

/**
 * Client-side permission guard that redirects users who don't have access
 * This replaces the middleware-based permission checking to avoid memory issues
 */
export function PermissionGuard({ 
  children, 
  requiredPage, 
  fallbackPath = '/home' 
}: PermissionGuardProps) {
  const { user } = useAuth()
  const { canAccessPage, isAdmin, loading } = useLightweightPermissions()
  const router = useRouter()

  useEffect(() => {
    // Don't redirect if still loading or no user
    if (loading || !user) return

    // Admin users have access to everything
    if (isAdmin) return

    // Check if user has access to the required page
    if (!canAccessPage(requiredPage)) {
      console.log(`Permission denied for ${requiredPage}, redirecting to ${fallbackPath}`)
      router.push(fallbackPath)
    }
  }, [user, canAccessPage, isAdmin, loading, requiredPage, fallbackPath, router])

  // Don't render children if user doesn't have permission
  if (!loading && user && !isAdmin && !canAccessPage(requiredPage)) {
    return null
  }

  return <>{children}</>
}
