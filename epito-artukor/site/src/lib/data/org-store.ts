import type { OrganizationProfile, OrganizationProfileInput } from "@/types/organization"
import { DEFAULT_ORG_PROFILE } from "@/lib/organizations/default-org-profile"
import {
  emptyAddress,
  parseLegacyAddress,
} from "@/lib/organizations/address"

type LegacyStoredProfile = Partial<OrganizationProfile> & {
  headquartersAddress?: string
  mailingAddress?: string | HungarianAddressLegacy | null
}

type HungarianAddressLegacy = {
  postalCode?: string
  city?: string
  street?: string
}

function migrateAddress(
  structured: HungarianAddressLegacy | undefined,
  legacyString: string | undefined,
  fallback: OrganizationProfile["headquarters"]
): OrganizationProfile["headquarters"] {
  if (structured?.postalCode || structured?.city || structured?.street) {
    return {
      postalCode: structured.postalCode?.trim() ?? "",
      city: structured.city?.trim() ?? "",
      street: structured.street?.trim() ?? "",
    }
  }
  if (legacyString?.trim()) return parseLegacyAddress(legacyString)
  return { ...fallback }
}

function normalizeProfile(raw: LegacyStoredProfile | null | undefined): OrganizationProfile {
  const base = DEFAULT_ORG_PROFILE
  if (!raw) return { ...base }

  const useSeparate =
    raw.useSeparateMailingAddress ??
    Boolean(
      typeof raw.mailingAddress === "string"
        ? raw.mailingAddress.trim()
        : raw.mailingAddress?.postalCode || raw.mailingAddress?.city || raw.mailingAddress?.street
    )

  const mailingLegacy =
    typeof raw.mailingAddress === "string" ? raw.mailingAddress : undefined
  const mailingStructured: HungarianAddressLegacy | undefined =
    raw.mailingAddress && typeof raw.mailingAddress === "object"
      ? raw.mailingAddress
      : undefined

  return {
    id: raw.id ?? base.id,
    legalName: raw.legalName?.trim() || base.legalName,
    slug: raw.slug ?? base.slug,
    headquarters: migrateAddress(raw.headquarters, raw.headquartersAddress, base.headquarters),
    useSeparateMailingAddress: useSeparate,
    mailingAddress: useSeparate
      ? migrateAddress(mailingStructured, mailingLegacy, emptyAddress())
      : null,
    taxNumber: raw.taxNumber?.trim() || base.taxNumber,
    registrationNumber: raw.registrationNumber?.trim() || undefined,
    representative: raw.representative?.trim() || undefined,
    email: raw.email?.trim() || undefined,
    phone: raw.phone?.trim() || undefined,
    bankName: raw.bankName?.trim() || undefined,
    bankAccount: raw.bankAccount?.trim() || undefined,
    logoDataUrl: raw.logoDataUrl || undefined,
    defaultVatMode: raw.defaultVatMode ?? base.defaultVatMode,
    updatedAt: raw.updatedAt ?? base.updatedAt,
  }
}

/** In-memory cache — a DB (/api/organization) az egyetlen forrás, a primer tölti fel. */
let orgProfileCache: OrganizationProfile | null = null

export function cacheOrganizationProfile(profile: OrganizationProfile): OrganizationProfile {
  orgProfileCache = normalizeProfile(profile)
  return orgProfileCache
}

export function loadOrganizationProfile(): OrganizationProfile {
  return orgProfileCache ?? { ...DEFAULT_ORG_PROFILE }
}
