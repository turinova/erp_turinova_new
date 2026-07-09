import type { OrganizationProfileInput } from "@/types/organization"
import {
  formatHungarianAddress,
  isValidHungarianTaxNumber,
  isValidPostalCode,
  isValidRegistrationNumber,
} from "@/lib/organizations/address"

export type ProfileValidationResult =
  | { ok: true }
  | { ok: false; error: string }

function validateAddress(
  address: OrganizationProfileInput["headquarters"],
  label: string
): ProfileValidationResult {
  if (!isValidPostalCode(address.postalCode)) {
    return { ok: false, error: `${label}: az irányítószám 4 számjegy legyen.` }
  }
  if (!address.city.trim()) {
    return { ok: false, error: `${label}: add meg a települést.` }
  }
  if (!address.street.trim()) {
    return { ok: false, error: `${label}: add meg az utca/házszámot.` }
  }
  return { ok: true }
}

export function validateOrganizationProfileInput(
  input: OrganizationProfileInput
): ProfileValidationResult {
  if (!input.legalName.trim()) {
    return { ok: false, error: "Add meg a cég nevét." }
  }

  const hq = validateAddress(input.headquarters, "Székhely")
  if (!hq.ok) return hq

  if (input.useSeparateMailingAddress) {
    const mail = validateAddress(
      input.mailingAddress ?? { postalCode: "", city: "", street: "" },
      "Levelezési cím"
    )
    if (!mail.ok) return mail
  }

  if (!input.taxNumber.trim()) {
    return { ok: false, error: "Add meg az adószámot." }
  }
  if (!isValidHungarianTaxNumber(input.taxNumber)) {
    return { ok: false, error: "Az adószám formátuma: 12345678-1-23" }
  }

  if (input.registrationNumber?.trim() && !isValidRegistrationNumber(input.registrationNumber)) {
    return { ok: false, error: "A cégjegyzékszám formátuma: 01-09-123456" }
  }

  if (input.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { ok: false, error: "Érvénytelen e-mail cím." }
  }

  if (input.logoDataUrl && input.logoDataUrl.length > 700_000) {
    return { ok: false, error: "A logo túl nagy (max. ~500 KB)." }
  }

  return { ok: true }
}

export function formatProfileSummary(input: OrganizationProfileInput): {
  headquartersAddress: string
  mailingAddress?: string
} {
  return {
    headquartersAddress: formatHungarianAddress(input.headquarters),
    mailingAddress: input.useSeparateMailingAddress && input.mailingAddress
      ? formatHungarianAddress(input.mailingAddress)
      : undefined,
  }
}
