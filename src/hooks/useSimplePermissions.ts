import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Simple role-based permission system
interface UserRole {
  id: string
  name: string
  emailPattern: string
  permissions: string[]
}

const USER_ROLES: UserRole[] = [
  {
    id: 'admin',
    name: 'Admin',
    emailPattern: 'admin|turinova.hu',
    permissions: ['/home', '/company', '/customers', '/vat', '/users', '/opti', '/optimalizalo', '/brands', '/currencies', '/units', '/tablas-anyagok', '/szalas-anyagok', '/edge', '/opti-beallitasok']
  },
  {
    id: 'customer_manager',
    name: 'Ügyfélkezelő',
    emailPattern: 'customer|ugyfel',
    permissions: ['/home', '/customers', '/vat', '/brands', '/currencies', '/units']
  },
  {
    id: 'material_manager',
    name: 'Anyagkezelő',
    emailPattern: 'material|anyag',
    permissions: ['/home', '/tablas-anyagok', '/szalas-anyagok', '/edge', '/brands', '/currencies', '/units']
  },
  {
    id: 'optimizer',
    name: 'Optimalizáló',
    emailPattern: 'optimizer|opti',
    permissions: ['/home', '/opti', '/optimalizalo', '/opti-beallitasok', '/tablas-anyagok', '/szalas-anyagok', '/edge']
  },
  {
    id: 'basic_user',
    name: 'Alapfelhasználó',
    emailPattern: 'user|basic',
    permissions: ['/home']
  }
]

// Simple permission system - much faster than complex database queries
export function useSimplePermissions() {
  const { user } = useAuth()

  const permissions = useMemo(() => {
    if (!user?.email) {
      return { canViewCustomers: false, canViewUsers: false, canViewCompany: false }
    }

    // Simple role-based permissions based on email
    const email = user.email.toLowerCase()
    
    // Find user's role based on email pattern
    const userRole = USER_ROLES.find(role => {
      const pattern = new RegExp(role.emailPattern, 'i')
      return pattern.test(email)
    })
    
    // If no specific role found, default to basic user
    const effectiveRole = userRole || USER_ROLES[USER_ROLES.length - 1]
    
    return {
      canViewCustomers: effectiveRole.permissions.includes('/customers'),
      canViewUsers: effectiveRole.permissions.includes('/users'),
      canViewCompany: effectiveRole.permissions.includes('/company'),
      canViewBrands: effectiveRole.permissions.includes('/brands'),
      canViewVat: effectiveRole.permissions.includes('/vat'),
      canViewCurrencies: effectiveRole.permissions.includes('/currencies'),
      canViewUnits: effectiveRole.permissions.includes('/units'),
      canViewMaterials: effectiveRole.permissions.includes('/tablas-anyagok') || effectiveRole.permissions.includes('/szalas-anyagok') || effectiveRole.permissions.includes('/edge'),
      canViewOpti: effectiveRole.permissions.includes('/opti') || effectiveRole.permissions.includes('/optimalizalo') || effectiveRole.permissions.includes('/opti-beallitasok')
    }
  }, [user?.email])

  return permissions
}

// Simple permission check for a specific page
export function useSimplePermission(pagePath: string): boolean {
  const { user } = useAuth()

  const hasAccess = useMemo(() => {
    if (!user?.email) {
      return false
    }

    const email = user.email.toLowerCase()
    
    // Find user's role based on email pattern
    const userRole = USER_ROLES.find(role => {
      const pattern = new RegExp(role.emailPattern, 'i')
      return pattern.test(email)
    })
    
    // If no specific role found, default to basic user
    const effectiveRole = userRole || USER_ROLES[USER_ROLES.length - 1]
    
    // Check if user has permission for this page
    return effectiveRole.permissions.includes(pagePath)
  }, [user?.email, pagePath])

  return hasAccess
}
