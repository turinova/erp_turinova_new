/** Publikus listaárak (nettó HUF / hó) — marketing + megtérülés-kalkulátor. */

export const MARKETING_PRICING = {
  currency: 'HUF',
  netLabel: 'nettó',
  plan: {
    key: 'alap',
    name: 'Alap',
    priceMonthlyHuf: 22_000,
    blurb: 'Ajánlat, törzsadat, műhelyfolyamat — a mindennapi munka gerince.'
  },
  addons: {
    quote_ready_sms: {
      key: 'quote_ready_sms',
      name: 'SMS',
      priceMonthlyHuf: 4_900,
      priceUnitHuf: 89,
      unitLabel: 'Ft/db',
      blurb: 'Ügyfélértesítés, amikor az ajánlat kész.'
    },
    partner_orders: {
      key: 'partner_orders',
      name: 'Online partner',
      priceMonthlyHuf: 19_000,
      blurb: 'Asztalos partnerek saját portálon rendelnek.'
    },
    product_labels: {
      key: 'product_labels',
      name: 'Termék címke',
      priceMonthlyHuf: 9_900,
      blurb: 'Címkézés a gyártáshoz és azonosításhoz.'
    }
  }
} as const

export type MarketingAddonKey = keyof typeof MARKETING_PRICING.addons

export const SUPPORT_PHONE_DISPLAY = '+36 30 999 2800'
export const SUPPORT_PHONE_E164 = '+36309992800'
export const SUPPORT_EMAIL = 'info@turinova.hu'
export const COMPANY_LINE = 'HÍRÖS-ABLAK Kft. · 6000 Kecskemét, Mindszenti krt. 10.'

export function formatHufNet(amount: number): string {
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0
  }).format(Math.round(amount))} Ft nettó`
}

export function formatHufPlain(amount: number): string {
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 0
  }).format(Math.round(amount))} Ft`
}
