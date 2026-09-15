import { z } from 'zod'

export const unitFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A név megadása kötelező.')
    .max(120, 'A név legfeljebb 120 karakter lehet.'),
  shortform: z
    .string()
    .trim()
    .min(1, 'A rövidítés megadása kötelező.')
    .max(32, 'A rövidítés legfeljebb 32 karakter lehet.')
})

export type UnitFormValues = z.infer<typeof unitFormSchema>
