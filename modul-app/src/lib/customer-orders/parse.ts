import { z } from 'zod'

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

export const csoItemInputSchema = z.object({
  name: z.string().trim().min(1, 'Add meg a termék nevét.').max(200),
  qty: z.coerce.number().positive('A mennyiség legyen nagyobb nullánál.').max(1_000_000),
  unitShortform: z.string().trim().min(1).max(20).default('db'),
  sku: z.string().trim().max(100).transform(emptyToNull).nullable().optional(),
  unitPriceGross: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  accessoryId: z.string().uuid().nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).transform(emptyToNull).nullable().optional()
})

export const createCsoSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().min(1, 'Add meg az ügyfél nevét.').max(200),
  customerMobile: z
    .string()
    .trim()
    .min(6, 'Add meg a telefonszámot.')
    .max(40),
  depositAmount: z.coerce.number().min(0).nullable().optional(),
  promisedDate: z
    .string()
    .trim()
    .transform(emptyToNull)
    .refine(
      (v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v),
      'Érvénytelen dátum.'
    )
    .nullable()
    .optional(),
  note: z.string().trim().max(2000).transform(emptyToNull).nullable().optional(),
  items: z
    .array(csoItemInputSchema)
    .min(1, 'Legalább egy tétel kell.')
    .max(200)
})

export const updateCsoHeaderSchema = createCsoSchema.pick({
  customerName: true,
  customerMobile: true,
  depositAmount: true,
  promisedDate: true,
  note: true
})

export const updateCsoItemSchema = z.object({
  name: z.string().trim().min(1, 'Add meg a termék nevét.').max(200).optional(),
  sku: z.string().trim().max(100).transform(emptyToNull).nullable().optional(),
  qty: z.coerce
    .number()
    .positive('A mennyiség legyen nagyobb nullánál.')
    .max(1_000_000)
    .optional(),
  unitPriceGross: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  supplierId: z.string().uuid().nullable().optional(),
  note: z.string().trim().max(500).transform(emptyToNull).nullable().optional()
})

export type CreateCsoInput = z.infer<typeof createCsoSchema>
export type CsoItemInput = z.infer<typeof csoItemInputSchema>
export type UpdateCsoHeaderInput = z.input<typeof updateCsoHeaderSchema>
export type UpdateCsoItemInput = z.input<typeof updateCsoItemSchema>
