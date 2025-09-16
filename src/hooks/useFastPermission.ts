import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'

// Super fast permission check - no database calls
export function useFastPermission(pagePath: string): boolean {
  const { user } = useAuth()

  const hasAccess = useMemo(() => {
    if (!user?.email) {
      return false
    }

    const email = user.email.toLowerCase()
    
    // Super simple rules - no database calls
    const isAdmin = email.includes('admin') || email.includes('turinova.hu')
    const isCustomer = email.includes('customer') || email.includes('ugyfel')
    const isMaterial = email.includes('material') || email.includes('anyag')
    const isOptimizer = email.includes('optimizer') || email.includes('opti')
    
    // Super fast permission checks
    switch (pagePath) {
      case '/home':
        return true // Everyone can see home
      case '/customers':
        return isAdmin || isCustomer
      case '/users':
        return isAdmin
      case '/company':
        return isAdmin
      case '/brands':
      case '/vat':
      case '/currencies':
      case '/units':
        return isAdmin || isCustomer || isMaterial
      case '/tablas-anyagok':
      case '/szalas-anyagok':
      case '/edge':
        return isAdmin || isMaterial || isOptimizer
      case '/opti':
      case '/optimalizalo':
      case '/opti-beallitasok':
        return isAdmin || isOptimizer
      default:
        return true // Allow access to other pages
    }
  }, [user?.email, pagePath])

  return hasAccess
}
