import type { Client, ClientContact } from "@/types/clients"
import type { HungarianAddress } from "@/types/organization"
import type { QuoteVatMode } from "@/types/projects"

export type ClientRow = {
  id: string
  organization_id: string
  code: string
  client_type: Client["clientType"]
  legal_name: string
  display_name: string
  tax_number: string | null
  company_reg_number: string | null
  email: string | null
  phone: string | null
  website: string | null
  billing_postal_code: string
  billing_city: string
  billing_street: string
  use_separate_mailing_address: boolean
  mail_postal_code: string | null
  mail_city: string | null
  mail_street: string | null
  default_vat_mode: QuoteVatMode | null
  default_payment_terms: string
  status: Client["status"]
  tags: string[]
  internal_notes: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type ClientContactRow = {
  id: string
  client_id: string
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

export const CLIENT_SELECT =
  "id, organization_id, code, client_type, legal_name, display_name, tax_number, company_reg_number, email, phone, website, billing_postal_code, billing_city, billing_street, use_separate_mailing_address, mail_postal_code, mail_city, mail_street, default_vat_mode, default_payment_terms, status, tags, internal_notes, created_at, updated_at, deleted_at"

export const CLIENT_CONTACT_SELECT =
  "id, client_id, name, role, email, phone, is_primary, sort_order, created_at, updated_at, deleted_at"

export function normalizeClientCode(code: string): string {
  return code
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
}

export function suggestClientCode(displayName: string): string {
  return normalizeClientCode(
    displayName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9\s-]/g, "")
  )
}

function mapAddress(postal: string, city: string, street: string): HungarianAddress {
  return { postalCode: postal, city, street }
}

export function mapContactRow(row: ClientContactRow): ClientContact {
  return {
    id: row.id,
    name: row.name,
    role: row.role ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    isPrimary: row.is_primary,
  }
}

export function assembleClient(row: ClientRow, contacts: ClientContact[]): Client {
  return {
    id: row.id,
    orgId: row.organization_id,
    code: row.code,
    clientType: row.client_type,
    legalName: row.legal_name,
    displayName: row.display_name,
    taxNumber: row.tax_number ?? undefined,
    companyRegNumber: row.company_reg_number ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    website: row.website ?? undefined,
    billingAddress: mapAddress(row.billing_postal_code, row.billing_city, row.billing_street),
    useSeparateMailingAddress: row.use_separate_mailing_address,
    mailingAddress: row.use_separate_mailing_address
      ? mapAddress(row.mail_postal_code ?? "", row.mail_city ?? "", row.mail_street ?? "")
      : null,
    defaultVatMode: row.default_vat_mode ?? undefined,
    defaultPaymentTerms: row.default_payment_terms,
    status: row.status,
    tags: row.tags ?? [],
    internalNotes: row.internal_notes,
    contacts,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export type ClientWriteInput = {
  code: string
  clientType: Client["clientType"]
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
  status: Client["status"]
  tags: string[]
  internalNotes: string
  contacts?: ClientContact[]
}

export function clientInputToInsertRow(organizationId: string, input: ClientWriteInput) {
  const mail = input.useSeparateMailingAddress ? input.mailingAddress : null
  return {
    organization_id: organizationId,
    code: normalizeClientCode(input.code),
    client_type: input.clientType,
    legal_name: input.legalName.trim(),
    display_name: input.displayName.trim() || input.legalName.trim(),
    tax_number: input.taxNumber?.trim() || null,
    company_reg_number: input.companyRegNumber?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    billing_postal_code: input.billingAddress.postalCode.trim(),
    billing_city: input.billingAddress.city.trim(),
    billing_street: input.billingAddress.street.trim(),
    use_separate_mailing_address: input.useSeparateMailingAddress,
    mail_postal_code: mail?.postalCode.trim() || null,
    mail_city: mail?.city.trim() || null,
    mail_street: mail?.street.trim() || null,
    default_vat_mode: input.defaultVatMode ?? null,
    default_payment_terms: input.defaultPaymentTerms ?? "",
    status: input.status,
    tags: input.tags ?? [],
    internal_notes: input.internalNotes ?? "",
  }
}

export function clientInputToUpdateRow(input: ClientWriteInput) {
  const mail = input.useSeparateMailingAddress ? input.mailingAddress : null
  return {
    code: normalizeClientCode(input.code),
    client_type: input.clientType,
    legal_name: input.legalName.trim(),
    display_name: input.displayName.trim() || input.legalName.trim(),
    tax_number: input.taxNumber?.trim() || null,
    company_reg_number: input.companyRegNumber?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    website: input.website?.trim() || null,
    billing_postal_code: input.billingAddress.postalCode.trim(),
    billing_city: input.billingAddress.city.trim(),
    billing_street: input.billingAddress.street.trim(),
    use_separate_mailing_address: input.useSeparateMailingAddress,
    mail_postal_code: mail?.postalCode.trim() || null,
    mail_city: mail?.city.trim() || null,
    mail_street: mail?.street.trim() || null,
    default_vat_mode: input.defaultVatMode ?? null,
    default_payment_terms: input.defaultPaymentTerms ?? "",
    status: input.status,
    tags: input.tags ?? [],
    internal_notes: input.internalNotes ?? "",
  }
}
