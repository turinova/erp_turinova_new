'use client'

import { useMemo, useEffect, useState } from 'react'
import { usePermissions } from '@/contexts/PermissionContext'
import { useBufferCount } from '@/hooks/useBufferCount'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

function injectBufferCount(items: VerticalMenuDataType[], count: number): VerticalMenuDataType[] {
  return items.map(item => {
    if ('href' in item && item.href === '/orders/buffer') {
      return {
        ...item,
        suffix: { label: String(count), size: 'small' as const, color: 'error' as const }
      }
    }
    if ('children' in item && item.children) {
      return { ...item, children: injectBufferCount(item.children, count) }
    }
    return item
  })
}

// Navigation filtering using the new permission system
export function useNavigation() {
  const { hasPermission, loading } = usePermissions()
  const [isHydrated, setIsHydrated] = useState(false)
  const bufferCount = useBufferCount()

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  const filteredMenu = useMemo(() => {
    if (!isHydrated || loading) return []

    const filterMenuItems = (items: VerticalMenuDataType[]): VerticalMenuDataType[] => {
      return items.filter(item => {
        if ('children' in item && item.children) {
          const filteredChildren = filterMenuItems(item.children)
          return filteredChildren.length > 0
        }
        if ('href' in item && item.href) {
          return hasPermission(item.href)
        }
        return true
      }).map(item => {
        if ('children' in item && item.children) {
          return { ...item, children: filterMenuItems(item.children) }
        }
        return item
      })
    }

    return injectBufferCount(filterMenuItems(verticalMenuData()), bufferCount)
  }, [hasPermission, loading, isHydrated, bufferCount])

  return filteredMenu
}
