import { z } from 'zod'

import type { PricingMode } from '@/lib/opti/quote-calculations'
import {
  grossFromNet,
  netFromGross
} from '@/lib/sheet-materials/parse'

export { grossFromNet, netFromGross }

/** Magyar bevitel: 300,5 és 300.5 is OK. */
export function parseMoneyInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

/** @deprecated Prefer grossFromNet — ugyanaz. */
export function netToGross(net: number, ratePercent: number): number {
  return grossFromNet(net, ratePercent)
}

/** Round-trip-safe nettó a beírt bruttóból (lásd accessories / sheet-materials). */
export function grossToNet(gross: number, ratePercent: number): number {
  return netFromGross(gross, ratePercent)
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
  duplungolasFeePerSqmGross: z
    .number({ invalid_type_error: 'Érvényes összeget adj meg.' })
    .min(0, 'A duplungolási díj nem lehet negatív.'),
  szogvagasFeePerPanelGross: z
    .number({ invalid_type_error: 'Érvényes összeget adj meg.' })
    .min(0, 'A szögvágási díj nem lehet negatív.'),
  panthelyfurasFeePerHoleGross: z
    .number({ invalid_type_error: 'Érvényes összeget adj meg.' })
    .min(0, 'A pánthelyfúrás díj nem lehet negatív.'),
  taxRateId: z.string().uuid('Válassz ÁFA kulcsot.'),
  pricingMode: pricingModeSchema
})

export type CuttingFeeFormValues = z.infer<typeof cuttingFeeFormSchema>

export type { PricingMode }
