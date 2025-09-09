// Type Imports
import type { VerticalMenuDataType } from '@/types/menuTypes'

const verticalMenuData = (): VerticalMenuDataType[] => [
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
    label: 'Test',
    href: '/optitest/test',
    icon: 'ri-bug-line',
    iconColor: '#FF6B6B' // Red for debugging
  }
]

export default verticalMenuData
