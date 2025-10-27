'use client'

import { useMemo, useEffect, useState } from 'react'
import { usePermissions } from '@/permissions/PermissionProvider'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

// Navigation filtering using the new permission system
export function useNavigation() {
  const { canAccess, loading, allowedPaths } = usePermissions()
  const [isHydrated, setIsHydrated] = useState(false)

  // Track hydration to prevent SSR/client mismatch
  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const filteredMenu = useMemo(() => {
    // During SSR or before hydration, return empty menu to prevent mismatch
    if (!isHydrated) {
      return []
    }

    // During loading OR if permissions haven't been loaded yet, only show home page
    if (loading || allowedPaths.length === 0) {
      return [{
        label: 'Home',
        href: '/home',
        icon: 'ri-home-smile-line',
        iconColor: '#0B6E99'
      }]
    }

    const filterMenuItems = (items: VerticalMenuDataType[]): VerticalMenuDataType[] => {
      return items.filter(item => {
        // If item has children (submenu or section), filter children first
        if ('children' in item && item.children) {
          const filteredChildren = filterMenuItems(item.children)
          return filteredChildren.length > 0
        }
        
        // Check permission for this page (only for menu items with href)
        if ('href' in item && item.href) {
          // Always allow home, opti, saved, orders, search, and settings for customer portal
          if (item.href === '/home' || item.href === '/opti' || item.href === '/saved' || item.href === '/orders' || item.href === '/search' || item.href === '/settings') {
            return true
          }
          
          // Bypass permission check for customer-facing pages
          if (item.href === '/quotes') {
            return true
          }
          
          // Use cached permissions with local check - no API calls
          return canAccess(item.href)
        }
        
        return true // Show items without href
      }).map(item => {
        // If item has children, recursively filter them
        if ('children' in item && item.children) {
          return {
            ...item,
            children: filterMenuItems(item.children)
          }
        }
        return item
      })
    }

    return filterMenuItems(verticalMenuData())
  }, [canAccess, loading, isHydrated, allowedPaths])

  return filteredMenu
}
