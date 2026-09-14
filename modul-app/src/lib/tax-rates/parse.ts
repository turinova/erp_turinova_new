import { z } from 'zod'

/** Magyar bevitel: 12,5 és 12.5 is OK. */
export function parsePercentInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

export const taxRateFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A név megadása kötelező.')
    .max(80, 'A név legfeljebb 80 karakter lehet.'),
  ratePercent: z
    .number({ invalid_type_error: 'Érvényes százalékot adj meg.' })
    .min(0, 'A kulcs legalább 0% legyen.')
    .max(100, 'A kulcs legfeljebb 100% lehet.')
})

export type TaxRateFormValues = z.infer<typeof taxRateFormSchema>

export function formatRatePercent(value: number): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value)
}
