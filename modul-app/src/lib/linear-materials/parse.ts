import { z } from 'zod'

export {
  parseDecimalInput,
  parseIntegerInput,
  formatHuNumber,
  formatMoneyFt,
  netFromGross,
  grossFromNet
} from '@/lib/sheet-materials/parse'

export const LINEAR_MATERIAL_TYPES = [
  'hatfal',
  'munkalap',
  'asztalap'
] as const

export type LinearMaterialType = (typeof LINEAR_MATERIAL_TYPES)[number]

export const LINEAR_MATERIAL_TYPE_LABELS: Record<LinearMaterialType, string> = {
  hatfal: 'Hátfal',
  munkalap: 'Munkalap',
  asztalap: 'Asztalap'
}

export function isLinearMaterialType(
  value: string
): value is LinearMaterialType {
  return (LINEAR_MATERIAL_TYPES as readonly string[]).includes(value)
}

export function parseLinearMaterialTypeLabel(
  raw: string
): LinearMaterialType | null {
  const v = raw.trim().toLowerCase()
  if (isLinearMaterialType(v)) return v
  for (const [key, label] of Object.entries(LINEAR_MATERIAL_TYPE_LABELS)) {
    if (label.toLowerCase() === v) return key as LinearMaterialType
  }
  if (v === 'aszallap') return 'asztalap'
  return null
}

export const linearMaterialFormSchema = z.object({
  manufacturerId: z.string().uuid('Válassz gyártót.'),
  taxRateId: z.string().uuid('Válassz adónemet.'),
  name: z
    .string()
    .trim()
    .min(1, 'Az anyag neve kötelező.')
    .max(120, 'A név legfeljebb 120 karakter.'),
  materialType: z.enum(LINEAR_MATERIAL_TYPES, {
    errorMap: () => ({ message: 'Válassz típust (Hátfal / Munkalap / Asztalap).' })
  }),
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
  priceNet: z
    .number({ invalid_type_error: 'Érvényes árat adj meg.' })
    .min(0, 'Az ár nem lehet negatív.'),
  purchasePriceNet: z
    .number({ invalid_type_error: 'Érvényes beszerzési nettót adj meg.' })
    .min(0, 'A beszerzési ár nem lehet negatív.')
    .nullable(),
  marginFactor: z
    .number({ invalid_type_error: 'Érvényes árrés szorzót adj meg.' })
    .gt(0, 'A szorzó legyen nagyobb mint 0.')
    .max(100, 'A szorzó legfeljebb 100.')
    .nullable()
})

export type LinearMaterialFormValues = z.infer<typeof linearMaterialFormSchema>
