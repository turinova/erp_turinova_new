import type { HungarianAddress } from "@/types/organization"

export function formatHungarianAddress(address: HungarianAddress): string {
  const postalCode = address.postalCode.trim()
  const city = address.city.trim()
  const street = address.street.trim()
  if (!postalCode && !city && !street) return ""
  if (!street) return `${postalCode} ${city}`.trim()
  return `${postalCode} ${city}, ${street}`.trim()
}

/** Régi egy mezős cím → strukturált (ha lehet) */
export function parseLegacyAddress(value: string): HungarianAddress {
  const trimmed = value.trim()
  const match = /^(\d{4})\s+([^,]+),\s*(.+)$/.exec(trimmed)
  if (match) {
    return {
      postalCode: match[1],
      city: match[2].trim(),
      street: match[3].trim(),
    }
  }
  return { postalCode: "", city: "", street: trimmed }
}

export function sanitizePostalCodeInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4)
}

export function isValidPostalCode(value: string): boolean {
  return /^\d{4}$/.test(value.trim())
}

export function isValidHungarianTaxNumber(value: string): boolean {
  return /^\d{8}-\d-\d{2}$/.test(value.trim())
}

export function isValidRegistrationNumber(value: string): boolean {
  return /^\d{2}-\d{2}-\d{6}$/.test(value.trim())
}

export function sanitizeTaxNumberInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 8) return digits
  if (digits.length === 9) return `${digits.slice(0, 8)}-${digits[8]}`
  return `${digits.slice(0, 8)}-${digits[8]}-${digits.slice(9)}`
}

export function sanitizeRegistrationNumberInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 10)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4)}`
}

export function emptyAddress(): HungarianAddress {
  return { postalCode: "", city: "", street: "" }
}
