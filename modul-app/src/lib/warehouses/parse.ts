import { z } from 'zod'

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null
  const t = value.trim()
  return t.length === 0 ? null : t
}

export function normalizeWarehouseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

export const warehouseFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A név megadása kötelező.')
    .max(120, 'A név legfeljebb 120 karakter lehet.'),
  code: z
    .string()
    .trim()
    .min(1, 'A kód megadása kötelező.')
    .max(24, 'A kód legfeljebb 24 karakter lehet.')
    .transform(normalizeWarehouseCode)
    .refine((v) => /^[A-Z0-9_-]+$/.test(v), {
      message: 'A kód csak betűt, számot, kötőjelet vagy aláhúzást tartalmazhat.'
    }),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  country: z
    .string()
    .max(80, 'Az ország legfeljebb 80 karakter lehet.')
    .optional()
    .nullable()
    .transform(emptyToNull),
  postalCode: z
    .string()
    .max(20, 'Az irányítószám legfeljebb 20 karakter lehet.')
    .optional()
    .nullable()
    .transform(emptyToNull),
  city: z
    .string()
    .max(80, 'A város legfeljebb 80 karakter lehet.')
    .optional()
    .nullable()
    .transform(emptyToNull),
  street: z
    .string()
    .max(120, 'Az utca legfeljebb 120 karakter lehet.')
    .optional()
    .nullable()
    .transform(emptyToNull),
  houseNumber: z
    .string()
    .max(40, 'A házszám legfeljebb 40 karakter lehet.')
    .optional()
    .nullable()
    .transform(emptyToNull),
  note: z
    .string()
    .max(2000, 'A megjegyzés legfeljebb 2000 karakter lehet.')
    .optional()
    .nullable()
    .transform(emptyToNull)
})

export type WarehouseFormValues = z.infer<typeof warehouseFormSchema>

export type WarehouseFormInput = {
  name: string
  code: string
  isDefault: boolean
  isActive: boolean
  country?: string | null
  postalCode?: string | null
  city?: string | null
  street?: string | null
  houseNumber?: string | null
  note?: string | null
}
