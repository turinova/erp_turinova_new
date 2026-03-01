'use client'

import { useMemo } from 'react'
import verticalMenuData from '@/data/navigation/verticalMenuData'
import type { VerticalMenuDataType } from '@/types/menuTypes'

// Simple navigation hook - no permission system needed for admin portal
export function useNavigation() {
  const menu = useMemo(() => {
    return verticalMenuData()
  }, [])

  return menu
}
