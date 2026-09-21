import {
  MARKETING_PRICING,
  type MarketingAddonKey
} from '@/lib/marketing/pricing'

export type RoiInputs = {
  quotesPerMonth: number
  minutesPerQuoteNow: number
  minutesPerQuoteWithOptinova: number
  productionHoursPerWeekNow: number
  productionHoursPerWeekWithOptinova: number
  smsPerMonth: number
  minutesPerSmsManual: number
  hourlyWageHuf: number
  smsAddon: boolean
  partnerAddon: boolean
  jelenletAddon: boolean
  lapszabaszatAddon: boolean
  footcounterAddon: boolean
}

export type RoiBreakdown = {
  hoursQuotes: number
  hoursProduction: number
  hoursSms: number
  hoursTotal: number
  savingsMonthlyHuf: number
  savingsYearlyHuf: number
  /** Teljes havi díj a próba után (Alap + add-onok + SMS usage). */
  subscriptionMonthlyHuf: number
  smsUsageMonthlyHuf: number
  netMonthlyHuf: number
  paybackMonths: number | null
  trialMonths: number
  /** Próba alatt az Alap 0 Ft — add-onok + SMS usage marad. */
  subscriptionDuringTrialHuf: number
}

/** Konzervatív defaultok — Hírös-szerű KKV. */
export const ROI_DEFAULTS: RoiInputs = {
  quotesPerMonth: 40,
  minutesPerQuoteNow: 30,
  minutesPerQuoteWithOptinova: 10,
  productionHoursPerWeekNow: 6,
  productionHoursPerWeekWithOptinova: 3,
  smsPerMonth: 40,
  minutesPerSmsManual: 2,
  hourlyWageHuf: 5_000,
  smsAddon: true,
  partnerAddon: false,
  jelenletAddon: false,
  lapszabaszatAddon: false,
  footcounterAddon: false
}

/** Hírös Ablak esettanulmány — ugyanaz a képlet, publikált kalibráció. */
export const HIROS_ROI_INPUTS: RoiInputs = {
  quotesPerMonth: 55,
  minutesPerQuoteNow: 35,
  minutesPerQuoteWithOptinova: 12,
  productionHoursPerWeekNow: 8,
  productionHoursPerWeekWithOptinova: 3.5,
  smsPerMonth: 50,
  minutesPerSmsManual: 2,
  hourlyWageHuf: 5_200,
  smsAddon: true,
  partnerAddon: true,
  jelenletAddon: false,
  lapszabaszatAddon: true,
  footcounterAddon: false
}

const WEEKS_PER_MONTH = 4.3

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n
}

export function computeSubscriptionMonthlyHuf(input: RoiInputs): {
  fixedHuf: number
  smsUsageHuf: number
  totalHuf: number
  planHuf: number
  addonsHuf: number
} {
  const planHuf = MARKETING_PRICING.plan.priceMonthlyHuf
  let addonsHuf = 0
  if (input.lapszabaszatAddon) {
    addonsHuf += MARKETING_PRICING.addons.lapszabaszat.priceMonthlyHuf
  }
  if (input.smsAddon) {
    addonsHuf += MARKETING_PRICING.addons.quote_ready_sms.priceMonthlyHuf
  }
  if (input.partnerAddon) {
    addonsHuf += MARKETING_PRICING.addons.partner_orders.priceMonthlyHuf
  }
  if (input.jelenletAddon) {
    addonsHuf += MARKETING_PRICING.addons.jelenlet.priceMonthlyHuf
  }
  if (input.footcounterAddon) {
    addonsHuf += MARKETING_PRICING.addons.footcounter.priceMonthlyHuf
  }
  const smsUsage = input.smsAddon
    ? clampNonNeg(input.smsPerMonth) *
      MARKETING_PRICING.addons.quote_ready_sms.priceUnitHuf
    : 0
  const fixedHuf = planHuf + addonsHuf
  return {
    planHuf,
    addonsHuf,
    fixedHuf,
    smsUsageHuf: smsUsage,
    totalHuf: fixedHuf + smsUsage
  }
}

export function computeRoi(input: RoiInputs): RoiBreakdown {
  const quotes = clampNonNeg(input.quotesPerMonth)
  const minNow = clampNonNeg(input.minutesPerQuoteNow)
  const minOpti = clampNonNeg(input.minutesPerQuoteWithOptinova)
  const quoteDeltaMin = Math.max(0, minNow - minOpti)
  const hoursQuotes = (quotes * quoteDeltaMin) / 60

  const prodNow = clampNonNeg(input.productionHoursPerWeekNow)
  const prodOpti = clampNonNeg(input.productionHoursPerWeekWithOptinova)
  const hoursProduction = Math.max(0, prodNow - prodOpti) * WEEKS_PER_MONTH

  const smsCount = input.smsAddon ? clampNonNeg(input.smsPerMonth) : 0
  const minSms = clampNonNeg(input.minutesPerSmsManual)
  const hoursSms = (smsCount * minSms) / 60

  const hoursTotal = hoursQuotes + hoursProduction + hoursSms
  const wage = clampNonNeg(input.hourlyWageHuf)
  const savingsMonthlyHuf = hoursTotal * wage
  const savingsYearlyHuf = savingsMonthlyHuf * 12

  const sub = computeSubscriptionMonthlyHuf(input)
  const trialMonths = MARKETING_PRICING.trialMonths
  const subscriptionDuringTrialHuf = sub.addonsHuf + sub.smsUsageHuf
  const netMonthlyHuf = savingsMonthlyHuf - sub.totalHuf
  const paybackMonths =
    savingsMonthlyHuf > 0
      ? Math.max(0.1, sub.totalHuf / savingsMonthlyHuf)
      : null

  return {
    hoursQuotes,
    hoursProduction,
    hoursSms,
    hoursTotal,
    savingsMonthlyHuf,
    savingsYearlyHuf,
    subscriptionMonthlyHuf: sub.totalHuf,
    smsUsageMonthlyHuf: sub.smsUsageHuf,
    netMonthlyHuf,
    paybackMonths,
    trialMonths,
    subscriptionDuringTrialHuf
  }
}

export function addonKeysFromInputs(input: RoiInputs): MarketingAddonKey[] {
  const keys: MarketingAddonKey[] = []
  if (input.lapszabaszatAddon) keys.push('lapszabaszat')
  if (input.smsAddon) keys.push('quote_ready_sms')
  if (input.partnerAddon) keys.push('partner_orders')
  if (input.jelenletAddon) keys.push('jelenlet')
  if (input.footcounterAddon) keys.push('footcounter')
  return keys
}

export function formatHoursHu(hours: number): string {
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 1
  }).format(hours)} óra`
}

export function formatMonthsHu(months: number): string {
  if (months < 1) {
    return `${new Intl.NumberFormat('hu-HU', {
      maximumFractionDigits: 1
    }).format(months * 30)} nap`
  }
  return `${new Intl.NumberFormat('hu-HU', {
    maximumFractionDigits: 1
  }).format(months)} hónap`
}
