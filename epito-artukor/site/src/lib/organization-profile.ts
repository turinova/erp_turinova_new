import type { QuoteVatMode } from "@/types/projects"
import type { OrganizationProfile } from "@/types/organization"
import { DEFAULT_ORG_PROFILE } from "@/lib/organizations/default-org-profile"
import { formatHungarianAddress } from "@/lib/organizations/address"
import { loadOrganizationProfile } from "@/lib/data/org-store"
import type { TigParty } from "@/lib/tig-preview-build"

export function getOrganizationProfile(): OrganizationProfile {
  if (typeof window === "undefined") return { ...DEFAULT_ORG_PROFILE }
  return loadOrganizationProfile()
}

export function getDefaultVatMode(): QuoteVatMode {
  return getOrganizationProfile().defaultVatMode
}

/** Szerver oldali / migráció fallback */
export function getDefaultVatModeStatic(): QuoteVatMode {
  return DEFAULT_ORG_PROFILE.defaultVatMode
}

export function organizationToContractorParty(profile?: OrganizationProfile): TigParty {
  const org = profile ?? getOrganizationProfile()
  return {
    name: org.legalName,
    address: formatHungarianAddress(org.headquarters),
    taxNumber: org.taxNumber,
    registrationNumber: org.registrationNumber,
    representative: org.representative,
  }
}

export function organizationBankLine(profile?: OrganizationProfile): string | null {
  const org = profile ?? getOrganizationProfile()
  if (!org.bankAccount && !org.bankName) return null
  if (org.bankName && org.bankAccount) return `${org.bankName} · ${org.bankAccount}`
  return org.bankAccount ?? org.bankName ?? null
}

export function organizationContactLine(profile?: OrganizationProfile): string | null {
  const org = profile ?? getOrganizationProfile()
  const parts = [org.email, org.phone].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : null
}
