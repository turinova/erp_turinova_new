import { z } from 'zod'

import type { PricingMode } from '@/lib/opti/quote-calculations'

/** Magyar bevitel: 300,5 és 300.5 is OK. */
export function parseMoneyInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

export function netToGross(net: number, ratePercent: number): number {
  return Math.round(net * (1 + ratePercent / 100))
}

export function grossToNet(gross: number, ratePercent: number): number {
  return Math.round(gross / (1 + ratePercent / 100))
}

export const pricingModeSchema = z.enum([
  'standard',
  'always_full_board',
  'always_panel_area'
])

export const cuttingFeeFormSchema = z.object({
  feePerMeterGross: z
    .number({ invalid_type_error: 'Érvényes összeget adj meg.' })
    .positive('A vágási díj legyen nagyobb mint 0.'),
  taxRateId: z.string().uuid('Válassz ÁFA kulcsot.'),
  pricingMode: pricingModeSchema
})

export type CuttingFeeFormValues = z.infer<typeof cuttingFeeFormSchema>

export type { PricingMode }
