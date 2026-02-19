// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

const verticalMenuData = (): VerticalMenuDataType[] => {
  // Force re-evaluation on every call
  return [
    {
      label: 'Kezdőlap',
      href: '/home',
      icon: 'ri-home-smile-line',
      // Notion-inspired colors for menu icons
      iconColor: '#0B6E99' // Blue for home/dashboard
    },
    {
      label: 'Törzsadatok',
      icon: 'ri-database-2-line',
      iconColor: '#27AE60', // Green for master data
      children: [
        {
          label: 'Termékek',
          href: '/products'
        }
      ]
    },
    {
      label: 'Beállítások',
      icon: 'ri-settings-2-line',
      iconColor: '#8E44AD', // Purple for settings
      children: [
        {
          label: 'Felhasználók',
          href: '/users'
        },
        {
          label: 'Kapcsolatok',
          href: '/connections'
        }
      ]
    }
  ]
}

export default verticalMenuData
