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
        },
        {
          label: 'Kategóriák',
          href: '/categories'
        },
        {
          label: 'Áfák',
          href: '/vat'
        },
        {
          label: 'Mértékegységek',
          href: '/units'
        },
        {
          label: 'Gyártók',
          href: '/manufacturers'
        },
        {
          label: 'Súlymértékek',
          href: '/weight-units'
        },
        {
          label: 'Beszállítók',
          href: '/suppliers'
        },
        {
          label: 'Fizetési módok',
          href: '/payment-methods'
        },
        {
          label: 'Pénznemek',
          href: '/currencies'
        },
        {
          label: 'Raktárak',
          href: '/warehouses'
        }
      ]
    },
    {
      label: 'Árazás',
      icon: 'ri-price-tag-3-line',
      iconColor: '#E74C3C', // Red for pricing
      children: [
        {
          label: 'Vevőcsoportok',
          href: '/customer-groups'
        },
        {
          label: 'Akciók',
          href: '/promotions'
        }
      ]
    },
    {
      label: 'Beszerzés',
      icon: 'ri-shopping-cart-2-line',
      iconColor: '#3498DB', // Blue for purchasing
      children: [
        {
          label: 'Beszerzési rendelések',
          href: '/purchase-orders'
        },
        {
          label: 'Szállítmányok',
          href: '/shipments'
        },
        {
          label: 'Készlet',
          href: '/stock'
        }
      ]
    },
    {
      label: 'SEO',
      icon: 'ri-line-chart-line',
      iconColor: '#E67E22', // Orange for SEO/analytics
      children: [
        {
          label: 'Dashboard',
          href: '/competitors/dashboard'
        },
        {
          label: 'Versenytársak',
          href: '/competitors'
        },
        {
          label: 'Linkek kezelése',
          href: '/competitors/links'
        }
      ]
    },
    {
      label: 'Beállítások',
      icon: 'ri-settings-2-line',
      iconColor: '#8E44AD', // Purple for settings
      children: [
        {
          label: 'Előfizetésem',
          href: '/subscription'
        },
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
