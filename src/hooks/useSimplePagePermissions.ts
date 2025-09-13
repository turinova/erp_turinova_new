import { useState, useEffect } from 'react'
import type { User } from '@/types/user'

interface SimplePagePermission {
  user_id: string
  page_path: string
  can_access: boolean
}

interface SimplePermissionState {
  permissions: SimplePagePermission[]
  pages: Page[]
  loading: boolean
  error: string | null
}

// Page interface
interface Page {
  id: string
  path: string
  name: string
  description?: string
  category?: string
  is_active: boolean
}

export function useSimplePagePermissions(user: User | null) {
  const [state, setState] = useState<SimplePermissionState>({
    permissions: [],
    pages: [],
    loading: false,
    error: null
  })

  // Fetch user's simple permissions
  const fetchPermissions = async () => {
    if (!user) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      // Fetch pages first
      const pagesResponse = await fetch('/api/pages')
      if (!pagesResponse.ok) {
        throw new Error('Failed to fetch pages')
      }
      const pagesData = await pagesResponse.json()
      const pages = pagesData.pages || []

      // Then fetch user permissions
      const permissionsResponse = await fetch(`/api/permissions/simple/user/${user.id}`)
      if (!permissionsResponse.ok) {
        throw new Error('Failed to fetch permissions')
      }
      const permissionsData = await permissionsResponse.json()
      
      // Initialize permissions for all pages if none exist
      const existingPermissions = permissionsData.permissions || []
      const allPermissions: SimplePagePermission[] = pages.map((page: Page) => {
        const existing = existingPermissions.find((p: any) => p.page_path === page.path)
        return {
          user_id: user.id,
          page_path: page.path,
          can_access: existing?.can_access ?? true // Default to true for new users
        }
      })

      setState({
        permissions: allPermissions,
        pages: pages,
        loading: false,
        error: null
      })
    } catch (error) {
      console.error('Error fetching permissions:', error)
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }

  // Save permissions
  const savePermissions = async (permissions: SimplePagePermission[]) => {
    if (!user) return { success: false, message: 'No user selected' }

    try {
      const response = await fetch(`/api/permissions/simple/user/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save permissions')
      }

      // Update local state
      setState(prev => ({ ...prev, permissions }))
      
      return { success: true, message: 'Permissions saved successfully' }
    } catch (error) {
      console.error('Error saving permissions:', error)
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      }
    }
  }

  // Toggle access for a specific page
  const toggleAccess = (pagePath: string) => {
    setState(prev => ({
      ...prev,
      permissions: prev.permissions.map(permission => 
        permission.page_path === pagePath 
          ? { ...permission, can_access: !permission.can_access }
          : permission
      )
    }))
  }

  // Get permission for a specific page
  const getPermission = (pagePath: string): SimplePagePermission | undefined => {
    return state.permissions.find(p => p.page_path === pagePath)
  }

  // Check if user has access to a page
  const hasAccess = (pagePath: string): boolean => {
    const permission = getPermission(pagePath)
    return permission ? permission.can_access : true // Default to true if no permission found
  }

  // Initialize permissions when user changes
  useEffect(() => {
    if (user) {
      fetchPermissions()
    } else {
      setState({ permissions: [], pages: [], loading: false, error: null })
    }
  }, [user?.id])

  return {
    // State
    permissions: state.permissions,
    pages: state.pages,
    loading: state.loading,
    error: state.error,
    availablePages: state.pages,
    
    // Actions
    fetchPermissions,
    savePermissions,
    toggleAccess,
    
    // Getters
    getPermission,
    hasAccess
  }
}
