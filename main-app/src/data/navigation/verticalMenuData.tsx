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
    label: 'Kereső',
    href: '/search',
    icon: 'ri-search-line',
    iconColor: '#E74C3C' // Red for search
  },
  {
    label: 'Opti',
    href: '/opti',
    icon: 'ri-dashboard-line',
    iconColor: '#8E44AD' // Purple for optimization tools
  },
  {
    label: 'Munki',
    href: '/worktop-config',
    icon: 'ri-window-line',
    iconColor: '#8E44AD' // Grouped with Opti tools
  },
  {
    label: 'Rendelést felvétel',
    href: '/shoporder',
    icon: 'ri-store-line',
    iconColor: '#F39C12' // Orange for shop orders
  },
  {
    label: 'Scanner',
    href: '/scanner',
    icon: 'ri-barcode-line',
    iconColor: '#3498DB' // Blue for scanner
  },
  {
    label: 'Riportok',
    href: '/reports',
    icon: 'ri-bar-chart-line',
    iconColor: '#16A085' // Teal for reports
  },
  {
    label: 'Pos',
    href: '/pos',
    icon: 'ri-computer-line',
    iconColor: '#27AE60' // Green for POS/computer
  },
  {
    label: 'Értékesítés',
    icon: 'ri-shopping-cart-line',
    iconColor: '#E67E22', // Orange for sales
    children: [
      {
        label: 'Rendelések',
        href: '/pos-orders'
      },
      {
        label: 'Ügyfél rendelések',
        href: '/fulfillment-orders'
      },
      {
        label: 'Ügyfél ajánlatok',
        href: '/client-offers'
      }
    ]
  },
  {
    label: 'Raktárak',
    icon: 'ri-archive-line',
    iconColor: '#D35400', // Orange for warehouse
    children: [
      {
        label: 'Műveletek',
        href: '/warehouseoperations'
      }
    ]
  },
  {
    label: 'Lapszabászat',
    icon: 'ri-scissors-line',
    iconColor: '#E74C3C', // Red for cutting/manufacturing
    children: [
      {
        label: 'Megrendelések',
        href: '/orders'
      },
      {
        label: 'Ajánlatok',
        href: '/quotes'
      }
    ]
  },
  {
    label: 'Munkalap',
    icon: 'ri-table-line',
    iconColor: '#8E44AD', // Purple for worktop tools
    children: [
      {
        label: 'Munkalap ajánlatok',
        href: '/worktop-quotes'
      }
    ]
  },
  {
    label: 'Beszerzés',
    icon: 'ri-shopping-bag-line',
    iconColor: '#9B59B6', // Purple for purchasing
    children: [
      {
        label: 'Ügyfél rendelések',
        href: '/customer-orders'
      },
      {
        label: 'Ügyfél rendelés tételek',
        href: '/customer-order-items'
      },
      {
        label: 'Beszállítói várólista',
        href: '/supplier-orders'
      },
      {
        label: 'Beszállítói rendelések',
        href: '/purchase-order'
      }
      ,
      {
        label: 'Szállítmányok',
        href: '/shipments'
      }
    ]
  },
  {
    label: 'Pénzügy',
    icon: 'ri-money-dollar-circle-line',
    iconColor: '#27AE60', // Green for finance
    children: [
      {
        label: 'Kimenő számlák',
        href: '/invoices'
      }
    ]
  },
  {
    label: 'HR',
    icon: 'ri-user-line',
    iconColor: '#E91E63', // Pink for HR
    children: [
      {
        label: 'Kollégák',
        href: '/employees'
      },
      {
        label: 'Ünnepek',
        href: '/holidays'
      }
    ]
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
        label: 'Beszállítók',
        href: '/partners'
      },
      {
        label: 'Alapanyagok',
        children: [
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
            label: 'Termékek',
            href: '/accessories'
          }
          ,
          {
            label: 'Termék javaslatok',
            href: '/product-suggestions'
          }
        ]
      },
      {
        label: 'Rendszer',
        children: [
          {
            label: 'Adónem',
            href: '/vat'
          },
          {
            label: 'Pénznem',
            href: '/currencies'
          },
          {
            label: 'Fizetési módok',
            href: '/payment-methods'
          },
          {
            label: 'Egységek',
            href: '/units'
          },
          {
            label: 'Díjtípusok',
            href: '/feetypes'
          },
          {
            label: 'Gépek',
            href: '/machines'
          },
          {
            label: 'Dolgozók',
            href: '/workers'
          },
          {
            label: 'Gyártók',
            href: '/brands'
          },
          {
            label: 'Média',
            href: '/media'
          }
        ]
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
        href: '/opti-settings'
      },
      {
        label: 'Munki beállítások',
        href: '/munki-settings'
      },
      {
        label: 'Értesítések',
        href: '/notifications'
      },
      {
        label: 'Email beállítások',
        href: '/email-settings'
      }
    ]
  }
  ]
}

export default verticalMenuData
