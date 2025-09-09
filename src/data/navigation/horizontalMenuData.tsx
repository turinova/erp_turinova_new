// Type Imports
import type { HorizontalMenuDataType } from '@/types/menuTypes'

const horizontalMenuData = (): HorizontalMenuDataType[] => [
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
  }
]

export default horizontalMenuData
