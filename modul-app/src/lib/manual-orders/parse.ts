import { z } from 'zod'

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

export const moItemInputSchema = z.object({
  name: z.string().trim().min(1, 'Add meg a termék nevét.').max(200),
  qty: z.coerce.number().positive('A mennyiség legyen nagyobb nullánál.').max(1_000_000),
  unitShortform: z.string().trim().min(1).max(20).default('db'),
  sku: z.string().trim().max(100).transform(emptyToNull).nullable().optional(),
  unitPriceGross: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  accessoryId: z.string().uuid().nullable().optional(),
  supplierId: z.string().uuid({ message: 'Válassz beszállítót.' }),
  note: z.string().trim().max(500).transform(emptyToNull).nullable().optional()
})

const mobileSchema = z
  .string()
  .trim()
  .max(40)
  .transform(emptyToNull)
  .refine((v) => v === null || v.replace(/\D/g, '').length >= 6, 'Érvénytelen telefonszám.')
  .nullable()
  .optional()

const dateSchema = z
  .string()
  .trim()
  .transform(emptyToNull)
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), 'Érvénytelen dátum.')
  .nullable()
  .optional()

export const createMoSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().min(1, 'Add meg a vevő nevét.').max(200),
  customerMobile: mobileSchema,
  promisedDate: dateSchema,
  note: z.string().trim().max(2000).transform(emptyToNull).nullable().optional(),
  depositAmount: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  depositMethod: z.enum(['keszpenz', 'kartya', 'atutalas']).default('keszpenz'),
  alreadyOrdered: z.boolean().default(false),
  items: z.array(moItemInputSchema).min(1, 'Legalább egy tétel kell.').max(200)
})

export const updateMoHeaderSchema = z.object({
  customerName: z.string().trim().min(1, 'Add meg a vevő nevét.').max(200),
  customerMobile: mobileSchema,
  promisedDate: dateSchema,
  note: z.string().trim().max(2000).transform(emptyToNull).nullable().optional()
})

export const addMoDepositSchema = z.object({
  amount: z.coerce.number().positive('Az összeg legyen nagyobb nullánál.').max(100_000_000),
  method: z.enum(['keszpenz', 'kartya', 'atutalas']),
  note: z.string().trim().max(300).transform(emptyToNull).nullable().optional()
})

export type CreateMoInput = z.input<typeof createMoSchema>
export type MoItemInput = z.infer<typeof moItemInputSchema>
export type UpdateMoHeaderInput = z.input<typeof updateMoHeaderSchema>
export type AddMoDepositInput = z.input<typeof addMoDepositSchema>
