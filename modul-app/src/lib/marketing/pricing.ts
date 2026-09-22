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
    blurb: 'A bolt napi munkájához szükséges funkciók.',
    features: [
      'Ajánlatok és értékesítés',
      'Készlet és raktárak',
      'Beszerzések és beérkezések',
      'Pénztár és műszakzárás',
      'Polc- és termékcímkék',
      'Ügyfelek és törzsadatok'
    ],
    /** A lista nem teljes — ez jelzi, hogy ennél sokkal több van benne. */
    featuresNote: 'És az összes további funkció, amit a bolt működtetéséhez még használsz.'
  },
  addons: {
    lapszabaszat: {
      key: 'lapszabaszat',
      name: 'Lapszabászati modul',
      priceMonthlyHuf: 29_990,
      blurb: 'Rendelés a partner saját fiókjából.',
      accent: 'violet' as const
    },
    quote_ready_sms: {
      key: 'quote_ready_sms',
      name: 'SMS értesítés',
      priceMonthlyHuf: 0,
      priceUnitHuf: 89,
      unitLabel: 'Ft/db',
      blurb: 'SMS az ügyfélnek, amikor elkészült a rendelése.',
      accent: 'rose' as const
    },
    partner_orders: {
      key: 'partner_orders',
      name: 'Online partner rendelés',
      priceMonthlyHuf: 0,
      blurb: 'A partner saját fiókból küldi be a rendelést.',
      accent: 'rose' as const
    },
    jelenlet: {
      key: 'jelenlet',
      name: 'Jelenléti ív',
      priceMonthlyHuf: 9_900,
      blurb: 'Jelenlét és távollét egy naptárban.',
      hardwareNote:
        'Chipkártyás olvasó külön rendelhető.',
      accent: 'emerald' as const
    },
    footcounter: {
      key: 'footcounter',
      name: 'Belépőszámláló',
      priceMonthlyHuf: 5_000,
      blurb: 'Belépőszám óránként, időjárással együtt.',
      hardwareNote: 'A kamera egyszeri díjára külön ajánlatot adunk.',
      accent: 'indigo' as const
    }
  }
} as const

export type MarketingAddonKey = keyof typeof MARKETING_PRICING.addons

export const SUPPORT_PHONE_DISPLAY = '+36 30 999 2800'
export const SUPPORT_PHONE_E164 = '+36309992800'
export const SUPPORT_EMAIL = 'info@turinova.hu'
export const COMPANY_LINE = 'HÍRÖS-ABLAK Kft. · 6000 Kecskemét, Mindszenti krt. 10.'

/**
 * A hu-HU Intl locale csak 2+ jegyű bal oldali csoportnál rak ezres
 * elválasztót (pl. 10 000, de 9900) — `useGrouping: 'always'` nélkül ez
 * ugyanazon az oldalon egyszer szóközzel, egyszer szóköz nélkül jelenne meg.
 */
const HUF_FORMATTER = new Intl.NumberFormat('hu-HU', {
  maximumFractionDigits: 0,
  useGrouping: 'always'
})

export function formatHufNet(amount: number): string {
  return `${HUF_FORMATTER.format(Math.round(amount))} Ft nettó`
}

export function formatHufPlain(amount: number): string {
  return `${HUF_FORMATTER.format(Math.round(amount))} Ft`
}

/** Éves csomag effektív havi díja (12 hónapra vetítve). */
export function planEffectiveMonthlyFromYearly(): number {
  return Math.round(
    MARKETING_PRICING.plan.priceYearlyHuf / 12
  )
}
