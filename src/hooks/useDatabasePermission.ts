import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Database-based permission check - uses actual user_permissions table
export function useDatabasePermission(pagePath: string): boolean {
  const { user, loading: authLoading } = useAuth()
  const [hasAccess, setHasAccess] = useState<boolean>(true) // Default to true for loading

  useEffect(() => {
    const checkPermission = async () => {
      // Wait for auth to finish loading before checking permissions
      if (authLoading) {
        console.log('Auth still loading, waiting for user session...')
        return
      }

      if (!user?.id) {
        console.log('No user ID after auth loaded, denying access')
        setHasAccess(false)
        return
      }

      try {
        const response = await fetch(`/api/permissions/simple/user/${user.id}`)
        
        if (!response.ok) {
          console.error('Failed to fetch permissions')
          setHasAccess(false)
          return
        }

        const data = await response.json()
        const permissions = data.permissions || []
        
        console.log('Permission check for page:', pagePath)
        console.log('Available permissions:', permissions)
        
        // Find permission for this page
        const pagePermission = permissions.find((p: any) => p.page_path === pagePath)
        
        if (pagePermission) {
          console.log('Found permission for', pagePath, ':', pagePermission.can_access)
          setHasAccess(pagePermission.can_access)
        } else {
          // If no permission found, check if this is a critical page
          const criticalPages = ['/home', '/users']
          if (criticalPages.includes(pagePath)) {
            console.log('Critical page without permission:', pagePath, '- denying access')
            setHasAccess(false)
          } else {
            console.log('Non-critical page without permission:', pagePath, '- allowing access')
            setHasAccess(true)
          }
        }
      } catch (error) {
        console.error('Error checking permission:', error)
        setHasAccess(false)
      }
    }

    checkPermission()
  }, [user?.id, pagePath, authLoading])

  return hasAccess
}
