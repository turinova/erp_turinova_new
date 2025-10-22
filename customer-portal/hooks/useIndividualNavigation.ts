import { useMemo } from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { useCurrentUserPermissions } from './useIndividualPermission'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

// Navigation filtering based on individual user permissions
export function useIndividualNavigation() {
  const { user } = useAuth()
  const { permissions, loading } = useCurrentUserPermissions()

  const filteredMenuData = useMemo(() => {
    if (!user || loading) {
      return verticalMenuData()
    }

    const filterMenuItems = (items: VerticalMenuDataType[]): VerticalMenuDataType[] => {
      return items.filter(item => {
        // If item has children, filter children first
        if (item.children) {
          const filteredChildren = filterMenuItems(item.children)

          
return filteredChildren.length > 0
        }
        
        // Check individual permissions for page access
        if (item.href) {
          const permission = permissions.find(p => p.page_path === item.href)
          
          if (permission) {
            // User has specific permissions for this page
            return permission.can_view
          } else {
            // No specific permission found, allow access to home and basic pages
            switch (item.href) {
              case '/home':
                return true // Always allow home
              default:
                return true // Allow access by default (fallback)
            }
          }
        }
        
        return true // Show items without href
      }).map(item => ({
        ...item,
        children: item.children ? filterMenuItems(item.children) : undefined
      }))
    }

    return filterMenuItems(verticalMenuData())
  }, [user?.id, permissions, loading])

  return filteredMenuData
}
