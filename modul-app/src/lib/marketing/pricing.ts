/** Publikus listaárak (nettó HUF) — marketing + megtérülés-kalkulátor.
 *  Belső forrásigazság: docs/33 + product_plans. /arak jegelve 2027 Q2-ig.
 */

export const MARKETING_PRICING = {
  currency: 'HUF',
  netLabel: 'nettó',
  /** Automatikus próbaidő — Bolt csomag. */
  trialMonths: 2,
  /** Éves fizetésnél ajándék hónapok (10× fizetsz, 12-t kapsz). */
  annualGiftMonths: 2,
  /** Legacy alias — megegyezik plans.bolt-tal. */
  plan: {
    key: 'bolt',
    name: 'Bolt',
    priceMonthlyHuf: 39_990,
    priceYearlyHuf: 399_900,
    blurb: 'A bolt napi munkájához szükséges funkciók.',
    features: [
      'Ajánlatok és értékesítés',
      'Készlet és raktárak',
      'Beszerzések és beérkezések',
      'Pénztár és műszakzárás',
      'Számlázás (Számlázz.hu)',
      'Polc- és termékcímkék',
      'Ügyfelek és törzsadatok'
    ],
    featuresNote: 'És az összes további funkció, amit a bolt működtetéséhez még használsz.'
  },
  plans: {
    bolt: {
      key: 'bolt',
      name: 'Bolt',
      priceMonthlyHuf: 39_990,
      priceYearlyHuf: 399_900,
      blurb: 'Pult + készlet + beszerzés + ügyfélrendelés + számla.'
    },
    bolt_plus: {
      key: 'bolt_plus',
      name: 'Bolt+',
      priceMonthlyHuf: 59_900,
      priceYearlyHuf: 599_000,
      blurb: 'Bolt + PDA + jelenlét + belépő (szoftver). Hardver egyszeri.'
    },
    muhely: {
      key: 'muhely',
      name: 'Műhely',
      priceMonthlyHuf: 49_990,
      priceYearlyHuf: 499_900,
      blurb: 'Bolt + lapszabászat. PDA à la carte.'
    },
    pro: {
      key: 'pro',
      name: 'Pro',
      priceMonthlyHuf: 94_900,
      priceYearlyHuf: 949_000,
      blurb: 'Bolt+ + prioritás. Webshop※ jégelt.'
    }
  },
  addons: {
    lapszabaszat: {
      key: 'lapszabaszat',
      name: 'Lapszabászati modul',
      /** Műhely plan része — marketing ROI: 0 (ne duplázd). */
      priceMonthlyHuf: 0,
      blurb: 'Rendelés a partner saját fiókjából — Műhely csomag.',
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
      priceMonthlyHuf: 0,
      blurb: 'Jelenlét és távollét — Bolt+ / Pro bundel.',
      hardwareNote: 'Chipkártyás olvasó külön rendelhető.',
      accent: 'emerald' as const
    },
    footcounter: {
      key: 'footcounter',
      name: 'Belépőszámláló',
      priceMonthlyHuf: 0,
      blurb: 'Belépőszám — Bolt+ / Pro bundel.',
      hardwareNote: 'A kamera egyszeri díjára külön ajánlatot adunk.',
      accent: 'indigo' as const
    },
    pda_pos: {
      key: 'pda_pos',
      name: 'PDA POS',
      priceMonthlyHuf: 7_900,
      blurb: 'Bolt+/Pro bundel; Műhelyen à la carte.',
      accent: 'indigo' as const
    },
    webshop: {
      key: 'webshop',
      name: 'Webshop',
      priceMonthlyHuf: 12_900,
      blurb: 'Online bolt — Pro ※ jégelt.',
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
  return Math.round(MARKETING_PRICING.plan.priceYearlyHuf / 12)
}
