import type { KioskGuest, KioskGuestBilling } from '@/lib/kiosk/types'

export const EMPTY_KIOSK_BILLING: KioskGuestBilling = {
  name: '',
  taxNumber: '',
  postalCode: '',
  city: '',
  street: '',
  houseNumber: ''
}

export const EMPTY_KIOSK_GUEST: KioskGuest = {
  name: '',
  phone: '+36',
  email: '',
  consent: false,
  billingMode: 'none',
  billing: EMPTY_KIOSK_BILLING
}

/** SMS: teljes HU mobil (+36 20/30/31/50/70 …). */
const HU_MOBILE_RE = /^\+36 (20|30|31|50|70) \d{3} \d{4}$/

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isGuestNameValid(name: string): boolean {
  return name.trim().length >= 2
}

export function isGuestPhoneEmpty(phone: string): boolean {
  const digits = phone.replace(/\D/g, '')
  return digits === '' || digits === '36'
}

/** Kötelező: teljes HU mobilszám. */
export function isGuestPhoneValid(phone: string): boolean {
  return HU_MOBILE_RE.test(phone.trim())
}

/** Üres = rendben (opcionális). */
export function isGuestEmailValid(email: string): boolean {
  const v = email.trim()
  return v === '' || EMAIL_RE.test(v)
}

export function isBillingFormValid(b: KioskGuestBilling): boolean {
  return (
    b.name.trim().length >= 2 &&
    /^\d{4}$/.test(b.postalCode.trim()) &&
    b.city.trim().length >= 2 &&
    b.street.trim().length >= 2 &&
    b.houseNumber.trim().length >= 1
  )
}

export type KioskGuestValidation = {
  contactDone: boolean
  billingDone: boolean
  consentDone: boolean
  ok: boolean
  /** Footer hint: első hiányzó dolog, vevő nyelvén. */
  missing: string | null
}

export function validateKioskGuest(guest: KioskGuest): KioskGuestValidation {
  const nameOk = isGuestNameValid(guest.name)
  const phoneOk = isGuestPhoneValid(guest.phone)
  const emailOk = isGuestEmailValid(guest.email)
  const contactDone = nameOk && phoneOk && emailOk
  const billingDone =
    guest.billingMode !== 'here' || isBillingFormValid(guest.billing)
  const consentDone = guest.consent

  let missing: string | null = null
  if (!nameOk) missing = 'Hiányzik: a neved'
  else if (!phoneOk) missing = 'Hiányzik: teljes mobilszám'
  else if (!emailOk) missing = 'Az e-mail cím hibás. Javítsd, vagy hagyd üresen.'
  else if (!billingDone) missing = 'Hiányzik: számlázási adat'
  else if (!consentDone) missing = 'Pipáld be: Átnéztem a rendelésemet'

  return {
    contactDone,
    billingDone,
    consentDone,
    ok: contactDone && billingDone && consentDone,
    missing
  }
}
