import type { OrganizationProfile } from "@/types/organization"

/** Üres/kezdő cégprofil — a DB-ből érkező profil hiányáig használt alapérték. */
export const DEFAULT_ORG_PROFILE: OrganizationProfile = {
  id: "",
  legalName: "",
  slug: "",
  headquarters: {
    postalCode: "",
    city: "",
    street: "",
  },
  useSeparateMailingAddress: false,
  mailingAddress: null,
  taxNumber: "",
  defaultVatMode: "standard",
  updatedAt: new Date(0).toISOString(),
}
