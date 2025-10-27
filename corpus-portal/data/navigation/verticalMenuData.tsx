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
      label: 'Corpus',
      href: '/corpus',
      icon: 'ri-database-2-line',
    }
  ]
}

export default verticalMenuData
