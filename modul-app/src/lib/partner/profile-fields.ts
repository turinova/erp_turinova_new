/** Partner profil mezők — regisztráció + Beállítások közös validáció. */

import {
  formatPhoneNumber,
  HU_PHONE_COMPLETE_RE,
  HU_PHONE_EXAMPLE
} from '@/lib/customers/parse'

export type PartnerProfileInput = {
  name: string
  email: string
  mobile: string
  password?: string
  billing_name: string
  billing_country: string
  billing_city: string
  billing_postal_code: string
  billing_street: string
  billing_house_number: string
  billing_tax_number: string
  billing_company_reg_number: string
  selected_tenant_id: string
}

export type PartnerProfileFieldErrors = Partial<
  Record<keyof PartnerProfileInput, string>
>

const TAX_RE = /^\d{8}-\d-\d{2}$/
const COMPANY_REG_RE = /^\d{2}-\d{2}-\d{6}$/

export { formatPhoneNumber, HU_PHONE_EXAMPLE }

export function formatTaxNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 8) return digits
  if (digits.length <= 9) {
    return `${digits.slice(0, 8)}-${digits.slice(8)}`
  }
  return `${digits.slice(0, 8)}-${digits.slice(8, 9)}-${digits.slice(9)}`
}

export function formatCompanyRegNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}-${digits.slice(2)}`
  }
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

export function parsePartnerProfileFormData(
  formData: FormData
): PartnerProfileInput {
  return {
    name: String(formData.get('name') || '').trim(),
    email: String(formData.get('email') || '')
      .trim()
      .toLowerCase(),
    mobile: formatPhoneNumber(String(formData.get('mobile') || '')).trim(),
    password: String(formData.get('password') || ''),
    billing_name: String(formData.get('billing_name') || '').trim(),
    billing_country:
      String(formData.get('billing_country') || '').trim() || 'Magyarország',
    billing_city: String(formData.get('billing_city') || '').trim(),
    billing_postal_code: String(formData.get('billing_postal_code') || '').trim(),
    billing_street: String(formData.get('billing_street') || '').trim(),
    billing_house_number: String(
      formData.get('billing_house_number') || ''
    ).trim(),
    billing_tax_number: formatTaxNumber(
      String(formData.get('billing_tax_number') || '')
    ),
    billing_company_reg_number: formatCompanyRegNumber(
      String(formData.get('billing_company_reg_number') || '')
    ),
    selected_tenant_id: String(formData.get('selected_tenant_id') || '').trim()
  }
}

export function validatePartnerAccountStep(
  input: Pick<PartnerProfileInput, 'name' | 'email' | 'mobile' | 'password'>,
  opts?: { requirePassword?: boolean }
): PartnerProfileFieldErrors {
  const errors: PartnerProfileFieldErrors = {}
  if (!input.name) errors.name = 'Add meg a neved.'
  if (!input.email) errors.email = 'Add meg az emailedet.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.email = 'Érvényes email címet adj meg.'
  }
  if (!input.mobile) {
    errors.mobile = 'Add meg a telefonszámot.'
  } else if (!HU_PHONE_COMPLETE_RE.test(input.mobile)) {
    errors.mobile = `Így add meg: ${HU_PHONE_EXAMPLE}`
  }
  if (opts?.requirePassword !== false) {
    if (!input.password) errors.password = 'Add meg a jelszót.'
    else if (input.password.length < 8) {
      errors.password = 'A jelszó legyen legalább 8 karakter.'
    }
  }
  return errors
}

export function validatePartnerBillingStep(
  input: Pick<
    PartnerProfileInput,
    | 'billing_name'
    | 'billing_city'
    | 'billing_postal_code'
    | 'billing_street'
    | 'billing_house_number'
    | 'billing_tax_number'
    | 'billing_company_reg_number'
  >
): PartnerProfileFieldErrors {
  const errors: PartnerProfileFieldErrors = {}
  const tax = input.billing_tax_number
  const reg = input.billing_company_reg_number
  const companyMode = Boolean(tax || reg)

  if (tax && !TAX_RE.test(tax)) {
    errors.billing_tax_number = 'Az adószám formátuma: 12345678-1-42.'
  }
  if (reg && !COMPANY_REG_RE.test(reg)) {
    errors.billing_company_reg_number =
      'A cégjegyzékszám formátuma: 01-09-123456.'
  }

  if (companyMode) {
    if (!input.billing_name) {
      errors.billing_name = 'Cégnél add meg a számlázási nevet.'
    }
    if (!input.billing_postal_code) {
      errors.billing_postal_code = 'Cégnél add meg az irányítószámot.'
    }
    if (!input.billing_city) {
      errors.billing_city = 'Cégnél add meg a várost.'
    }
    if (!input.billing_street) {
      errors.billing_street = 'Cégnél add meg az utcát.'
    }
  }

  return errors
}

export function validatePartnerCompanyStep(
  input: Pick<PartnerProfileInput, 'selected_tenant_id'>
): PartnerProfileFieldErrors {
  const errors: PartnerProfileFieldErrors = {}
  if (!input.selected_tenant_id) {
    errors.selected_tenant_id = 'Válassz céget.'
  }
  return errors
}

export function validatePartnerRegistration(
  input: PartnerProfileInput
): PartnerProfileFieldErrors {
  return {
    ...validatePartnerAccountStep(input, { requirePassword: true }),
    ...validatePartnerBillingStep(input),
    ...validatePartnerCompanyStep(input)
  }
}

export function firstFieldError(
  errors: PartnerProfileFieldErrors
): string | undefined {
  return Object.values(errors).find(Boolean)
}

export function billingNameOrFallback(
  billingName: string,
  name: string
): string {
  return billingName || name
}
