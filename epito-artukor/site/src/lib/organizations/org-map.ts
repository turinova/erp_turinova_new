import type { QuoteVatMode } from "@/types/projects"
import type { OrganizationProfile, OrganizationProfileInput } from "@/types/organization"
import { emptyAddress, formatHungarianAddress } from "@/lib/organizations/address"

export type OrganizationRow = {
  id: string
  name: string
  slug: string
  hq_postal_code: string | null
  hq_city: string | null
  hq_street: string | null
  use_separate_mailing_address: boolean | null
  mail_postal_code: string | null
  mail_city: string | null
  mail_street: string | null
  tax_number: string | null
  registration_number: string | null
  representative: string | null
  email: string | null
  phone: string | null
  bank_name: string | null
  bank_account: string | null
  logo_data_url: string | null
  default_vat_mode: string | null
  updated_at: string
}

function rowAddress(
  postal: string | null,
  city: string | null,
  street: string | null
) {
  return {
    postalCode: postal?.trim() ?? "",
    city: city?.trim() ?? "",
    street: street?.trim() ?? "",
  }
}

export function mapOrganizationRow(row: OrganizationRow): OrganizationProfile {
  const useSeparate = Boolean(row.use_separate_mailing_address)
  const mailing = useSeparate
    ? rowAddress(row.mail_postal_code, row.mail_city, row.mail_street)
    : null

  return {
    id: row.id,
    legalName: row.name,
    slug: row.slug,
    headquarters: rowAddress(row.hq_postal_code, row.hq_city, row.hq_street),
    useSeparateMailingAddress: useSeparate,
    mailingAddress: mailing,
    taxNumber: row.tax_number?.trim() ?? "",
    registrationNumber: row.registration_number?.trim() || undefined,
    representative: row.representative?.trim() || undefined,
    email: row.email?.trim() || undefined,
    phone: row.phone?.trim() || undefined,
    bankName: row.bank_name?.trim() || undefined,
    bankAccount: row.bank_account?.trim() || undefined,
    logoDataUrl: row.logo_data_url || undefined,
    defaultVatMode: (row.default_vat_mode ?? "standard") as QuoteVatMode,
    updatedAt: row.updated_at,
  }
}

export function profileInputToUpdateRow(input: OrganizationProfileInput) {
  const mailing = input.useSeparateMailingAddress ? input.mailingAddress : null

  return {
    name: input.legalName.trim(),
    hq_postal_code: input.headquarters.postalCode.trim(),
    hq_city: input.headquarters.city.trim(),
    hq_street: input.headquarters.street.trim(),
    use_separate_mailing_address: input.useSeparateMailingAddress,
    mail_postal_code: mailing?.postalCode.trim() || null,
    mail_city: mailing?.city.trim() || null,
    mail_street: mailing?.street.trim() || null,
    tax_number: input.taxNumber.trim(),
    registration_number: input.registrationNumber?.trim() || null,
    representative: input.representative?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    bank_name: input.bankName?.trim() || null,
    bank_account: input.bankAccount?.trim() || null,
    logo_data_url: input.logoDataUrl || null,
    default_vat_mode: input.defaultVatMode,
  }
}

export function profileToContractorAddress(profile: OrganizationProfile): string {
  return formatHungarianAddress(profile.headquarters)
}

export function profileToMailingAddress(profile: OrganizationProfile): string | null {
  if (!profile.useSeparateMailingAddress || !profile.mailingAddress) return null
  const formatted = formatHungarianAddress(profile.mailingAddress)
  return formatted || null
}

export const ORGANIZATION_SELECT =
  "id, name, slug, hq_postal_code, hq_city, hq_street, use_separate_mailing_address, mail_postal_code, mail_city, mail_street, tax_number, registration_number, representative, email, phone, bank_name, bank_account, logo_data_url, default_vat_mode, updated_at"
