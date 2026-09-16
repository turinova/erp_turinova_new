import { z } from 'zod'

/** Mobilkörzetek — helyi rész 7 jegy (3–4). Egyéb 2 jegyű: max 6 jegy (3–3). */
const MOBILE_AREA_CODES = new Set([
  '20',
  '30',
  '31',
  '50',
  '70'
])

export const HU_PHONE_EXAMPLE = '+36 30 999 2800'

/** Teljes HU szám: +36 1 XXX XXXX | +36 XX XXX XXXX | +36 XX XXX XXX */
export const HU_PHONE_COMPLETE_RE =
  /^\+36 (1 \d{3} \d{4}|\d{2} \d{3} \d{4}|\d{2} \d{3} \d{3})$/

/**
 * Telefonszám élő formázás: mindig +36,
 * Bp: +36 1 XXX XXXX,
 * mobil: +36 XX XXX XXXX (3–4),
 * egyéb körzet: +36 XX XXX XXX (3–3).
 */
export function formatPhoneNumber(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (!digits) return ''

  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('06')) digits = `36${digits.slice(2)}`
  else if (digits.startsWith('0')) digits = digits.slice(1)

  if (!digits.startsWith('36')) digits = `36${digits}`
  // 36 + max 9 nemzeti jegy
  digits = digits.slice(0, 11)

  const national = digits.slice(2)
  let result = '+36'
  if (!national) return result

  // Budapest: 1 + 7 jegy (3–4)
  if (national.startsWith('1')) {
    const local = national.slice(1, 8)
    result += ' 1'
    if (local.length === 0) return result
    if (local.length <= 3) return `${result} ${local}`
    return `${result} ${local.slice(0, 3)} ${local.slice(3)}`
  }

  const area = national.slice(0, Math.min(2, national.length))
  if (area.length < 2) return `${result} ${area}`

  const isMobile = MOBILE_AREA_CODES.has(area)
  const maxLocal = isMobile ? 7 : 6
  const local = national.slice(2, 2 + maxLocal)

  result += ` ${area}`
  if (!local) return result
  if (local.length <= 3) return `${result} ${local}`
  return `${result} ${local.slice(0, 3)} ${local.slice(3)}`
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

const optionalHuPhone = z
  .string()
  .trim()
  .max(40)
  .transform(emptyToNull)
  .refine(
    (v) => v === null || HU_PHONE_COMPLETE_RE.test(v),
    `A telefonszám formátuma: ${HU_PHONE_EXAMPLE}`
  )

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
  mobile: optionalHuPhone,
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
