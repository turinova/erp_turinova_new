import { z } from 'zod'

/** Magyar bevitel: 12,5 és 12.5 is OK. */
export function parseDecimalInput(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (!normalized) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return value
}

export function parseIntegerInput(raw: string): number | null {
  const value = parseDecimalInput(raw)
  if (value === null) return null
  if (!Number.isInteger(value)) return null
  return value
}

export function formatHuNumber(
  value: number,
  maxFractionDigits = 2
): string {
  return new Intl.NumberFormat('hu-HU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits
  }).format(value)
}

export function formatMoneyFt(value: number): string {
  return `${formatHuNumber(value, 0)} Ft`
}

export function netFromGross(gross: number, vatPercent: number): number {
  return Math.round(gross / (1 + vatPercent / 100))
}

export function grossFromNet(net: number, vatPercent: number): number {
  return Math.round(net * (1 + vatPercent / 100))
}

export const edgeMaterialFormSchema = z.object({
  manufacturerId: z.string().uuid('Válassz gyártót.'),
  taxRateId: z.string().uuid('Válassz adónemet.'),
  equipmentId: z.string().uuid('Válassz berendezést.'),
  type: z
    .string()
    .trim()
    .min(1, 'A típus megadása kötelező.')
    .max(80, 'A típus legfeljebb 80 karakter.'),
  decor: z
    .string()
    .trim()
    .min(1, 'A dekor megadása kötelező.')
    .max(80, 'A dekor legfeljebb 80 karakter.'),
  widthMm: z
    .number({ invalid_type_error: 'Érvényes szélességet adj meg.' })
    .gt(0, 'A szélesség legyen nagyobb mint 0.'),
  thicknessMm: z
    .number({ invalid_type_error: 'Érvényes vastagságot adj meg.' })
    .gt(0, 'A vastagság legyen nagyobb mint 0.'),
  priceNet: z
    .number({ invalid_type_error: 'Érvényes árat adj meg.' })
    .min(0, 'Az ár nem lehet negatív.'),
  allowanceMm: z
    .number({ invalid_type_error: 'Érvényes ráhagyást adj meg.' })
    .int('A ráhagyás egész szám legyen.')
    .min(0, 'A ráhagyás nem lehet negatív.'),
  favouritePriority: z
    .number({ invalid_type_error: 'Érvényes sorrendet adj meg.' })
    .int('A kedvenc sorrend egész szám legyen.')
    .min(0, 'A kedvenc sorrend nem lehet negatív.')
    .nullable(),
  active: z.boolean(),
  machineCode: z
    .string()
    .trim()
    .min(1, 'A gépkód megadása kötelező.')
    .max(80, 'A gépkód legfeljebb 80 karakter.')
})

export type EdgeMaterialFormValues = z.infer<typeof edgeMaterialFormSchema>
