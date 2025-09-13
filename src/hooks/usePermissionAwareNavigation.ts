import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

export function usePermissionAwareNavigation() {
  const { user, permissions, permissionsLoading } = useAuth()

  // Convert permissions to map for fast lookup
  const userPermissions = useMemo(() => {
    const permissionsMap: Record<string, boolean> = {}
    
    permissions.forEach((perm: any) => {
      const pagePath = perm.pages?.path || perm.page_path
      if (pagePath) {
        permissionsMap[pagePath] = perm.can_view
      }
    })
    
    return permissionsMap
  }, [permissions])

  // Filter menu items based on permissions
  const filteredMenuData = useMemo(() => {
    if (permissionsLoading || !user?.id) {
      return verticalMenuData()
    }

    const filterMenuItems = (items: VerticalMenuDataType[]): VerticalMenuDataType[] => {
      return items.filter(item => {
        // If item has children, filter children first
        if (item.children) {
          const filteredChildren = filterMenuItems(item.children)
          // Only show parent if it has visible children
          return filteredChildren.length > 0
        }
        
        // For leaf items, check permission
        if (item.href) {
          return userPermissions[item.href] !== false
        }
        
        // Show items without href (like section headers)
        return true
      }).map(item => ({
        ...item,
        children: item.children ? filterMenuItems(item.children) : undefined
      }))
    }

    return filterMenuItems(verticalMenuData())
  }, [userPermissions, permissionsLoading, user?.id])

  return filteredMenuData
}
