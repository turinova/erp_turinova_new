import { z } from 'zod'

import {
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber,
  HU_PHONE_COMPLETE_RE,
  HU_PHONE_EXAMPLE
} from '@/lib/customers/parse'

export { formatCompanyRegNumber, formatPhoneNumber, formatTaxNumber }

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

export const companyFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A cég neve kötelező.')
    .max(160, 'A cég neve legfeljebb 160 karakter.'),
  email: z
    .string()
    .trim()
    .max(160)
    .transform(emptyToNull)
    .refine(
      (v) => v === null || z.string().email().safeParse(v).success,
      'Érvénytelen e-mail cím.'
    ),
  phoneNumber: z
    .string()
    .trim()
    .max(40)
    .transform(emptyToNull)
    .refine(
      (v) => v === null || HU_PHONE_COMPLETE_RE.test(v),
      `A telefonszám formátuma: ${HU_PHONE_EXAMPLE}`
    ),
  website: z
    .string()
    .trim()
    .max(200)
    .transform(emptyToNull)
    .refine((v) => {
      if (v === null) return true
      return /^https?:\/\/.+\..+/i.test(v)
    }, 'A weboldal formátuma: https://pelda.hu'),
  country: z
    .string()
    .trim()
    .min(1, 'Az ország megadása kötelező.')
    .max(80),
  city: z.string().trim().max(80).transform(emptyToNull),
  postalCode: z.string().trim().max(20).transform(emptyToNull),
  address: z.string().trim().max(200).transform(emptyToNull),
  taxNumber: z
    .string()
    .trim()
    .max(20)
    .transform(emptyToNull)
    .refine(
      (v) => v === null || /^\d{8}-\d-\d{2}$/.test(v),
      'Az adószám formátuma: 12345678-1-02'
    ),
  companyRegistrationNumber: z
    .string()
    .trim()
    .max(20)
    .transform(emptyToNull)
    .refine(
      (v) => v === null || /^\d{2}-\d{2}-\d{6}$/.test(v),
      'A cégjegyzékszám formátuma: 01-09-123456'
    ),
  vatId: z.string().trim().max(40).transform(emptyToNull),
  logoUrl: z.string().trim().max(500).transform(emptyToNull),
  quoteValidityDays: z.coerce
    .number({ invalid_type_error: 'Adj meg egy számot.' })
    .int('Egész nap legyen.')
    .min(1, 'Legalább 1 nap.')
    .max(365, 'Legfeljebb 365 nap.')
})

export type CompanyFormValues = z.infer<typeof companyFormSchema>

export type CompanyFormInput = {
  name: string
  email: string
  phoneNumber: string
  website: string
  country: string
  city: string
  postalCode: string
  address: string
  taxNumber: string
  companyRegistrationNumber: string
  vatId: string
  logoUrl: string
  quoteValidityDays: number
}
