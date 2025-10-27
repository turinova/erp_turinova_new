// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

const verticalMenuData = (): VerticalMenuDataType[] => {
  return [
    {
      label: 'Kezdőlap',
      href: '/home',
      icon: 'ri-home-line',
    },
    {
      label: 'Cégek',
      href: '/companies',
      icon: 'ri-building-line',
    }
  ]
}

export default verticalMenuData
