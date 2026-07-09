import type {
  Subcontractor,
  SubcontractorContact,
  SubcontractorReference,
  SubcontractorTier,
  SubcontractorStatus,
} from "@/types/subcontractors"
import type { Trade } from "@/types"

export type SubcontractorRow = {
  id: string
  organization_id: string
  code: string
  legal_name: string
  display_name: string
  tax_number: string | null
  company_reg_number: string | null
  tier: SubcontractorTier
  status: SubcontractorStatus
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  internal_notes: string
  rating: number | null
  tags: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SubcontractorContactRow = {
  id: string
  subcontractor_id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  is_primary: boolean
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type SubcontractorReferenceRow = {
  id: string
  subcontractor_id: string
  title: string
  project_name: string | null
  trade_id: string | null
  year: number | null
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export const SUBCONTRACTOR_SELECT =
  "id, organization_id, code, legal_name, display_name, tax_number, company_reg_number, tier, status, email, phone, website, address, internal_notes, rating, tags, created_at, updated_at, deleted_at"

export const SUBCONTRACTOR_CONTACT_SELECT =
  "id, subcontractor_id, name, role, email, phone, is_primary, sort_order, created_at, updated_at, deleted_at"

export const SUBCONTRACTOR_REFERENCE_SELECT =
  "id, subcontractor_id, title, project_name, trade_id, year, description, sort_order, created_at, updated_at, deleted_at"

export function normalizeSubcontractorCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export function suggestSubcontractorCode(displayName: string): string {
  return normalizeSubcontractorCode(
    displayName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
  )
}

export function mapContactRow(row: SubcontractorContactRow): SubcontractorContact {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    isPrimary: row.is_primary,
  }
}

export function mapReferenceRow(
  row: SubcontractorReferenceRow,
  tradeById: Map<string, Trade>
): SubcontractorReference {
  return {
    id: row.id,
    title: row.title,
    projectName: row.project_name ?? undefined,
    trade: row.trade_id ? tradeById.get(row.trade_id) : undefined,
    year: row.year ?? undefined,
    description: row.description ?? undefined,
    sortOrder: row.sort_order,
  }
}

export function assembleSubcontractor(
  row: SubcontractorRow,
  trades: Trade[],
  contacts: SubcontractorContact[],
  references: SubcontractorReference[]
): Subcontractor {
  return {
    id: row.id,
    orgId: row.organization_id,
    code: row.code,
    legalName: row.legal_name,
    displayName: row.display_name,
    taxNumber: row.tax_number ?? undefined,
    companyRegNumber: row.company_reg_number ?? undefined,
    trades,
    tags: row.tags ?? [],
    tier: row.tier,
    status: row.status,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    address: row.address ?? undefined,
    internalNotes: row.internal_notes,
    rating: (row.rating ?? undefined) as Subcontractor["rating"],
    contacts,
    references,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type SubcontractorWriteInput = {
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
  contacts?: SubcontractorContact[]
  references?: SubcontractorReference[]
}

export function subcontractorInputToInsertRow(
  organizationId: string,
  input: SubcontractorWriteInput
) {
  return {
    organization_id: organizationId,
    code: normalizeSubcontractorCode(input.code),
    legal_name: input.legalName.trim(),
    display_name: input.displayName.trim() || input.legalName.trim(),
    tax_number: input.taxNumber?.trim() || null,
    company_reg_number: input.companyRegNumber?.trim() || null,
    tier: input.tier,
    status: input.status,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    internal_notes: input.internalNotes ?? "",
    rating: input.rating ?? null,
    tags: input.tags ?? [],
  }
}

export function subcontractorInputToUpdateRow(input: SubcontractorWriteInput) {
  return {
    code: normalizeSubcontractorCode(input.code),
    legal_name: input.legalName.trim(),
    display_name: input.displayName.trim() || input.legalName.trim(),
    tax_number: input.taxNumber?.trim() || null,
    company_reg_number: input.companyRegNumber?.trim() || null,
    tier: input.tier,
    status: input.status,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    address: input.address?.trim() || null,
    internal_notes: input.internalNotes ?? "",
    rating: input.rating ?? null,
    tags: input.tags ?? [],
  }
}
