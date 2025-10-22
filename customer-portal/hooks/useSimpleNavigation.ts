import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

// Simple navigation filtering - much faster than database queries
export function useSimpleNavigation() {
  const { user } = useAuth()

  const filteredMenuData = useMemo(() => {
    if (!user?.email) {
      return verticalMenuData()
    }

    const email = user.email.toLowerCase()
    const isAdmin = email.includes('admin') || email.includes('turinova.hu')
    
    const filterMenuItems = (items: VerticalMenuDataType[]): VerticalMenuDataType[] => {
      return items.filter(item => {
        // If item has children, filter children first
        if (item.children) {
          const filteredChildren = filterMenuItems(item.children)
          return filteredChildren.length > 0
        }
        
        // Simple permission checks based on page path
        if (item.href) {
          switch (item.href) {
            case '/customers':
              return isAdmin || email.includes('customer')
            case '/users':
              return isAdmin
            case '/company':
              return isAdmin
            case '/brands':
              return isAdmin
            case '/vat':
              return isAdmin
            case '/currencies':
              return isAdmin
            case '/units':
              return isAdmin
            case '/materials':
            case '/linear-materials':
            case '/edge':
            case '/media':
            case '/feetypes':
            case '/machines':
            case '/accessories':
              return isAdmin
            case '/opti':
            case '/optimalizalo':
            case '/quotes':
            case '/orders':
            case '/opti-settings':
              return isAdmin
            default:
              return true // Allow access to other pages
          }
        }
        
        return true // Show items without href
      }).map(item => ({
        ...item,
        children: item.children ? filterMenuItems(item.children) : undefined
      }))
    }

    return filterMenuItems(verticalMenuData())
  }, [user?.email])

  return filteredMenuData
}
