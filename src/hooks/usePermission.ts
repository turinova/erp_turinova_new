import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface PermissionCheck {
  hasAccess: boolean
  loading: boolean
  error: string | null
}

export function usePermission(pagePath: string): PermissionCheck {
  const { user, permissions, permissionsLoading } = useAuth()

  const permissionCheck = useMemo(() => {
    if (!user?.id) {
      return { hasAccess: false, loading: false, error: null }
    }

    if (permissionsLoading) {
      return { hasAccess: false, loading: true, error: null }
    }

    // Check if user has permission for this page
    const permission = permissions.find((perm: any) => {
      const permPagePath = perm.pages?.path || perm.page_path
      return permPagePath === pagePath
    })

    return {
      hasAccess: permission ? permission.can_view : true, // Default to true if no explicit permission
      loading: false,
      error: null
    }
  }, [user?.id, permissions, permissionsLoading, pagePath])

  return permissionCheck
}
