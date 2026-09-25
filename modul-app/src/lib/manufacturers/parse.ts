import { z } from 'zod'

const optionalText = (max: number, label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => {
      const t = (v ?? '').trim()
      return t.length > 0 ? t : null
    })
    .refine(
      (v) => v == null || v.length <= max,
      `${label}: legfeljebb ${max} karakter.`
    )

const optionalEmail = (label: string) =>
  optionalText(200, label).refine(
    (v) => v == null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    `${label}: érvényes e-mail címet adj meg.`
  )

export const manufacturerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A név megadása kötelező.')
    .max(120, 'A név legfeljebb 120 karakter lehet.'),
  legalName: optionalText(200, 'Cégnév'),
  postalAddress: optionalText(300, 'Postai cím'),
  email: optionalEmail('E-mail'),
  website: optionalText(300, 'Weboldal'),
  euRepName: optionalText(200, 'EU felelős neve'),
  euRepAddress: optionalText(300, 'EU felelős címe'),
  euRepEmail: optionalEmail('EU felelős e-mail')
})

export type ManufacturerFormInput = z.input<typeof manufacturerFormSchema>
export type ManufacturerFormValues = z.infer<typeof manufacturerFormSchema>
