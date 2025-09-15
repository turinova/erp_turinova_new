import { useMemo, useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLightweightPermissions } from './useLightweightPermissions'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

// Lightweight navigation filtering using session-cached permissions
export function useDatabaseNavigation() {
  const { user } = useAuth()
  const { canAccessPage, isAdmin, loading } = useLightweightPermissions()
  const [isHydrated, setIsHydrated] = useState(false)

  // Track hydration to prevent SSR/client mismatch
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const filteredMenu = useMemo(() => {
    // During SSR or before hydration, return empty menu to prevent mismatch
    if (!isHydrated || !user || loading) {
      return []
    }

    const filterMenuItems = (items: VerticalMenuDataType[]): VerticalMenuDataType[] => {
      return items.filter(item => {
        // If item has children, filter children first
        if (item.children) {
          const filteredChildren = filterMenuItems(item.children)
          return filteredChildren.length > 0
        }
        
        // Check permission for this page
        if (item.href) {
          // Always allow home
          if (item.href === '/home') return true
          
          // Admin has access to everything
          if (isAdmin) return true
          
          // Check user's specific permissions
          return canAccessPage(item.href)
        }
        
        return true // Show items without href
      }).map(item => ({
        ...item,
        children: item.children ? filterMenuItems(item.children) : undefined
      }))
    }

    return filterMenuItems(verticalMenuData())
  }, [user?.id, canAccessPage, isAdmin, loading])

  return filteredMenu
}