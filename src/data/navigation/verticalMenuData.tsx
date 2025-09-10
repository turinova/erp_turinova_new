// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

const verticalMenuData = (): VerticalMenuDataType[] => {
  // Force re-evaluation on every call
  return [
  {
    label: 'Home',
    href: '/home',
    icon: 'ri-home-smile-line',
    // Notion-inspired colors for menu icons
    iconColor: '#0B6E99' // Blue for home/dashboard
  },
  {
    label: 'About',
    href: '/about',
    icon: 'ri-information-line',
    iconColor: '#9B9A97' // Gray for informational content
  },
  {
    label: 'Optimalizáló',
    href: '/optimalizalo',
    icon: 'ri-speed-up-line',
    iconColor: '#0F7B6C' // Green for optimization/success
  },
  {
    label: 'OptiTest',
    href: '/optitest',
    icon: 'ri-test-tube-line',
    iconColor: '#E67E22' // Orange for testing/experimentation
  },
  {
    label: 'Opti',
    href: '/opti',
    icon: 'ri-settings-3-line',
    iconColor: '#8E44AD' // Purple for optimization tools
  },
  {
    label: 'Törzsadatok',
    icon: 'ri-database-2-line',
    iconColor: '#2ECC71', // Green for master data
    children: [
      {
        label: 'Ügyfelek',
        href: '/customers'
      }
    ]
  }
  ]
}

export default verticalMenuData
