import type { QuoteVatMode } from "@/types/projects"

export interface HungarianAddress {
  postalCode: string
  city: string
  street: string
}

export interface OrganizationProfile {
  id: string
  /** Jogi cégnév */
  legalName: string
  slug: string
  headquarters: HungarianAddress
  useSeparateMailingAddress: boolean
  mailingAddress?: HungarianAddress | null
  taxNumber: string
  registrationNumber?: string
  representative?: string
  email?: string
  phone?: string
  bankName?: string
  bankAccount?: string
  logoDataUrl?: string
  defaultVatMode: QuoteVatMode
  updatedAt: string
}

export type OrganizationProfileInput = Omit<
  OrganizationProfile,
  "id" | "slug" | "updatedAt"
>
