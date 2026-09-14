import { z } from 'zod'

export const manufacturerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A név megadása kötelező.')
    .max(120, 'A név legfeljebb 120 karakter lehet.')
})

export type ManufacturerFormValues = z.infer<typeof manufacturerFormSchema>
