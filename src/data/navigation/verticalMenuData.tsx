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
    label: 'Opti',
    href: '/opti',
    icon: 'ri-settings-3-line',
    iconColor: '#8E44AD' // Purple for optimization tools
  },
  {
    label: 'Ajánlatok',
    href: '/quotes',
    icon: 'ri-file-list-3-line',
    iconColor: '#E67E22' // Orange for quotes/proposals
  },
  {
    label: 'Megrendelések',
    href: '/orders',
    icon: 'ri-shopping-cart-2-line',
    iconColor: '#27AE60' // Green for orders
  },
  {
    label: 'Scanner',
    href: '/scanner',
    icon: 'ri-barcode-line',
    iconColor: '#3498DB' // Blue for scanner
  },
  {
    label: 'Törzsadatok',
    icon: 'ri-database-2-line',
    iconColor: '#2ECC71', // Green for master data
    children: [
      {
        label: 'Ügyfelek',
        href: '/customers'
      },
      {
        label: 'Gyártók',
        href: '/brands'
      },
      {
        label: 'Adónem',
        href: '/vat'
      },
      {
        label: 'Pénznem',
        href: '/currencies'
      },
      {
        label: 'Egységek',
        href: '/units'
      },
      {
        label: 'Táblás anyagok',
        href: '/materials'
      },
      {
        label: 'Szálas anyagok',
        href: '/linear-materials'
      },
      {
        label: 'Élzárók',
        href: '/edge'
      },
      {
        label: 'Beszállítók',
        href: '/partners'
      },
      {
        label: 'Media',
        href: '/media'
      },
      {
        label: 'Díj típusok',
        href: '/feetypes'
      },
      {
        label: 'Gépek',
        href: '/machines'
      },
      {
        label: 'Termékek',
        href: '/accessories'
      }
    ]
  },
  {
    label: 'Beállítások',
    icon: 'ri-settings-2-line',
    iconColor: '#8E44AD', // Purple for settings
    children: [
      {
        label: 'Cégadatok',
        href: '/company'
      },
      {
        label: 'Felhasználók',
        href: '/users'
      },
      {
        label: 'Opti beállítások',
        href: '/opti-beallitasok'
      }
    ]
  }
  ]
}

export default verticalMenuData
