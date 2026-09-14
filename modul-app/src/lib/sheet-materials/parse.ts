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

/** m² a tábla méretéből */
export function squareMeters(lengthMm: number, widthMm: number): number {
  return (lengthMm * widthMm) / 1_000_000
}

export function boardNetFromPricePerSqm(
  lengthMm: number,
  widthMm: number,
  priceNetPerSqm: number
): number {
  return Math.round(squareMeters(lengthMm, widthMm) * priceNetPerSqm)
}

export const sheetMaterialFormSchema = z.object({
  manufacturerId: z.string().uuid('Válassz gyártót.'),
  taxRateId: z.string().uuid('Válassz adónemet.'),
  equipmentId: z.string().uuid('Válassz berendezést.'),
  name: z
    .string()
    .trim()
    .min(1, 'Az anyag neve kötelező.')
    .max(120, 'A név legfeljebb 120 karakter.'),
  lengthMm: z
    .number({ invalid_type_error: 'Érvényes hosszt adj meg.' })
    .int('A hossz egész milliméter legyen.')
    .gt(0, 'A hossz legyen nagyobb mint 0.'),
  widthMm: z
    .number({ invalid_type_error: 'Érvényes szélességet adj meg.' })
    .int('A szélesség egész milliméter legyen.')
    .gt(0, 'A szélesség legyen nagyobb mint 0.'),
  thicknessMm: z
    .number({ invalid_type_error: 'Érvényes vastagságot adj meg.' })
    .gt(0, 'A vastagság legyen nagyobb mint 0.'),
  onStock: z.boolean(),
  active: z.boolean(),
  imageUrl: z.union([
    z.string().trim().url('Érvénytelen kép URL.'),
    z.null()
  ]),
  trimTopMm: z
    .number({ invalid_type_error: 'Érvényes trim értéket adj meg.' })
    .int()
    .min(0),
  trimRightMm: z
    .number({ invalid_type_error: 'Érvényes trim értéket adj meg.' })
    .int()
    .min(0),
  trimBottomMm: z
    .number({ invalid_type_error: 'Érvényes trim értéket adj meg.' })
    .int()
    .min(0),
  trimLeftMm: z
    .number({ invalid_type_error: 'Érvényes trim értéket adj meg.' })
    .int()
    .min(0),
  kerfMm: z
    .number({ invalid_type_error: 'Érvényes pengevastagságot adj meg.' })
    .int()
    .min(0),
  wasteMulti: z
    .number({ invalid_type_error: 'Érvényes hulladékszorzót adj meg.' })
    .gt(0, 'A hulladékszorzó legyen nagyobb mint 0.')
    .max(10, 'A hulladékszorzó legfeljebb 10.'),
  usageLimit: z
    .number({ invalid_type_error: 'Érvényes kihasználtságot adj meg.' })
    .min(0, 'A kihasználtság nem lehet negatív.')
    .max(1, 'A kihasználtság legfeljebb 100%.'),
  grainDirection: z.boolean(),
  rotatable: z.boolean(),
  priceNet: z
    .number({ invalid_type_error: 'Érvényes árat adj meg.' })
    .min(0, 'Az ár nem lehet negatív.'),
  machineCode: z
    .string()
    .trim()
    .min(1, 'A gépkód megadása kötelező.')
    .max(80, 'A gépkód legfeljebb 80 karakter.')
})

export type SheetMaterialFormValues = z.infer<typeof sheetMaterialFormSchema>
