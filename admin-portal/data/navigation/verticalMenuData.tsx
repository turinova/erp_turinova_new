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
      label: 'Ügyfelek',
      href: '/tenants',
      icon: 'ri-building-line',
    },
    {
      label: 'Előfizetési tervek',
      href: '/subscription-plans',
      icon: 'ri-vip-card-line',
    }
  ]
}

export default verticalMenuData
