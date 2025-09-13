import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Database-based permission check - uses actual user_permissions table
export function useDatabasePermission(pagePath: string): boolean {
  const { user } = useAuth()
  const [hasAccess, setHasAccess] = useState<boolean>(true) // Default to true for loading
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkPermission = async () => {
      if (!user?.id) {
        setHasAccess(false)
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/permissions/simple/user/${user.id}`)
        
        if (!response.ok) {
          console.error('Failed to fetch permissions')
          setHasAccess(false)
          setLoading(false)
          return
        }

        const data = await response.json()
        const permissions = data.permissions || []
        
        // Find permission for this page
        const pagePermission = permissions.find((p: any) => p.page_path === pagePath)
        
        if (pagePermission) {
          setHasAccess(pagePermission.can_access)
        } else {
          // If no permission found, default to true (allow access)
          setHasAccess(true)
        }
      } catch (error) {
        console.error('Error checking permission:', error)
        setHasAccess(false)
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [user?.id, pagePath])

  return hasAccess
}
