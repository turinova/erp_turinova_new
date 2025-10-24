'use client'

import { useMemo, useEffect, useState } from 'react'
import { usePermissions } from '@/contexts/PermissionContext'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

// Navigation filtering using the new permission system
export function useNavigation() {
  const { hasPermission, loading } = usePermissions()
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

    // During loading, only show home page
    if (loading) {
      return [{
        label: 'Kezdőlap',
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
          
          // Use new permission system
          return hasPermission(item.href)
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
  }, [hasPermission, loading, isHydrated])

  return filteredMenu
}
