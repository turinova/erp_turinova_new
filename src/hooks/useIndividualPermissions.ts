import { useState, useEffect } from 'react'
import type { User } from '@/types/user'
import type { Page } from '@/types/permission'

interface UserPagePermission {
  user_id: string
  page_id: string
  page_path: string
  page_name: string
  can_view: boolean
  can_edit: boolean
  can_delete: boolean
}

interface IndividualPermissionState {
  permissions: UserPagePermission[]
  loading: boolean
  error: string | null
}

// All available pages in the system
const ALL_PAGES: Page[] = [
  { id: '1', path: '/home', name: 'Főoldal', description: 'Rendszer főoldala', category: 'Általános' },
  { id: '2', path: '/company', name: 'Cégadatok', description: 'Cégadatok kezelése', category: 'Törzsadatok' },
  { id: '3', path: '/customers', name: 'Ügyfelek', description: 'Ügyfelek kezelése', category: 'Törzsadatok' },
  { id: '4', path: '/vat', name: 'Adónemek', description: 'Adónemek kezelése', category: 'Törzsadatok' },
  { id: '5', path: '/users', name: 'Felhasználók', description: 'Felhasználók kezelése', category: 'Rendszer' },
  { id: '6', path: '/opti', name: 'Optimalizáló', description: 'Optimalizáló eszköz', category: 'Eszközök' },
  { id: '7', path: '/optimalizalo', name: 'Optimalizáló', description: 'Optimalizáló eszköz', category: 'Eszközök' },
  { id: '8', path: '/brands', name: 'Márkák', description: 'Márkák kezelése', category: 'Törzsadatok' },
  { id: '9', path: '/currencies', name: 'Pénznemek', description: 'Pénznemek kezelése', category: 'Törzsadatok' },
  { id: '10', path: '/units', name: 'Mértékegységek', description: 'Mértékegységek kezelése', category: 'Törzsadatok' },
  { id: '11', path: '/tablas-anyagok', name: 'Táblás anyagok', description: 'Táblás anyagok kezelése', category: 'Anyagok' },
  { id: '12', path: '/szalas-anyagok', name: 'Szálas anyagok', description: 'Szálas anyagok kezelése', category: 'Anyagok' },
  { id: '13', path: '/edge', name: 'Elzárók', description: 'Elzárók kezelése', category: 'Anyagok' },
  { id: '14', path: '/opti-beallitasok', name: 'Opti beállítások', description: 'Optimalizáló beállítások', category: 'Eszközök' }
]

export function useIndividualPermissions(user: User | null) {
  const [state, setState] = useState<IndividualPermissionState>({
    permissions: [],
    loading: false,
    error: null
  })

  // Fetch user's individual permissions
  const fetchPermissions = async () => {
    if (!user) return

    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(`/api/permissions/individual/user/${user.id}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch permissions')
      }

      const data = await response.json()
      
      // Initialize permissions for all pages if none exist
      const existingPermissions = data.permissions || []
      const allPermissions: UserPagePermission[] = ALL_PAGES.map(page => {
        const existing = existingPermissions.find((p: any) => p.page_path === page.path)
        return {
          user_id: user.id,
          page_id: page.id,
          page_path: page.path,
          page_name: page.name,
          can_view: existing?.can_view ?? true, // Default to true for new users
          can_edit: existing?.can_edit ?? false,
          can_delete: existing?.can_delete ?? false
        }
      })

      setState({
        permissions: allPermissions,
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
  const savePermissions = async (permissions: UserPagePermission[]) => {
    if (!user) return { success: false, message: 'No user selected' }

    try {
      const response = await fetch(`/api/permissions/individual/user/${user.id}`, {
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

  // Toggle a specific permission
  const togglePermission = (pagePath: string, permissionType: 'view' | 'edit' | 'delete') => {
    setState(prev => ({
      ...prev,
      permissions: prev.permissions.map(permission => 
        permission.page_path === pagePath 
          ? { ...permission, [`can_${permissionType}`]: !permission[`can_${permissionType}` as keyof UserPagePermission] }
          : permission
      )
    }))
  }

  // Get permission for a specific page
  const getPermission = (pagePath: string): UserPagePermission | undefined => {
    return state.permissions.find(p => p.page_path === pagePath)
  }

  // Check if user has a specific permission
  const hasPermission = (pagePath: string, permissionType: 'view' | 'edit' | 'delete'): boolean => {
    const permission = getPermission(pagePath)
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

  // Initialize permissions when user changes
  useEffect(() => {
    if (user) {
      fetchPermissions()
    } else {
      setState({ permissions: [], loading: false, error: null })
    }
  }, [user?.id])

  return {
    // State
    permissions: state.permissions,
    loading: state.loading,
    error: state.error,
    availablePages: ALL_PAGES,
    
    // Actions
    fetchPermissions,
    savePermissions,
    togglePermission,
    
    // Getters
    getPermission,
    hasPermission
  }
}
