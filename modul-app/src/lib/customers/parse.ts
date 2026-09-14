import { z } from 'zod'

/** Telefonszám: +36 30 999 2800 mintájára. */
export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''

  let formatted = digits
  if (!digits.startsWith('36') && digits.length > 0) {
    formatted = `36${digits}`
  }

  if (formatted.length < 2) return value

  const countryCode = formatted.substring(0, 2)
  const areaCode = formatted.substring(2, 4)
  const firstPart = formatted.substring(4, 7)
  const secondPart = formatted.substring(7, 11)

  let result = `+${countryCode}`
  if (areaCode) result += ` ${areaCode}`
  if (firstPart) result += ` ${firstPart}`
  if (secondPart) result += ` ${secondPart}`
  return result
}

/** Adószám: ########-#-## */
export function formatTaxNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 8) return digits
  if (digits.length <= 9) {
    return `${digits.slice(0, 8)}-${digits.slice(8)}`
  }
  return `${digits.slice(0, 8)}-${digits.slice(8, 9)}-${digits.slice(9)}`
}

/** Cégjegyzékszám: ##-##-###### */
export function formatCompanyRegNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

const emptyToNull = (v: string) => {
  const t = v.trim()
  return t === '' ? null : t
}

export const customerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A név megadása kötelező.')
    .max(160, 'A név legfeljebb 160 karakter.'),
  email: z
    .string()
    .trim()
    .max(160)
    .transform(emptyToNull)
    .refine(
      (v) => v === null || z.string().email().safeParse(v).success,
      'Érvénytelen e-mail cím.'
    ),
  mobile: z
    .string()
    .trim()
    .max(40)
    .transform(emptyToNull),
  billingName: z.string().trim().max(160).transform(emptyToNull),
  billingCountry: z
    .string()
    .trim()
    .min(1, 'Az ország megadása kötelező.')
    .max(80),
  billingCity: z.string().trim().max(80).transform(emptyToNull),
  billingPostalCode: z.string().trim().max(20).transform(emptyToNull),
  billingStreet: z.string().trim().max(120).transform(emptyToNull),
  billingHouseNumber: z.string().trim().max(40).transform(emptyToNull),
  billingTaxNumber: z
    .string()
    .trim()
    .max(20)
    .transform(emptyToNull)
    .refine(
      (v) => v === null || /^\d{8}-\d-\d{2}$/.test(v),
      'Az adószám formátuma: 12345678-1-02'
    ),
  billingCompanyRegNumber: z
    .string()
    .trim()
    .max(20)
    .transform(emptyToNull)
    .refine(
      (v) => v === null || /^\d{2}-\d{2}-\d{6}$/.test(v),
      'A cégjegyzékszám formátuma: 01-09-123456'
    )
})

export type CustomerFormValues = z.infer<typeof customerFormSchema>
