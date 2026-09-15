import { z } from 'zod'

export {
  formatHuNumber,
  formatMoneyFt,
  grossFromNet,
  netFromGross,
  parseIntegerInput
} from '@/lib/sheet-materials/parse'

export const feeTypeFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A díj típus neve kötelező.')
    .max(120, 'A név legfeljebb 120 karakter.'),
  taxRateId: z.string().uuid('Válassz adónemet.'),
  unitId: z.string().uuid('Válassz egységet.'),
  priceNet: z
    .number({ invalid_type_error: 'Érvényes árat adj meg.' })
    .min(0, 'Az ár nem lehet negatív.')
    .int('Az ár egész forint legyen.'),
  active: z.boolean()
})

export type FeeTypeFormValues = z.infer<typeof feeTypeFormSchema>
