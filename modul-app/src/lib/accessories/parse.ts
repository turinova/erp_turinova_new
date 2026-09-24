import { z } from 'zod'

export {
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  netFromGross,
  parseDecimalInput,
  parseIntegerInput
} from '@/lib/sheet-materials/parse'

function emptyToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const accessoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A termék neve kötelező.')
    .max(200, 'A név legfeljebb 200 karakter.'),
  manufacturerId: z.string().uuid('Válassz gyártót.'),
  sku: z
    .string()
    .trim()
    .min(1, 'A SKU kötelező.')
    .max(100, 'A SKU legfeljebb 100 karakter.'),
  barcode: z
    .string()
    .trim()
    .max(64, 'A gyártói vonalkód legfeljebb 64 karakter.')
    .optional()
    .transform((v) => (v == null ? null : emptyToNull(v))),
  barcodeInternal: z
    .string()
    .trim()
    .max(64, 'A belső vonalkód legfeljebb 64 karakter.')
    .optional()
    .transform((v) => (v == null ? null : emptyToNull(v))),
  taxRateId: z.string().uuid('Válassz adónemet.'),
  unitId: z.string().uuid('Válassz egységet.'),
  priceNet: z
    .number({ invalid_type_error: 'Érvényes árat adj meg.' })
    .min(0, 'Az ár nem lehet negatív.')
    .int('Az ár egész forint legyen.'),
  purchasePriceNet: z
    .number({ invalid_type_error: 'Érvényes beszerzési nettót adj meg.' })
    .min(0, 'A beszerzési ár nem lehet negatív.')
    .int('A beszerzési ár egész forint legyen.')
    .nullable(),
  marginFactor: z
    .number({ invalid_type_error: 'Érvényes árrés szorzót adj meg.' })
    .gt(0, 'A szorzó legyen nagyobb mint 0.')
    .max(100, 'A szorzó legfeljebb 100.')
    .nullable(),
  imageUrl: z
    .string()
    .nullable()
    .optional()
    .transform((v) => {
      if (v == null) return null
      const trimmed = v.trim()
      return trimmed.length > 0 ? trimmed : null
    }),
  active: z.boolean(),
  sellablePos: z.boolean().default(true)
})

export type AccessoryFormValues = z.infer<typeof accessoryFormSchema>
