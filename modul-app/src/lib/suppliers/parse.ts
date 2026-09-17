import { z } from 'zod'

import {
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber,
  HU_PHONE_EXAMPLE,
  HU_PHONE_COMPLETE_RE
} from '@/lib/customers/parse'

export {
  formatCompanyRegNumber,
  formatPhoneNumber,
  formatTaxNumber,
  HU_PHONE_EXAMPLE
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

const optionalEmail = z
  .string()
  .trim()
  .max(160)
  .transform(emptyToNull)
  .refine(
    (v) => v === null || z.string().email().safeParse(v).success,
    'Érvénytelen e-mail cím.'
  )

export const SUPPLIER_CURRENCIES = ['HUF', 'EUR', 'USD'] as const
export type SupplierCurrency = (typeof SUPPLIER_CURRENCIES)[number]

export const SUPPLIER_STATUSES = ['active', 'inactive'] as const
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]

export const ADDRESS_TYPES = ['billing', 'shipping', 'other'] as const
export type SupplierAddressType = (typeof ADDRESS_TYPES)[number]

export const supplierAddressSchema = z.object({
  label: z.string().trim().max(80).transform(emptyToNull),
  addressType: z.enum(ADDRESS_TYPES),
  country: z
    .string()
    .trim()
    .min(1, 'Az ország megadása kötelező.')
    .max(80),
  postalCode: z.string().trim().max(20).transform(emptyToNull),
  city: z.string().trim().max(80).transform(emptyToNull),
  street: z.string().trim().max(120).transform(emptyToNull),
  houseNumber: z.string().trim().max(40).transform(emptyToNull),
  isDefault: z.boolean()
})

export const supplierContactSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'A kapcsolattartó neve kötelező.')
    .max(120),
  email: optionalEmail,
  phone: optionalHuPhone,
  isPrimary: z.boolean(),
  note: z.string().trim().max(200).transform(emptyToNull)
})

export const supplierFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'A cégnév megadása kötelező.')
      .max(160, 'A cégnév legfeljebb 160 karakter.'),
    email: optionalEmail,
    phone: optionalHuPhone,
    website: z
      .string()
      .trim()
      .max(200)
      .transform(emptyToNull)
      .refine(
        (v) =>
          v === null ||
          /^https?:\/\//i.test(v) ||
          /^[\w.-]+\.[a-z]{2,}/i.test(v),
        'Érvénytelen weboldal (pl. https://pelda.hu).'
      ),
    taxNumber: z
      .string()
      .trim()
      .max(20)
      .transform(emptyToNull)
      .refine(
        (v) => v === null || /^\d{8}-\d-\d{2}$/.test(v),
        'Az adószám formátuma: 12345678-1-02'
      ),
    euVatNumber: z
      .string()
      .trim()
      .max(20)
      .transform((v) => {
        const t = v.trim().toUpperCase().replace(/\s+/g, '')
        return t === '' ? null : t
      })
      .refine(
        (v) => v === null || /^[A-Z]{2}[A-Z0-9]{2,12}$/.test(v),
        'A közösségi adószám formátuma: HU12345678'
      ),
    companyRegNumber: z
      .string()
      .trim()
      .max(20)
      .transform(emptyToNull)
      .refine(
        (v) => v === null || /^\d{2}-\d{2}-\d{6}$/.test(v),
        'A cégjegyzékszám formátuma: 01-09-123456'
      ),
    iban: z
      .string()
      .trim()
      .max(34)
      .transform((v) => {
        const t = v.replace(/\s+/g, '').toUpperCase()
        return t === '' ? null : t
      })
      .refine(
        (v) => v === null || /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(v),
        'Érvénytelen IBAN.'
      ),
    bic: z
      .string()
      .trim()
      .max(11)
      .transform((v) => {
        const t = v.replace(/\s+/g, '').toUpperCase()
        return t === '' ? null : t
      })
      .refine(
        (v) => v === null || /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(v),
        'Érvénytelen BIC/SWIFT.'
      ),
    accountHolder: z.string().trim().max(160).transform(emptyToNull),
    notes: z.string().trim().max(2000).transform(emptyToNull),
    status: z.enum(SUPPLIER_STATUSES),
    defaultCurrency: z.enum(SUPPLIER_CURRENCIES),
    defaultTaxRateId: z
      .string()
      .trim()
      .transform(emptyToNull)
      .refine(
        (v) => v === null || z.string().uuid().safeParse(v).success,
        'Érvénytelen adónem.'
      ),
    defaultPaymentMethodId: z
      .string()
      .trim()
      .transform(emptyToNull)
      .refine(
        (v) => v === null || z.string().uuid().safeParse(v).success,
        'Érvénytelen fizetési mód.'
      ),
    defaultPaymentTermsDays: z.coerce
      .number()
      .int('Egész nap legyen.')
      .min(0, 'Nem lehet negatív.')
      .max(365, 'Legfeljebb 365 nap.'),
    addresses: z.array(supplierAddressSchema).max(10),
    contacts: z.array(supplierContactSchema).max(20)
  })
  .superRefine((data, ctx) => {
    const defaults = data.addresses.filter((a) => a.isDefault)
    if (data.addresses.length > 0 && defaults.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Jelölj ki egy alapértelmezett címet.',
        path: ['addresses']
      })
    }
    if (defaults.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Csak egy alapértelmezett cím lehet.',
        path: ['addresses']
      })
    }
    const primaries = data.contacts.filter((c) => c.isPrimary)
    if (primaries.length > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Csak egy elsődleges kapcsolattartó lehet.',
        path: ['contacts']
      })
    }
  })

export type SupplierFormValues = z.infer<typeof supplierFormSchema>

export type SupplierFormInput = {
  name: string
  email: string
  phone: string
  website: string
  taxNumber: string
  euVatNumber: string
  companyRegNumber: string
  iban: string
  bic: string
  accountHolder: string
  notes: string
  status: SupplierStatus
  defaultCurrency: SupplierCurrency
  defaultTaxRateId: string
  defaultPaymentMethodId: string
  defaultPaymentTermsDays: number
  addresses: {
    label: string
    addressType: SupplierAddressType
    country: string
    postalCode: string
    city: string
    street: string
    houseNumber: string
    isDefault: boolean
  }[]
  contacts: {
    name: string
    email: string
    phone: string
    isPrimary: boolean
    note: string
  }[]
}

export function emptyAddressInput(isDefault = true): SupplierFormInput['addresses'][number] {
  return {
    label: '',
    addressType: 'billing',
    country: 'Magyarország',
    postalCode: '',
    city: '',
    street: '',
    houseNumber: '',
    isDefault
  }
}

export function emptyContactInput(
  isPrimary = false
): SupplierFormInput['contacts'][number] {
  return {
    name: '',
    email: '',
    phone: '',
    isPrimary,
    note: ''
  }
}

export const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = {
  active: 'Aktív',
  inactive: 'Inaktív'
}

export const ADDRESS_TYPE_LABEL: Record<SupplierAddressType, string> = {
  billing: 'Számlázási',
  shipping: 'Szállítási',
  other: 'Egyéb'
}
