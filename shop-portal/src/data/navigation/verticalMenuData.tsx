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
      label: 'Rendelés puffer',
      href: '/orders/buffer',
      icon: 'ri-inbox-line',
      iconColor: '#16A085'
    },
    {
      label: 'Rendelések',
      icon: 'ri-shopping-bag-line',
      iconColor: '#16A085', // Teal for orders
      children: [
        {
          label: 'Rendelések',
          href: '/orders'
        },
        {
          label: 'Begyűjtések',
          href: '/pick-batches'
        },
        {
          label: 'Csomagolás',
          href: '/pack'
        },
        {
          label: 'Átadás',
          href: '/dispatch'
        }
      ]
    },
    {
      label: 'Beszerzés',
      icon: 'ri-shopping-cart-2-line',
      iconColor: '#3498DB', // Blue for purchasing
      children: [
        {
          label: 'Beszerzési várólista',
          href: '/replenishment'
        },
        {
          label: 'Beszerzési rendelések',
          href: '/purchase-orders'
        },
        {
          label: 'Szállítmányok',
          href: '/shipments'
        },
        {
          label: 'Beszállítók',
          href: '/suppliers'
        }
      ]
    },
    {
      label: 'Termékadatbázis',
      icon: 'ri-archive-2-line',
      iconColor: '#27AE60',
      children: [
        { label: 'Termékek', href: '/products' },
        { label: 'Kategóriák', href: '/categories' },
        { label: 'Gyártók', href: '/manufacturers' }
      ]
    },
    {
      label: 'Vevők',
      icon: 'ri-user-line',
      iconColor: '#9B59B6', // Purple for customers
      children: [
        {
          label: 'Személyek',
          href: '/customers/persons'
        },
        {
          label: 'Cégek',
          href: '/customers/companies'
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
      label: 'Pénzügy',
      icon: 'ri-bank-line',
      iconColor: '#0B6E99',
      children: [
        {
          label: 'Kimenő számlák',
          href: '/finance/outgoing-invoices'
        }
      ]
    },
    {
      label: 'Raktár',
      icon: 'ri-archive-line',
      iconColor: '#D35400', // Orange for warehouse
      children: [
        {
          label: 'Műveletek',
          href: '/warehouse-operations'
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
      label: 'Törzsadatok',
      icon: 'ri-database-2-line',
      iconColor: '#27AE60', // Green for master data
      children: [
        {
          label: 'Rendszer',
          children: [
            { label: 'Áfák', href: '/vat' },
            { label: 'Mértékegységek', href: '/units' },
            { label: 'Súlymértékek', href: '/weight-units' },
            { label: 'Fizetési módok', href: '/payment-methods' },
            { label: 'Szállítási módok', href: '/shipping-methods' },
            { label: 'Díjak', href: '/fees' },
            { label: 'Pénznemek', href: '/currencies' },
            { label: 'Raktárak', href: '/warehouses' }
          ]
        }
      ]
    },
    {
      label: 'Adatműveletek',
      href: '/data-operations',
      icon: 'ri-file-transfer-line',
      iconColor: '#5B7CFA'
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
        },
        {
          label: 'E-mail',
          href: '/settings/email'
        },
        {
          label: 'E-mail értesítések',
          href: '/settings/email/order-notifications'
        }
      ]
    }
  ]
}

export default verticalMenuData
