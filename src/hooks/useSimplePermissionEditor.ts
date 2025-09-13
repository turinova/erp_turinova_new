import { useState, useMemo } from 'react'
import type { User } from '@/types/user'

// Simple permission roles based on email patterns
export interface SimplePermissionRole {
  id: string
  name: string
  description: string
  emailPattern: string
  permissions: string[]
}

// Available permission roles
const PERMISSION_ROLES: SimplePermissionRole[] = [
  {
    id: 'admin',
    name: 'Admin',
    description: 'Teljes hozzáférés minden funkcióhoz',
    emailPattern: 'admin|turinova.hu',
    permissions: ['/home', '/company', '/customers', '/vat', '/users', '/opti', '/optimalizalo', '/brands', '/currencies', '/units', '/tablas-anyagok', '/szalas-anyagok', '/elzarok', '/opti-beallitasok']
  },
  {
    id: 'customer_manager',
    name: 'Ügyfélkezelő',
    description: 'Ügyfelek és kapcsolódó funkciók kezelése',
    emailPattern: 'customer|ugyfel',
    permissions: ['/home', '/customers', '/vat', '/brands', '/currencies', '/units']
  },
  {
    id: 'material_manager',
    name: 'Anyagkezelő',
    description: 'Anyagok és kapcsolódó funkciók kezelése',
    emailPattern: 'material|anyag',
    permissions: ['/home', '/tablas-anyagok', '/szalas-anyagok', '/elzarok', '/brands', '/currencies', '/units']
  },
  {
    id: 'optimizer',
    name: 'Optimalizáló',
    description: 'Optimalizáló eszköz használata',
    emailPattern: 'optimizer|opti',
    permissions: ['/home', '/opti', '/optimalizalo', '/opti-beallitasok', '/tablas-anyagok', '/szalas-anyagok', '/elzarok']
  },
  {
    id: 'basic_user',
    name: 'Alapfelhasználó',
    description: 'Csak alapvető funkciók',
    emailPattern: 'user|basic',
    permissions: ['/home']
  }
]

// Available pages
const AVAILABLE_PAGES = [
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
  { id: '13', path: '/elzarok', name: 'Elzárók', description: 'Elzárók kezelése', category: 'Anyagok' },
  { id: '14', path: '/opti-beallitasok', name: 'Opti beállítások', description: 'Optimalizáló beállítások', category: 'Eszközök' }
]

export interface SimplePermissionEditorState {
  selectedRole: string
  customPermissions: string[]
  isCustomMode: boolean
}

export function useSimplePermissionEditor(user: User | null) {
  const [state, setState] = useState<SimplePermissionEditorState>({
    selectedRole: '',
    customPermissions: [],
    isCustomMode: false
  })

  // Get current user's role based on email
  const currentUserRole = useMemo(() => {
    if (!user?.email) return null

    const email = user.email.toLowerCase()
    
    for (const role of PERMISSION_ROLES) {
      const pattern = new RegExp(role.emailPattern, 'i')
      if (pattern.test(email)) {
        return role
      }
    }
    
    return PERMISSION_ROLES[PERMISSION_ROLES.length - 1] // Default to basic user
  }, [user?.email])

  // Get current user's permissions
  const currentUserPermissions = useMemo(() => {
    if (!currentUserRole) return []
    return currentUserRole.permissions
  }, [currentUserRole])

  // Initialize state when user changes
  const initializeState = (user: User) => {
    const role = PERMISSION_ROLES.find(r => {
      const pattern = new RegExp(r.emailPattern, 'i')
      return pattern.test(user.email.toLowerCase())
    })
    
    setState({
      selectedRole: role?.id || 'basic_user',
      customPermissions: role?.permissions || ['/home'],
      isCustomMode: false
    })
  }

  // Update selected role
  const setSelectedRole = (roleId: string) => {
    const role = PERMISSION_ROLES.find(r => r.id === roleId)
    setState(prev => ({
      ...prev,
      selectedRole: roleId,
      customPermissions: role?.permissions || [],
      isCustomMode: false
    }))
  }

  // Toggle custom mode
  const setCustomMode = (isCustom: boolean) => {
    setState(prev => ({
      ...prev,
      isCustomMode: isCustom
    }))
  }

  // Update custom permissions
  const setCustomPermissions = (permissions: string[]) => {
    setState(prev => ({
      ...prev,
      customPermissions: permissions
    }))
  }

  // Toggle individual permission
  const togglePermission = (pagePath: string) => {
    setState(prev => {
      const permissions = prev.customPermissions.includes(pagePath)
        ? prev.customPermissions.filter(p => p !== pagePath)
        : [...prev.customPermissions, pagePath]
      
      return {
        ...prev,
        customPermissions: permissions
      }
    })
  }

  // Get effective permissions (role-based or custom)
  const getEffectivePermissions = () => {
    if (state.isCustomMode) {
      return state.customPermissions
    }
    
    const role = PERMISSION_ROLES.find(r => r.id === state.selectedRole)
    return role?.permissions || []
  }

  // Check if user has permission for a page
  const hasPermission = (pagePath: string) => {
    const effectivePermissions = getEffectivePermissions()
    return effectivePermissions.includes(pagePath)
  }

  // Save permissions by updating user email to include role pattern
  const savePermissions = async () => {
    if (!user) {
      return { success: false, message: 'Nincs kiválasztott felhasználó!' }
    }

    try {
      const effectivePermissions = getEffectivePermissions()
      const selectedRole = PERMISSION_ROLES.find(r => r.id === state.selectedRole)
      
      if (!selectedRole) {
        return { success: false, message: 'Érvénytelen szerepkör!' }
      }

      // Update user email to include role pattern
      // This is a simple approach - in production you'd want to store roles separately
      const currentEmail = user.email
      const emailParts = currentEmail.split('@')
      const localPart = emailParts[0]
      const domain = emailParts[1]
      
      // Remove existing role patterns
      const cleanLocalPart = localPart.replace(/\.(admin|customer|material|optimizer|user|basic)$/, '')
      
      // Add new role pattern
      const newEmail = `${cleanLocalPart}.${state.selectedRole}@${domain}`
      
      // Update user via API
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          // Keep other user data unchanged
          full_name: user.full_name,
          phone: user.phone,
          role: user.role,
          is_active: user.is_active
        })
      })

      if (response.ok) {
        console.log('Permissions saved successfully:', {
          userId: user.id,
          oldEmail: currentEmail,
          newEmail: newEmail,
          role: state.selectedRole,
          permissions: effectivePermissions,
          isCustom: state.isCustomMode
        })
        
        return { 
          success: true, 
          message: `Jogosultságok sikeresen mentve! Felhasználó szerepköre: ${selectedRole.name}` 
        }
      } else {
        const errorData = await response.json()
        return { success: false, message: errorData.error || 'Hiba a felhasználó frissítése során' }
      }
    } catch (error) {
      console.error('Error saving permissions:', error)
      return { success: false, message: 'Hiba a jogosultságok mentése során' }
    }
  }

  return {
    // State
    state,
    currentUserRole,
    currentUserPermissions,
    
    // Available data
    availableRoles: PERMISSION_ROLES,
    availablePages: AVAILABLE_PAGES,
    
    // Actions
    initializeState,
    setSelectedRole,
    setCustomMode,
    setCustomPermissions,
    togglePermission,
    getEffectivePermissions,
    hasPermission,
    savePermissions
  }
}
