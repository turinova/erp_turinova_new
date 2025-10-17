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
          // Always allow home
          if (item.href === '/home') {
            return true
          }
          
          // Bypass permission check for pages that don't use it (same as page-level bypass)
          if (item.href === '/materials' || item.href === '/media' || item.href === '/feetypes' || item.href === '/machines' || item.href === '/accessories' || item.href === '/quotes' || item.href === '/orders' || item.href === '/scanner' || item.href === '/search' || item.href === '/workers' || item.href === '/shoporder' || item.href === '/customer-orders' || item.href === '/supplier-orders') {
            return true // Temporarily bypass until permission system is fully activated
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
