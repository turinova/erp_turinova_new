/** Publikus listaárak (nettó HUF) — marketing + megtérülés-kalkulátor. */

export const MARKETING_PRICING = {
  currency: 'HUF',
  netLabel: 'nettó',
  /** Automatikus próbaidő — Alap csomag. */
  trialMonths: 2,
  /** Éves fizetésnél ajándék hónapok (10× fizetsz, 12-t kapsz). */
  annualGiftMonths: 2,
  plan: {
    key: 'alap',
    name: 'Alap',
    priceMonthlyHuf: 39_990,
    /** 10 × havi — 2 hónap ajándék. */
    priceYearlyHuf: 399_900,
    blurb:
      'Bolt mag: eladás, árajánlat, készlet, beszerzés, POS, címke, törzsadat — a mindennapi munka gerince.',
    features: [
      'Értékesítés és árajánlat',
      'Készlet, raktár, átadás',
      'Beszerzés és beérkezés',
      'Online POS + műszakok',
      'Bolti címkenyomtatás',
      'Törzsadat és ügyfelek'
    ]
  },
  addons: {
    lapszabaszat: {
      key: 'lapszabaszat',
      name: 'Lapszabászati modul',
      priceMonthlyHuf: 10_000,
      blurb:
        'Opti szabás, megrendelés, táblás és szálas anyag, élzáró — a méretek a rendelésből jönnek.',
      accent: 'violet' as const
    },
    quote_ready_sms: {
      key: 'quote_ready_sms',
      name: 'SMS értesítés',
      priceMonthlyHuf: 4_900,
      priceUnitHuf: 89,
      unitLabel: 'Ft/db',
      blurb: 'Automatikus SMS az ügyfélnek, amikor az ajánlat kész.',
      accent: 'rose' as const
    },
    partner_orders: {
      key: 'partner_orders',
      name: 'Online partner rendelés',
      priceMonthlyHuf: 19_000,
      blurb: 'Asztalos partnerek saját portálon rendelnek — te a rendszeredben látod.',
      accent: 'rose' as const
    },
    jelenlet: {
      key: 'jelenlet',
      name: 'Jelenléti ív',
      priceMonthlyHuf: 9_900,
      blurb:
        'Dolgozók és jelenléti ív eszköz nélkül. Opcionális: egyedi gyártású chipkártyás beléptető — egyszeri hardverdíj.',
      hardwareNote:
        'Hardver nélkül is működik. Chipkártyás beléptetéshez saját gyártású olvasó — egyszeri díj, árajánlat szerint.',
      accent: 'emerald' as const
    },
    footcounter: {
      key: 'footcounter',
      name: 'Belépőszámláló',
      priceMonthlyHuf: 5_000,
      blurb:
        'AI kamera a bejáraton: napi és óránkénti forgalom. Havidíj + saját gyártású kamera egyszeri díja.',
      hardwareNote:
        'Saját gyártású AI kamera — egyszeri hardverdíj, árajánlat szerint.',
      accent: 'indigo' as const
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

/** Éves csomag effektív havi díja (12 hónapra vetítve). */
export function planEffectiveMonthlyFromYearly(): number {
  return Math.round(
    MARKETING_PRICING.plan.priceYearlyHuf / 12
  )
}
