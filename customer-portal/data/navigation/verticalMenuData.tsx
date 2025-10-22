// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

const verticalMenuData = (): VerticalMenuDataType[] => {
  return [
    {
      label: 'Kezdőlap',
      href: '/home',
      icon: 'ri-home-smile-line',
      iconColor: '#0B6E99' // Blue for home/dashboard
    },
    {
      label: 'Opti',
      href: '/opti',
      icon: 'ri-dashboard-line',
      iconColor: '#27AE60' // Green for opti/optimization
    },
    {
      label: 'Mentések',
      href: '/saved',
      icon: 'ri-save-line',
      iconColor: '#F39C12' // Orange for saved quotes
    },
    {
      label: 'Megrendelések',
      href: '/orders',
      icon: 'ri-shopping-cart-line',
      iconColor: '#3498DB' // Blue for orders
    },
    {
      label: 'Kereső',
      href: '/search',
      icon: 'ri-search-line',
      iconColor: '#E74C3C' // Red for search
    },
    {
      label: 'Beállítások',
      href: '/settings',
      icon: 'ri-settings-3-line',
      iconColor: '#8E44AD' // Purple for settings
    }
  ]
}

export default verticalMenuData
