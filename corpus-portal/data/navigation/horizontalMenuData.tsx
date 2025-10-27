// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'

const horizontalMenuData = (): HorizontalMenuDataType[] => {
  return [
    {
      label: 'Kezdőlap',
      href: '/home',
      icon: 'ri-home-smile-line'
    },
    {
      label: 'Corpus',
      href: '/corpus',
      icon: 'ri-database-2-line'
    }
  ]
}

export default horizontalMenuData
