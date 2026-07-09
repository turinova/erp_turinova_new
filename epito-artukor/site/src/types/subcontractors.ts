import type { Trade } from "@/types"

export type SubcontractorStatus = "active" | "inactive" | "blocked" | "prospect"

export type SubcontractorTier = "preferred" | "standard" | "reserve" | "new"

export interface SubcontractorContact {
  id: string
  name: string
  role?: string
  email?: string
  phone?: string
  isPrimary: boolean
}

export interface SubcontractorReference {
  id: string
  title: string
  projectName?: string
  trade?: Trade
  year?: number
  description?: string
  sortOrder: number
}

export interface Subcontractor {
  id: string
  orgId: string
  /** Szerkeszthető partnerkód — linkekhez, org-on belül egyedi */
  code: string
  legalName: string
  displayName: string
  taxNumber?: string
  companyRegNumber?: string
  trades: Trade[]
  tags: string[]
  tier: SubcontractorTier
  status: SubcontractorStatus
  email?: string
  phone?: string
  website?: string
  address?: string
  internalNotes: string
  rating?: 1 | 2 | 3 | 4 | 5
  contacts: SubcontractorContact[]
  references: SubcontractorReference[]
  createdAt: string
  updatedAt: string
}

export type SubcontractorInput = Omit<
  Subcontractor,
  "id" | "orgId" | "contacts" | "references" | "createdAt" | "updatedAt"
> & {
  contacts?: SubcontractorContact[]
  references?: SubcontractorReference[]
}

export type SubcontractorFilters = {
  q?: string
  trade?: Trade | "all"
  status?: SubcontractorStatus | "all"
  tier?: SubcontractorTier | "all"
}
