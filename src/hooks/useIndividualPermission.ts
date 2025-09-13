import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface UserPagePermission {
  user_id: string
  page_id: string
  page_path: string
  page_name: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

// Hook for checking individual permissions for the current user
export function useIndividualPermission(pagePath: string, permissionType: 'view' | 'edit' | 'delete' = 'view'): boolean {
  const { user } = useAuth()
  const [hasPermission, setHasPermission] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkPermission = async () => {
      if (!user) {
        setHasPermission(false)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const response = await fetch(`/api/permissions/individual/user/${user.id}`)
        
        if (response.ok) {
          const data = await response.json()
          const permissions: UserPagePermission[] = data.permissions || []
          
          const permission = permissions.find(p => p.page_path === pagePath)
          
          if (permission) {
            switch (permissionType) {
              case 'view':
                setHasPermission(permission.can_view)
                break
              case 'edit':
                setHasPermission(permission.can_edit)
                break
              case 'delete':
                setHasPermission(permission.can_delete)
                break
              default:
                setHasPermission(false)
            }
          } else {
            // If no specific permission found, default to view access for most pages
            setHasPermission(permissionType === 'view')
          }
        } else {
          // If API fails, allow view access as fallback
          setHasPermission(permissionType === 'view')
        }
      } catch (error) {
        console.error('Error checking permission:', error)
        // If error, allow view access as fallback
        setHasPermission(permissionType === 'view')
      } finally {
        setLoading(false)
      }
    }

    checkPermission()
  }, [user?.id, pagePath, permissionType])

  return hasPermission
}

// Hook for getting all permissions for the current user
export function useCurrentUserPermissions() {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<UserPagePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPermissions = async () => {
      if (!user) {
        setPermissions([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/permissions/individual/user/${user.id}`)
        
        if (response.ok) {
          const data = await response.json()
          setPermissions(data.permissions || [])
        } else {
          setError('Failed to fetch permissions')
          setPermissions([])
        }
      } catch (error) {
        console.error('Error fetching permissions:', error)
        setError(error instanceof Error ? error.message : 'Unknown error')
        setPermissions([])
      } finally {
        setLoading(false)
      }
    }

    fetchPermissions()
  }, [user?.id])

  return { permissions, loading, error }
}
