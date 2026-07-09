import type { HungarianAddress } from "@/types/organization"
import type { QuoteVatMode } from "@/types/projects"

export type ClientType = "company" | "individual"

export type ClientStatus = "active" | "inactive" | "prospect"

export interface ClientContact {
  id: string
  name: string
  role?: string
  email?: string
  phone?: string
  isPrimary: boolean
}

export interface Client {
  id: string
  orgId: string
  /** Szerkeszthető partnerkód — linkekhez, org-on belül egyedi */
  code: string
  clientType: ClientType
  legalName: string
  displayName: string
  taxNumber?: string
  companyRegNumber?: string
  email?: string
  phone?: string
  website?: string
  billingAddress: HungarianAddress
  useSeparateMailingAddress: boolean
  mailingAddress?: HungarianAddress | null
  defaultVatMode?: QuoteVatMode
  defaultPaymentTerms: string
  status: ClientStatus
  tags: string[]
  internalNotes: string
  contacts: ClientContact[]
  createdAt: string
  updatedAt: string
}

export type ClientInput = Omit<
  Client,
  "id" | "orgId" | "contacts" | "createdAt" | "updatedAt"
> & {
  contacts?: ClientContact[]
}

export type ClientFilters = {
  q?: string
  status?: ClientStatus | "all"
  clientType?: ClientType | "all"
}
